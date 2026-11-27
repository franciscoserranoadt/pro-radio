package es.proradio.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * «Código Pro»: vinculación común de todas las apps Pro.
 * Este archivo es IGUAL en Pro Maps, Pro Radio, Pro Inicio, Pro Garaje y Pro OBD (solo cambia la línea «package»).
 *
 * - Guarda el código de vinculación (8 letras) y la hora en que se puso.
 * - Se lo pasa a las demás apps Pro instaladas en el mismo aparato (aviso SYNC_CODE a su SyncReceiver).
 *   Gana siempre el código puesto más tarde.
 * - Cifra los datos con el código (AES-GCM, clave sacada del código) antes de mandarlos a ntfy.sh.
 * - Hace las peticiones web (para que no las bloquee la pantalla web de la app).
 */
public final class ProSync {
    public static final String ACT_CODE = "es.pro.SYNC_CODE";
    public static final String ACT_ASK = "es.pro.SYNC_ASK";

    /** Paquete y receptor de cada app Pro. */
    static final String[][] APPS = {
            {"com.fserrano.promaps", "com.fserrano.promaps.SyncReceiver"},
            {"es.proradio.app", "es.proradio.app.SyncReceiver"},
            {"es.proinicio.app", "es.proinicio.app.SyncReceiver"},
            {"es.progaraje.app", "es.progaraje.app.SyncReceiver"},
            {"es.proobd.app", "es.proobd.app.SyncReceiver"},
    };

    private ProSync() { }

    private static SharedPreferences p(Context c) { return c.getSharedPreferences("prosync", Context.MODE_PRIVATE); }
    public static String code(Context c) { return p(c).getString("code", ""); }
    public static long time(Context c) { return p(c).getLong("t", 0); }
    /** 1 si este aparato se unió escribiendo el código de otro; 0 si lo creó. */
    public static int joined(Context c) { return p(c).getInt("j", 0); }

    static String clean(String s) { return s == null ? "" : s.toUpperCase().replaceAll("[^A-Z0-9]", ""); }

    /** Guarda el código si es más nuevo que el que hay. Devuelve true si lo ha guardado. */
    public static synchronized boolean adopt(Context c, String code, long t, int joined) {
        code = clean(code);
        if (code.length() != 0 && code.length() != 8) return false;
        if (t <= time(c)) return false;
        p(c).edit().putString("code", code).putLong("t", t).putInt("j", joined).commit();
        return true;
    }

    private static Intent intent(String action, String[] app, Context c) {
        Intent i = new Intent(action);
        i.setComponent(new ComponentName(app[0], app[1]));
        i.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        i.putExtra("from", c.getPackageName());
        return i;
    }

    private static void sendCode(Context c, String[] app) {
        try {
            Intent i = intent(ACT_CODE, app, c);
            i.putExtra("code", code(c)).putExtra("t", time(c)).putExtra("j", joined(c));
            c.sendBroadcast(i);
        } catch (Exception ignored) { }
    }

    /** Pasa el código de este app a las demás apps Pro del aparato. */
    public static void spread(Context c) {
        for (String[] a : APPS) if (!a[0].equals(c.getPackageName())) sendCode(c, a);
    }

    /** Pregunta a las demás apps Pro si tienen un código más nuevo. */
    public static void ask(Context c) {
        for (String[] a : APPS) {
            if (a[0].equals(c.getPackageName())) continue;
            try { c.sendBroadcast(intent(ACT_ASK, a, c)); } catch (Exception ignored) { }
        }
    }

    /** Lo llama SyncReceiver al recibir un aviso de otra app Pro. */
    static void handle(Context c, Intent i) {
        if (i == null || i.getAction() == null) return;
        if (ACT_CODE.equals(i.getAction())) {
            adopt(c, i.getStringExtra("code"), i.getLongExtra("t", 0), i.getIntExtra("j", 0));
        } else if (ACT_ASK.equals(i.getAction())) {
            String from = i.getStringExtra("from");
            if (time(c) == 0 || from == null) return;
            for (String[] a : APPS) if (a[0].equals(from)) sendCode(c, a);
        }
    }

    /* ---------------------------------------------------------------- cifrado */
    private static String keyCode;
    private static SecretKeySpec key;

    private static synchronized SecretKeySpec key(String code) throws Exception {
        if (key != null && code.equals(keyCode)) return key;
        SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");
        byte[] k = f.generateSecret(new PBEKeySpec(code.toCharArray(),
                "prosync-v1".getBytes(StandardCharsets.UTF_8), 4000, 256)).getEncoded();
        key = new SecretKeySpec(k, "AES");
        keyCode = code;
        return key;
    }

