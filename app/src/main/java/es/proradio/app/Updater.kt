package es.proradio.app

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL

/** Busca versiones nuevas en GitHub y las instala con el instalador de Android (igual que Pro Maps). */
object Updater {

    const val ACTION_STATUS = "es.proradio.app.INSTALL_STATUS"
    private const val BASE = "https://github.com/franciscoserranoadt/pro-radio/releases/download/ultima/"

    class Info(val code: Int, val name: String, val notes: String)

    fun installedCode(c: Context): Int = try {
        c.packageManager.getPackageInfo(c.packageName, 0).longVersionCode.toInt()
    } catch (_: Exception) {
        0
    }

    fun installedName(c: Context): String = try {
        c.packageManager.getPackageInfo(c.packageName, 0).versionName ?: "?"
    } catch (_: Exception) {
        "?"
    }

    private fun open(url: String, readTimeout: Int): HttpURLConnection {
        val con = URL(url).openConnection() as HttpURLConnection
        con.instanceFollowRedirects = true
        con.connectTimeout = 10_000
        con.readTimeout = readTimeout
        con.useCaches = false
        con.setRequestProperty("Cache-Control", "no-cache")
        con.setRequestProperty("User-Agent", "ProRadio-Updater")
        return con
    }

    /** Versión publicada o null si no se puede consultar. Llamar desde un hilo secundario. */
    fun latest(): Info? {
        return try {
            val con = open(BASE + "version.txt?t=" + System.currentTimeMillis(), 15_000)
            try {
                if (con.responseCode != 200) return null
                val txt = con.inputStream.bufferedReader().readText().trim()
                val nl = txt.indexOf('\n')
                val first = if (nl >= 0) txt.substring(0, nl) else txt
                val notes = if (nl >= 0) txt.substring(nl + 1).trim() else ""
                val parts = first.trim().split(Regex("\\s+"))
                val code = parts[0].toInt()
                Info(code, if (parts.size > 1) parts[1] else code.toString(), notes)
            } finally {
                con.disconnect()
            }
        } catch (_: Exception) {
            null
        }
    }

    /** Descarga la APK y abre la pantalla de instalar. Hilo secundario. Devuelve un error o null. */
    fun downloadAndInstall(a: Activity): String? {
        return try {
            val con = open(BASE + "ProRadio.apk", 60_000)
            try {
                if (con.responseCode != 200) return "No se pudo descargar (error ${con.responseCode})"
                val installer = a.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                params.setAppPackageName(a.packageName)
                val id = installer.createSession(params)
                installer.openSession(id).use { session ->
                    con.inputStream.use { input ->
                        session.openWrite("ProRadio.apk", 0, con.contentLengthLong).use { out ->
                            input.copyTo(out, 65536)
                            session.fsync(out)
                        }
                    }
                    val i = Intent(a, MainActivity::class.java)
                        .setAction(ACTION_STATUS)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    var flags = PendingIntent.FLAG_UPDATE_CURRENT
                    if (Build.VERSION.SDK_INT >= 31) flags = flags or PendingIntent.FLAG_MUTABLE
                    val pi = PendingIntent.getActivity(a, 77, i, flags)
                    session.commit(pi.intentSender)
                }
                null
            } finally {
                con.disconnect()
            }
        } catch (e: Exception) {
            "Error al actualizar: ${e.message}"
        }
    }
}
