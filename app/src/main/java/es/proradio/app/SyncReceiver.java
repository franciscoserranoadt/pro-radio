package es.proradio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Recibe el «Código Pro» de las demás apps Pro del aparato (ver ProSync.java). */
public class SyncReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        ProSync.handle(context, intent);
    }
}
