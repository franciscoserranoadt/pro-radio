package es.proradio.app

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONArray

/** Guarda la cola de emisoras y los ajustes que necesita la parte nativa. */
object Store {
    private fun p(c: Context) = c.getSharedPreferences("proradio", Context.MODE_PRIVATE)

    fun saveQueue(c: Context, json: String, index: Int) {
        p(c).edit().putString("queue", json).putInt("index", index).apply()
    }

    fun saveIndex(c: Context, index: Int) {
        p(c).edit().putInt("index", index).apply()
    }

    fun queueJson(c: Context): String = p(c).getString("queue", "[]") ?: "[]"

    fun index(c: Context): Int = p(c).getInt("index", 0)

    fun setPref(c: Context, key: String, value: String) {
        p(c).edit().putString("pref_$key", value).apply()
    }

    fun pref(c: Context, key: String, def: String): String =
        p(c).getString("pref_$key", def) ?: def

    fun isOn(c: Context, key: String): Boolean = pref(c, key, "1") == "1"

    fun savedItems(c: Context): MutableList<MediaItem> = itemsFromJson(queueJson(c))

    fun itemsFromJson(json: String): MutableList<MediaItem> {
        val out = mutableListOf<MediaItem>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val url = o.optString("url")
                if (url.isBlank()) continue
                val uri = Uri.parse(url)
                val name = o.optString("name", "Pro Radio")
                val extra = listOf(o.optString("tags"), o.optString("cc"))
                    .filter { it.isNotBlank() }
                    .joinToString(" · ")
                val md = MediaMetadata.Builder()
                    .setTitle(name)
                    .setArtist(if (extra.isBlank()) "Pro Radio" else extra)
                    .setIsPlayable(true)
                val fav = o.optString("fav")
                if (fav.startsWith("http")) md.setArtworkUri(Uri.parse(fav))
                out.add(
                    MediaItem.Builder()
                        .setMediaId(o.optString("id", url))
                        .setUri(uri)
                        .setMediaMetadata(md.build())
                        .setRequestMetadata(
                            MediaItem.RequestMetadata.Builder().setMediaUri(uri).build()
                        )
                        .build()
                )
            }
        } catch (_: Exception) {
        }
        return out
    }
}
