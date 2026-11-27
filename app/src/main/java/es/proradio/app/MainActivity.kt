package es.proradio.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private lateinit var web: WebView
    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var pageReady = false
    private var pendingQueue: Pair<String, Int>? = null
    private var autoplayChecked = false
    private var lastLat = Double.NaN
    private var lastLon = Double.NaN
    private var locationStarted = false
    private val handler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("proradio", Context.MODE_PRIVATE) }

    private val audio by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    private val locationManager by lazy { getSystemService(Context.LOCATION_SERVICE) as LocationManager }

    // Se implementan todos los métodos: en Android 10 no existen versiones por defecto.
    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) = sendLocation(location)
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private val playerListener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = pushState()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()

        web = WebView(this)
        web.setBackgroundColor(0xFF0C0F2E.toInt())
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.settings.textZoom = 100
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                pageReady = true
                pushState()
                if (!lastLat.isNaN()) js("PR.onLocation($lastLat,$lastLon)")
            }
        }
        web.addJavascriptInterface(Bridge(), "Android")
        web.addJavascriptInterface(ProSync.Js(this, web), "ProSync")
        web.loadUrl("file:///android_asset/index.html")
        setContentView(web)

        askPermissions()
        handler.postDelayed({ checkUpdate(false) }, 5000)
    }

    override fun onStart() {
        super.onStart()
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        val future = MediaController.Builder(this, token).buildAsync()
        controllerFuture = future
        future.addListener({
            try {
                val c = future.get()
                controller = c
                c.addListener(playerListener)
                pendingQueue?.let { setQueue(it.first, it.second) }
                pendingQueue = null
                maybeAutoplay(c)
                pushState()
            } catch (_: Exception) {
            }
        }, ContextCompat.getMainExecutor(this))
        startLocation()
    }

    override fun onStop() {
        // «Seguir sonando en segundo plano» apagado: al salir de la app se para la radio.
        if (!Store.isOn(this, "background") && !isChangingConfigurations) controller?.pause()
        controller?.removeListener(playerListener)
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
        controllerFuture = null
        stopLocation()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        js("PR.onResume && PR.onResume()")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
    }

    /** Al abrir la app (o al encender el coche) pone la última emisora si no suena nada. */
    private fun maybeAutoplay(c: MediaController) {
        if (autoplayChecked) return
        autoplayChecked = true
        if (!Store.isOn(this, "autostart")) return
        if (c.mediaItemCount > 0) return
        val items = Store.savedItems(this)
        if (items.isEmpty()) return
        val idx = Store.index(this).coerceIn(0, items.size - 1)
        c.setMediaItems(items, idx, C.TIME_UNSET)
        c.prepare()
        c.play()
    }

    private fun setQueue(json: String, index: Int) {
        val c = controller
        if (c == null) {
            pendingQueue = Pair(json, index)
            return
        }
        val items = Store.itemsFromJson(json)
        if (items.isEmpty()) return
        val idx = index.coerceIn(0, items.size - 1)
        Store.saveQueue(this, json, idx)
        c.setMediaItems(items, idx, C.TIME_UNSET)
        c.prepare()
        c.play()
    }

    private fun pushState() {
        if (!pageReady) return
        val c = controller ?: return
        val o = JSONObject()
        val item = c.currentMediaItem
        o.put("id", item?.mediaId ?: "")
        o.put("playing", c.isPlaying)
        o.put("want", c.playWhenReady)
        o.put("state", c.playbackState)
        o.put("error", c.playerError != null)
        o.put("count", c.mediaItemCount)
        o.put("index", c.currentMediaItemIndex)
        val stationTitle = item?.mediaMetadata?.title?.toString() ?: ""
        val liveTitle = c.mediaMetadata.title?.toString() ?: ""
        o.put("song", if (liveTitle.isNotBlank() && liveTitle != stationTitle) liveTitle else "")
        js("PR.onState($o)")
    }

    private fun js(code: String) {
        if (!pageReady) return
        runOnUiThread { web.evaluateJavascript("window.PR && $code", null) }
    }

    // ---------- Ubicación (para el clima) ----------

    private fun askPermissions() {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        startLocation()
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    private fun startLocation() {
        if (locationStarted || !hasLocationPermission()) return
        locationStarted = true
        try {
            var best: Location? = null
            for (p in locationManager.getProviders(true)) {
                val l = locationManager.getLastKnownLocation(p) ?: continue
                if (best == null || l.time > best.time) best = l
            }
            best?.let { sendLocation(it) }
            for (p in listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)) {
                if (locationManager.isProviderEnabled(p)) {
                    locationManager.requestLocationUpdates(p, 10 * 60 * 1000L, 2000f, locationListener, Looper.getMainLooper())
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun stopLocation() {
        if (!locationStarted) return
        locationStarted = false
        try {
            locationManager.removeUpdates(locationListener)
        } catch (_: Exception) {
        }
    }

    private fun sendLocation(l: Location) {
        lastLat = l.latitude
        lastLon = l.longitude
        js("PR.onLocation($lastLat,$lastLon)")
    }

    // ---------- Mandos del volante: prueba de botones ----------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && event.keyCode != KeyEvent.KEYCODE_BACK) {
            val name = KeyEvent.keyCodeToString(event.keyCode)
            js("PR.onKey(${event.keyCode},${JSONObject.quote(name)})")
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // La radio sigue sonando: solo se manda la app al fondo.
        moveTaskToBack(true)
    }

    // ---------- Voz ----------

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 77 && resultCode == RESULT_OK) {
            val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: return
            js("PR.onVoice(${JSONObject.quote(text)})")
        }
    }

    // ---------- Actualizaciones (igual que Pro Maps) ----------

    private fun toast(msg: String) = js("PR.toast(" + JSONObject.quote(msg) + ")")

    private fun checkUpdate(manual: Boolean) {
        if (manual) toast("Buscando actualizaciones…")
        Thread {
            val info = Updater.latest()
            val mine = Updater.installedCode(this)
            handler.post {
                if (isFinishing) return@post
                if (info == null) {
                    if (manual) toast("No se pudo comprobar. ¿Tienes internet?")
                    return@post
                }
                if (info.code <= mine) {
                    if (manual) toast("Ya tienes la última versión (v" + Updater.installedName(this) + ")")
                    return@post
                }
                if (!manual && prefs.getInt("skipVersion", 0) == info.code) return@post
                AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                    .setTitle("Hay una versión nueva")
                    .setMessage(
                        "Pro Radio v" + info.name + " ya está disponible (tienes la v" + Updater.installedName(this) + ")." +
                                (if (info.notes.isEmpty()) "" else "\n\nNovedades:\n" + info.notes) +
                                "\n\nTus memorias y favoritas se mantienen."
                    )
                    .setPositiveButton("Actualizar") { _, _ -> startUpdate() }
                    .setNeutralButton("Esta no") { _, _ -> prefs.edit().putInt("skipVersion", info.code).apply() }
                    .setNegativeButton("Más tarde", null)
                    .show()
            }
        }.start()
    }

    private fun startUpdate() {
        // Android 8+ pide permiso por app; en Android 6-7 vale con «Orígenes desconocidos».
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Falta un permiso")
                .setMessage(
                    "Para actualizarse, Android tiene que permitir que Pro Radio instale apps.\n\n" +
                            "En la siguiente pantalla activa «Permitir de esta fuente», vuelve atrás y pulsa otra vez Actualizar."
                )
                .setPositiveButton("Abrir ajustes") { _, _ ->
                    try {
                        startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                    } catch (_: Exception) {
                    }
                }
                .setNegativeButton("Cancelar", null)
                .show()
            return
        }
        toast("Descargando la versión nueva…")
        Thread {
            val err = Updater.downloadAndInstall(this)
            if (err != null) handler.post { toast(err) }
        }.start()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent == null || intent.action != Updater.ACTION_STATUS) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            if (confirm != null) {
                try {
                    startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
            toast("No se pudo instalar" + if (msg == null) "" else ": $msg")
        }
    }

    // ---------- Puente con la pantalla (JavaScript) ----------

    inner class Bridge {
        @JavascriptInterface
        fun setQueue(json: String, index: Int) = runOnUiThread { this@MainActivity.setQueue(json, index) }

        @JavascriptInterface
        fun toggle() = runOnUiThread {
            val c = controller ?: return@runOnUiThread
            if (c.playbackState == Player.STATE_IDLE && c.mediaItemCount > 0) {
                c.prepare(); c.play()
            } else if (c.playWhenReady) c.pause() else c.play()
        }

        @JavascriptInterface
        fun next() = runOnUiThread { controller?.seekToNext() }

        @JavascriptInterface
        fun prev() = runOnUiThread { controller?.seekToPrevious() }

        @JavascriptInterface
        fun requestState() = runOnUiThread { pushState() }

        @JavascriptInterface
        fun getVolume(): Int {
            val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
            return audio.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max
        }

        @JavascriptInterface
        fun setVolume(pct: Int) {
            val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val v = Math.round(pct.coerceIn(0, 100) * max / 100f)
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0)
        }

        @JavascriptInterface
        fun setPref(key: String, value: String) = Store.setPref(this@MainActivity, key, value)

        @JavascriptInterface
        fun getPref(key: String, def: String): String = Store.pref(this@MainActivity, key, def)

        @JavascriptInterface
        fun version(): String = Updater.installedName(this@MainActivity)

        @JavascriptInterface
        fun checkUpdate() = runOnUiThread { this@MainActivity.checkUpdate(true) }

        /** Petición web para la sincronización (sin límites de seguridad del navegador). */
        @JavascriptInterface
        fun http(id: String, method: String, url: String, body: String?) {
            Thread {
                var ok = false
                var code = 0
                var text = ""
                var loc = ""
                try {
                    val con = URL(url).openConnection() as HttpURLConnection
                    con.requestMethod = method
                    con.connectTimeout = 10_000
                    con.readTimeout = 15_000
                    con.useCaches = false
                    con.setRequestProperty("Accept", "application/json")
                    con.setRequestProperty("User-Agent", "ProRadio")
                    if (body != null && method != "GET") {
                        con.doOutput = true
                        con.setRequestProperty(
                            "Content-Type",
                            if (url.contains("jsonblob")) "application/json" else "text/plain; charset=utf-8"
                        )
                        con.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    }
                    code = con.responseCode
                    ok = code in 200..299
                    loc = con.getHeaderField("Location") ?: ""
                    val stream = if (ok) con.inputStream else con.errorStream
                    text = stream?.bufferedReader()?.use { it.readText() } ?: ""
                    con.disconnect()
                } catch (e: Exception) {
                    text = e.message ?: "error"
                }
                val o = JSONObject().put("id", id).put("ok", ok).put("code", code).put("text", text).put("loc", loc)
                js("PR.onHttp($o)")
            }.start()
        }

        /** Reordena la cola (tras mover memorias) sin cortar la emisora que suena. */
        @JavascriptInterface
        fun reorder(json: String) = runOnUiThread {
            val c = controller ?: return@runOnUiThread
            try {
                val arr = JSONArray(json)
                val ids = (0 until arr.length()).map { arr.getJSONObject(it).optString("id") }
                if (ids.size != c.mediaItemCount) return@runOnUiThread
                for (i in ids.indices) {
                    var j = -1
                    for (k in i until c.mediaItemCount) {
                        if (c.getMediaItemAt(k).mediaId == ids[i]) { j = k; break }
                    }
                    if (j < 0) return@runOnUiThread
                    if (j != i) c.moveMediaItem(j, i)
                }
                Store.saveQueue(this@MainActivity, json, c.currentMediaItemIndex)
            } catch (_: Exception) {
            }
        }

        /** Abre un enlace (Spotify, YouTube…) en la app que corresponda. */
        @JavascriptInterface
        fun openUrl(url: String) = runOnUiThread {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {
                toast("No hay ninguna app para abrir el enlace")
            }
        }

        /** Modo noche: baja el brillo de la pantalla mientras Pro Radio está delante. */
        @JavascriptInterface
        fun setDim(on: Boolean) = runOnUiThread {
            val lp = window.attributes
            lp.screenBrightness = if (on) 0.3f else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
            window.attributes = lp
        }

        @JavascriptInterface
        fun lastQueue(): String = Store.queueJson(this@MainActivity)

        @JavascriptInterface
        fun voice(): Boolean {
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "Di el nombre de una emisora")
            if (i.resolveActivity(packageManager) == null) return false
            runOnUiThread {
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(i, 77)
                } catch (_: ActivityNotFoundException) {
                    js("PR.toast('El reconocimiento de voz no está disponible')")
                }
            }
            return true
        }
    }
}
