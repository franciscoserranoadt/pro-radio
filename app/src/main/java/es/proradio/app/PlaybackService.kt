package es.proradio.app

import android.app.PendingIntent
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Servicio que reproduce la radio en segundo plano.
 * Publica una MediaSession: así los mandos del volante (siguiente / anterior / play-pausa)
 * llegan aquí aunque la pantalla muestre otra app (por ejemplo Pro Maps).
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {

    private var session: MediaSession? = null
    private lateinit var exo: ExoPlayer
    private val handler = Handler(Looper.getMainLooper())
    private var retries = 0

    private val retryRunnable = Runnable {
        if (exo.mediaItemCount > 0) {
            exo.prepare()
            exo.play()
        }
    }

    override fun onCreate() {
        super.onCreate()

        // Buffer grande para aguantar túneles y zonas con poca cobertura.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(20_000, 60_000, 2_500, 5_000)
            .build()

        val http = DefaultHttpDataSource.Factory()
            .setUserAgent("ProRadio/1.0 (Android)")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)

        exo = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(this, http)))
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(false)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()

        exo.repeatMode = Player.REPEAT_MODE_ALL

        exo.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                if (!Store.isOn(this@PlaybackService, "reconnect")) return
                retries++
                val delay = (3_000L * retries).coerceAtMost(30_000L)
                handler.removeCallbacks(retryRunnable)
                handler.postDelayed(retryRunnable, delay)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) retries = 0
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                Store.saveIndex(this@PlaybackService, exo.currentMediaItemIndex)
            }
        })

        // En las emisoras en directo, "siguiente/anterior" siempre cambia de emisora
        // (sin esto, "anterior" reiniciaría la emisora actual).
        val player = object : ForwardingPlayer(exo) {
            override fun seekToNext() = jump(true)
            override fun seekToPrevious() = jump(false)
            override fun seekToNextMediaItem() = jump(true)
            override fun seekToPreviousMediaItem() = jump(false)

            private fun jump(forward: Boolean) {
                val n = exo.mediaItemCount
                if (n == 0) return
                val cur = exo.currentMediaItemIndex
                val target = if (forward) (cur + 1) % n else (cur - 1 + n) % n
                exo.seekToDefaultPosition(target)
                if (exo.playbackState == Player.STATE_IDLE) exo.prepare()
                exo.play()
            }

            override fun getAvailableCommands(): Player.Commands {
                return super.getAvailableCommands().buildUpon()
                    .add(Player.COMMAND_SEEK_TO_NEXT)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                    .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .build()
            }

            override fun isCommandAvailable(command: Int): Boolean {
                return when (command) {
                    Player.COMMAND_SEEK_TO_NEXT,
                    Player.COMMAND_SEEK_TO_PREVIOUS,
                    Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> true
                    else -> super.isCommandAvailable(command)
                }
            }
        }

        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        session = MediaSession.Builder(this, player)
            .setSessionActivity(pending)
            .setCallback(object : MediaSession.Callback {
                // Las emisoras llegan desde la pantalla: recuperamos su dirección de streaming.
                override fun onAddMediaItems(
                    mediaSession: MediaSession,
                    controller: MediaSession.ControllerInfo,
                    mediaItems: MutableList<MediaItem>
                ): ListenableFuture<MutableList<MediaItem>> {
                    val out = mediaItems.map { item ->
                        val uri = item.requestMetadata.mediaUri ?: item.localConfiguration?.uri
                        item.buildUpon().setUri(uri).build()
                    }.toMutableList()
                    return Futures.immediateFuture(out)
                }

                // Al pulsar "play" en el volante con la app cerrada, vuelve la última emisora.
                override fun onPlaybackResumption(
                    mediaSession: MediaSession,
                    controller: MediaSession.ControllerInfo
                ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
                    val items = Store.savedItems(this@PlaybackService)
                    if (items.isEmpty()) {
                        return Futures.immediateFailedFuture(UnsupportedOperationException("Sin emisoras"))
                    }
                    val idx = Store.index(this@PlaybackService).coerceIn(0, items.size - 1)
                    return Futures.immediateFuture(
                        MediaSession.MediaItemsWithStartPosition(items, idx, C.TIME_UNSET)
                    )
                }
            })
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    // Si se cierra la app desde "recientes", la radio sigue sonando.
    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!exo.playWhenReady || exo.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        handler.removeCallbacks(retryRunnable)
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }
}