    /** Comprime y cifra. Devuelve «PS1:» + base64, o "" si no hay código. */
    public static String enc(Context c, String plain) {
        try {
            String code = code(c);
            if (code.isEmpty() || plain == null) return "";
            byte[] raw = plain.getBytes(StandardCharsets.UTF_8);
            Deflater d = new Deflater(Deflater.BEST_COMPRESSION);
            d.setInput(raw); d.finish();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            while (!d.finished()) { int n = d.deflate(buf); bo.write(buf, 0, n); }
            d.end();
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.ENCRYPT_MODE, key(code), new GCMParameterSpec(128, iv));
            byte[] ct = ci.doFinal(bo.toByteArray());
            byte[] all = new byte[12 + ct.length];
            System.arraycopy(iv, 0, all, 0, 12);
            System.arraycopy(ct, 0, all, 12, ct.length);
            return "PS1:" + Base64.encodeToString(all, Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    /** Descifra lo que hizo enc(). Devuelve "" si no se puede (otro código, datos rotos…). */
    public static String dec(Context c, String s) {
        try {
            String code = code(c);
            if (code.isEmpty() || s == null || !s.startsWith("PS1:")) return "";
            byte[] all = Base64.decode(s.substring(4), Base64.NO_WRAP);
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, key(code), new GCMParameterSpec(128, all, 0, 12));
            byte[] z = ci.doFinal(all, 12, all.length - 12);
            Inflater inf = new Inflater();
            inf.setInput(z);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            while (!inf.finished()) {
                int n = inf.inflate(buf);
                if (n == 0 && (inf.needsInput() || inf.needsDictionary())) break;
                bo.write(buf, 0, n);
            }
            inf.end();
            return new String(bo.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    /** Nombre del canal de ntfy de una app: no deja ver el código. */
    public static String topic(Context c, String app) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest(("prosync|" + code(c) + "|" + app).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("ps-");
            for (int i = 0; i < 12; i++) sb.append(String.format("%02x", h[i]));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    /* ---------------------------------------------------------------- puente con la pantalla (JavaScript) */
    /** Se añade a la WebView con: web.addJavascriptInterface(new ProSync.Js(this, web), "ProSync"); */
    public static final class Js {
        private final Context c;
        private final WebView w;
        private final Handler ui = new Handler(Looper.getMainLooper());

        public Js(Context c, WebView w) { this.c = c.getApplicationContext(); this.w = w; }

        @JavascriptInterface public String code() { return ProSync.code(c); }
        @JavascriptInterface public String time() { return String.valueOf(ProSync.time(c)); }
        @JavascriptInterface public int joined() { return ProSync.joined(c); }
        @JavascriptInterface public String pkg() { return c.getPackageName(); }

        /** Código nuevo puesto a mano en esta app (joined = 1 si se escribió el de otro aparato). */
        @JavascriptInterface public boolean set(String code, int joined) {
            String cc = clean(code);
            if (cc.length() != 0 && cc.length() != 8) return false;
            long t = Math.max(System.currentTimeMillis(), ProSync.time(c) + 1);
            adopt(c, cc, t, joined);
            spread(c);
            return true;
        }

        /** Código de las versiones anteriores (Pro Maps = 2, Pro Radio = 1): solo si no hay otro más nuevo. */
        @JavascriptInterface public void legacy(String code, int prio) {
            if (clean(code).length() == 8 && adopt(c, code, prio, 0)) spread(c);
        }

        @JavascriptInterface public void ask() { ProSync.ask(c); }
        @JavascriptInterface public String enc(String s) { return ProSync.enc(c, s); }
        @JavascriptInterface public String dec(String s) { return ProSync.dec(c, s); }
        @JavascriptInterface public String topic(String app) { return ProSync.topic(c, app); }

        /** Petición web en segundo plano; contesta llamando a window.__psr(id, ok, estado, texto). */
        @JavascriptInterface public void req(final String id, final String method, final String url, final String body) {
            new Thread(() -> {
                boolean ok = false; int st = 0; String txt;
                HttpURLConnection h = null;
                try {
                    h = (HttpURLConnection) new URL(url).openConnection();
                    h.setConnectTimeout(15000);
                    h.setReadTimeout(25000);
                    h.setRequestMethod(method);
                    h.setRequestProperty("User-Agent", "ProApps-Sync");
                    if (body != null && !"GET".equals(method)) {
                        h.setDoOutput(true);
                        byte[] b = body.getBytes(StandardCharsets.UTF_8);
                        h.setFixedLengthStreamingMode(b.length);
                        OutputStream os = h.getOutputStream();
                        os.write(b); os.close();
                    }
                    st = h.getResponseCode();
                    InputStream is = st >= 400 ? h.getErrorStream() : h.getInputStream();
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    if (is != null) {
                        byte[] buf = new byte[8192]; int n;
                        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                        is.close();
                    }
                    txt = new String(bo.toByteArray(), StandardCharsets.UTF_8);
                    ok = st >= 200 && st < 300;
                } catch (Exception e) {
                    txt = String.valueOf(e.getMessage());
                } finally {
                    if (h != null) h.disconnect();
                }
                final String js = "window.__psr&&window.__psr(" + JSONObject.quote(id) + "," + ok + "," + st + "," + JSONObject.quote(txt) + ")";
                ui.post(() -> { try { w.evaluateJavascript(js, null); } catch (Exception ignored) { } });
            }).start();
        }
    }
}
