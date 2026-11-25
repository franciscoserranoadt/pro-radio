package es.proradio.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Al encender el coche abre Pro Radio, que pone la última emisora (si está activado en Ajustes). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Store.isOn(context, "autostart")) return
        try {
            context.startActivity(
                Intent(context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    .putExtra("fromBoot", true)
            )
        } catch (_: Exception) {
        }
    }
}
