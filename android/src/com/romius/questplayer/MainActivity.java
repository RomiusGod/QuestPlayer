package com.romius.questplayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;


public class MainActivity extends Activity {
    private static final String HOST = "appassets.local";
    private static final int FILE_REQ = 4242;
    private WebView web;
    /* Высота системной клавиатуры: окно не сжимается, страница поднимает
       строку ввода сама — см. trackImeHeight(). */
    private int lastImePx = -1;
    private int navInset = -1;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingUri;
    private String pendingName;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT <= 28 &&
                checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 7);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFF101014);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        /* По ТЗ клавиатура — оверлей: окно игры не меняет размер. Строка
           ввода сама поднимается над клавиатурой: её высоту отдаём странице
           через window.__tqIme(). */
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        trackImeHeight();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                /* Новая страница — заново отдаём текущую высоту клавиатуры. */
                lastImePx = -1;
                pushImeHeight(0);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && HOST.equals(u.getHost()) && "/__lastgame".equals(u.getPath())) {
                    String uri = prefs().getString("last_uri", "");
                    if (uri != null && uri.length() > 0) {
                        try {
                            InputStream in = getContentResolver().openInputStream(Uri.parse(uri));
                            if (in != null) {
                                return new WebResourceResponse("application/octet-stream", null, in);
                            }
                        } catch (Exception ignored) {}
                    }
                }
                if (u != null && HOST.equals(u.getHost())) {
                    WebResourceResponse r = assetResponse(u.getPath());
                    if (r != null) {
                        java.util.Map<String, String> h = new java.util.HashMap<>();
                        h.put("Cache-Control", "no-store, no-cache, must-revalidate");
                        h.put("Pragma", "no-cache");
                        r.setResponseHeaders(h);
                    }
                    if (r != null) return r;
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {}
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                    startActivityForResult(i, FILE_REQ);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        web.clearCache(true);
        web.loadUrl("https://" + HOST + "/index.html?v=2");
        immersive();
    }

    /* Окно под клавиатуру не сжимается (adjustNothing), поэтому её высоту
       отдаём странице: строка ввода поднимается сама, игра не двигается. */
    private void trackImeHeight() {
        final View root = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    pushImeHeight(insets.getInsets(WindowInsets.Type.ime()).bottom);
                    return insets;
                }
            });
            root.requestApplyInsets();
            return;
        }
        /* Android 7–10: высоту клавиатуры берём из видимой области окна. */
        root.getViewTreeObserver().addOnGlobalLayoutListener(
                new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                android.graphics.Rect r = new android.graphics.Rect();
                root.getWindowVisibleDisplayFrame(r);
                int total = root.getRootView().getHeight();
                int hidden = total - r.bottom;
                if (hidden < 0) hidden = 0;
                if (navInset < 0 && hidden < total / 4) navInset = hidden;
                int ime = navInset > 0 ? Math.max(0, hidden - navInset) : hidden;
                if (ime < total / 6) ime = 0;
                pushImeHeight(ime);
            }
        });
    }

    private void pushImeHeight(final int px) {
        if (px == lastImePx) return;
        lastImePx = px;
        if (web == null) return;
        try {
            web.evaluateJavascript("window.__tqIme&&window.__tqIme(" + px + ")", null);
        } catch (Exception ignored) {}
    }

    private WebResourceResponse assetResponse(String path) {
        if (path == null || path.length() == 0 || "/".equals(path)) path = "/index.html";
        while (path.startsWith("/")) path = path.substring(1);
        if (path.contains("..")) return null;
        try {
            InputStream in = getAssets().open(path);
            String mime = mimeFor(path);
            return new WebResourceResponse(mime, "UTF-8", in);
        } catch (Exception e) {
            return null;
        }
    }

    private String mimeFor(String path) {
        String p = path.toLowerCase(Locale.US);
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".otf")) return "font/otf";
        return "application/octet-stream";
    }

    private void immersive() {
        try {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == SYNC_REQ) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(tree,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception ignored) {}
                prefs().edit()
                        .putString("sync_tree", tree.toString())
                        .putString("sync_tree_name", treeName(tree))
                        .apply();
                ok = true;
            }
            if (web != null) {
                try {
                    web.evaluateJavascript("window.__tqSyncFolder&&window.__tqSyncFolder("
                            + (ok ? "true" : "false") + ")", null);
                } catch (Exception ignored) {}
            }
            return;
        }
        if (requestCode == FILE_REQ) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    result = new Uri[]{uri};
                    pendingUri = uri.toString();
                    pendingName = displayName(uri);
                    /* Сохраняем доступ к файлу между запусками — храним только путь. */
                    try {
                        getContentResolver().takePersistableUriPermission(
                                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) {}
                }
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(function(){var p=document.getElementById('tq-panel');" +
                "if(document.body.classList.contains('tq-panel-open')){" +
                "var c=document.getElementById('tq-panel-close');if(c){c.click();return '1';}}" +
                "return '0';})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value != null && value.indexOf('1') >= 0) return;
                        moveTaskToBack(true);
                    }
                });
    }

    private String displayName(Uri uri) {
        String name = "";
        Cursor c = null;
        try {
            c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) name = c.getString(idx);
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        if (name == null) name = "";
        return name;
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("questplayer", MODE_PRIVATE);
    }

    /* ---------------------- game data folders ---------------------- */

    private File gamesRoot() {
        File d = new File(getFilesDir(), "games");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static String safeId(String id) {
        if (id == null) return "";
        String s = id.replaceAll("[^A-Za-z0-9._-]", "_").trim();
        if (s.length() > 64) s = s.substring(0, 64);
        return s;
    }

    private static String safeFile(String name) {
        if (name == null) name = "";
        String s = name.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1F]", "_").trim();
        if (s.length() == 0 || ".".equals(s) || "..".equals(s)) s = "file";
        if (s.length() > 128) s = s.substring(0, 128);
        return s;
    }

    private File gameDir(String gameId) {
        String id = safeId(gameId);
        if (id.length() == 0) return null;
        return new File(gamesRoot(), id);
    }

    private static long sizeOf(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long total = 0;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) total += sizeOf(k);
        return total;
    }

    private static void deleteRec(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRec(k);
        }
        f.delete();
    }

    /* Копирует недостающие файлы from -> to (без перезаписи). */
    private static void mergeInto(File from, File to) {
        if (from == null || to == null || !from.exists()) return;
        if (!to.exists()) to.mkdirs();
        File[] kids = from.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            File dst = new File(to, k.getName());
            if (k.isDirectory()) {
                mergeInto(k, dst);
            } else if (!dst.exists()) {
                InputStream in = null;
                OutputStream out = null;
                try {
                    in = new FileInputStream(k);
                    out = new FileOutputStream(dst);
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                } catch (Exception ignored) {
                } finally {
                    try { if (in != null) in.close(); } catch (Exception ignored) {}
                    try { if (out != null) out.close(); } catch (Exception ignored) {}
                }
            }
        }
    }

    private static String readTextFile(File f) {
        if (f == null || !f.isFile()) return null;
        Reader r = null;
        try {
            r = new InputStreamReader(new FileInputStream(f), "UTF-8");
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) > 0) sb.append(buf, 0, n);
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            try { if (r != null) r.close(); } catch (Exception ignored) {}
        }
    }

    private static boolean writeBytesFile(File f, byte[] data) {
        FileOutputStream out = null;
        try {
            File parent = f.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            out = new FileOutputStream(f);
            out.write(data);
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            try { if (out != null) out.close(); } catch (Exception ignored) {}
        }
    }

    private static File uniqueSaveFile(File dir, String filename) {
        File f = new File(dir, filename);
        if (!f.exists()) return f;
        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        String ext = dot > 0 ? filename.substring(dot) : "";
        for (int i = 1; i < 10000; i++) {
            f = new File(dir, base + " (" + i + ")" + ext);
            if (!f.exists()) return f;
        }
        return f;
    }

    private static void zipDir(File dir, String prefix, ZipOutputStream zos) throws Exception {
        File[] kids = dir.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            if (k.isDirectory()) {
                zipDir(k, prefix + "/" + k.getName(), zos);
            } else {
                ZipEntry e = new ZipEntry(prefix + "/" + k.getName());
                zos.putNextEntry(e);
                FileInputStream in = new FileInputStream(k);
                try {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) zos.write(buf, 0, n);
                } finally {
                    in.close();
                    zos.closeEntry();
                }
            }
        }
    }

    /* ---------------- синхронизация данных между версиями ----------------
       Обе версии приложения не видят каталоги друг друга, поэтому обмен
       идёт через один файл в папке, выбранной пользователем (SAF).
       Доступ к папке сохраняется между запусками. */

    private static final int SYNC_REQ = 4301;
    private static final String SYNC_FILE = "questplayer-sync.zip";

    private Uri syncTree() {
        String s = prefs().getString("sync_tree", "");
        if (s == null || s.length() == 0) return null;
        return Uri.parse(s);
    }

    private String syncTreeName() {
        String s = prefs().getString("sync_tree_name", "");
        return s == null ? "" : s;
    }

    private void toastShort(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) {}
            }
        });
    }

    private void launchSyncPicker() {
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            startActivityForResult(i, SYNC_REQ);
        } catch (Exception e) {
            toastShort("Нет выбора папки: " + e.getMessage());
        }
    }

    private String treeName(Uri tree) {
        Cursor c = null;
        try {
            Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree,
                    DocumentsContract.getTreeDocumentId(tree));
            c = getContentResolver().query(doc,
                    new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && n.length() > 0) return n;
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return "";
    }

    /* Документ файла синхронизации в выбранной папке (или null). */
    private Uri syncDocUri() {
        Uri tree = syncTree();
        if (tree == null) return null;
        Cursor c = null;
        try {
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree,
                    DocumentsContract.getTreeDocumentId(tree));
            c = getContentResolver().query(children,
                    new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                            DocumentsContract.Document.COLUMN_DISPLAY_NAME},
                    null, null, null);
            if (c == null) return null;
            while (c.moveToNext()) {
                String name = c.getString(1);
                if (SYNC_FILE.equals(name)) {
                    return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    private Uri writeSyncFile(byte[] data) throws Exception {
        Uri tree = syncTree();
        if (tree == null) return null;
        Uri old = syncDocUri();
        if (old != null) {
            try { DocumentsContract.deleteDocument(getContentResolver(), old); } catch (Exception ignored) {}
        }
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree,
                DocumentsContract.getTreeDocumentId(tree));
        Uri created = DocumentsContract.createDocument(getContentResolver(), parent,
                "application/zip", SYNC_FILE);
        if (created == null) return null;
        OutputStream out = getContentResolver().openOutputStream(created);
        if (out == null) return null;
        try {
            out.write(data);
            out.flush();
        } finally {
            out.close();
        }
        return created;
    }

    private static byte[] readAllBytes(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    /* Есть ли у игры свои быстрые кнопки (ui.json с непустым items). */
    private static boolean hasQuickButtons(File f) {
        String raw = readTextFile(f);
        if (raw == null) return false;
        raw = raw.trim();
        if (raw.length() == 0 || "null".equals(raw)) return false;
        try {
            JSONObject ob = new JSONObject(raw);
            JSONArray items = ob.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.optJSONObject(i);
                    if (it == null) continue;
                    String cmd = it.optString("cmd", "");
                    if (cmd.length() == 0) cmd = it.optString("command", "");
                    if (cmd.length() == 0) cmd = it.optString("text", "");
                    if (cmd.length() > 0) return true;
                }
                return items.length() > 0;
            }
        } catch (Exception ignored) {}
        try {
            JSONArray a = new JSONArray(raw);
            return a.length() > 0;
        } catch (Exception ignored) {}
        return false;
    }

    /* ---------------------- native input panel ---------------------- */

    private Dialog inputDialog;
    private EditText inputEdit;

    private LinearLayout buildInputPanel() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setBackgroundColor(Color.rgb(24, 24, 32));
        row.setPadding(16, 12, 16, 12);
        row.setGravity(Gravity.CENTER_VERTICAL);

        inputEdit = new EditText(this);
        inputEdit.setSingleLine(true);
        inputEdit.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        inputEdit.setHint("Введите команду");
        inputEdit.setTextColor(Color.rgb(237, 237, 242));
        inputEdit.setHintTextColor(Color.rgb(140, 140, 152));
        row.addView(inputEdit, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        Button close = new Button(this);
        close.setText("✕");
        close.setAllCaps(false);
        row.addView(close);
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { dismissInputPanel(); }
        });

        Button send = new Button(this);
        send.setText("Отправить");
        send.setAllCaps(false);
        row.addView(send);
        send.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { submitInputFromPanel(); }
        });
        inputEdit.setOnEditorActionListener(new android.widget.TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(android.widget.TextView v, int actionId,
                                          android.view.KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_SEND
                        || actionId == EditorInfo.IME_ACTION_DONE
                        || actionId == EditorInfo.IME_ACTION_GO
                        || (event != null && event.getKeyCode() == android.view.KeyEvent.KEYCODE_ENTER)) {
                    submitInputFromPanel();
                    return true;
                }
                return false;
            }
        });
        return row;
    }

    private void showInputUi() {
        appendLog("native showInputUi");
        try {
            /* Панель — отдельное окно поверх WebView со своим полем ввода.
               Сжимается только она: страница игры не меняет размер. */
            if (inputDialog != null && inputDialog.isShowing()) {
                if (inputEdit != null) {
                    inputEdit.requestFocus();
                    inputEdit.setSelection(inputEdit.getText().length());
                }
                showIme();
                return;
            }

            final Dialog d = new Dialog(this);
            d.requestWindowFeature(Window.FEATURE_NO_TITLE);
            d.setContentView(buildInputPanel());
            d.setCanceledOnTouchOutside(false);
            Window w = d.getWindow();
            if (w != null) {
                w.setBackgroundDrawable(new ColorDrawable(Color.rgb(24, 24, 32)));
                /* Касания вне панели (по игре) проходят дальше и не закрывают её. */
                w.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.width = WindowManager.LayoutParams.MATCH_PARENT;
                lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
                lp.gravity = Gravity.BOTTOM;
                lp.dimAmount = 0f;
                w.setAttributes(lp);
                w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                        | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
            }
            inputDialog = d;
            d.setOnDismissListener(new android.content.DialogInterface.OnDismissListener() {
                @Override
                public void onDismiss(android.content.DialogInterface di) {
                    hideImeSoft();
                    inputDialog = null;
                    inputEdit = null;
                    if (web != null) {
                        try { web.requestFocus(); } catch (Exception ignored) {}
                    }
                }
            });
            d.show();
            if (inputEdit != null) {
                inputEdit.requestFocus();
                inputEdit.setSelection(inputEdit.getText().length());
            }
            showIme();
        } catch (Exception ignored) {
        }
    }

    private void showIme() {
        appendLog("native showIme");
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                android.view.WindowInsetsController c =
                        inputEdit.getWindowInsetsController();
                if (c != null) {
                    c.show(android.view.WindowInsets.Type.ime());
                    return;
                }
            }
        } catch (Exception ignored) {}
        try {
            android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null && inputEdit != null) {
                imm.showSoftInput(inputEdit, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
            }
        } catch (Exception ignored) {}
    }

    private void hideImeSoft() {
        try {
            android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null && inputEdit != null) {
                imm.hideSoftInputFromWindow(inputEdit.getWindowToken(), 0);
            }
        } catch (Exception ignored) {}
    }

    private void submitInputFromPanel() {
        if (inputEdit == null) return;
        String text = inputEdit.getText().toString();
        appendLog("native submit len=" + text.length());
        if (text.length() == 0) return;
        inputEdit.setText("");
        if (web != null) {
            try {
                web.evaluateJavascript("window.__tqSubmitFromNative(" + JSONObject.quote(text) + ")",
                        null);
            } catch (Exception ignored) {}
        }
        /* Команда ушла — закрываем панель, чтобы был виден ответ игры. */
        dismissInputPanel();
    }

    private void dismissInputPanel() {
        try {
            if (inputDialog != null && inputDialog.isShowing()) inputDialog.dismiss();
        } catch (Exception ignored) {}
        inputDialog = null;
        inputEdit = null;
        try {
            android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null && web != null) {
                imm.hideSoftInputFromWindow(web.getWindowToken(), 0);
            }
        } catch (Exception ignored) {}
        if (web != null) {
            try {
                web.evaluateJavascript(
                        "try{if(window.__tqKbTarget){var e=window.__tqKbTarget;window.__tqKbTarget=null;if(e.blur)e.blur();}" +
                        "try{document.activeElement&&document.activeElement.blur();}catch(x){}}catch(x){}",
                        null);
            } catch (Exception ignored) {}
            try { web.requestFocus(); } catch (Exception ignored) {}
        }
    }

    /* ---------------------- input diagnostics ---------------------- */

    private java.io.File logFile() {
        java.io.File dir = null;
        try { dir = getExternalFilesDir("logs"); } catch (Exception ignored) {}
        if (dir == null) dir = getFilesDir();
        return new java.io.File(dir, "input.log");
    }

    private synchronized void appendLog(String line) {
        try {
            java.io.File f = logFile();
            if (f.length() > 300000) f.delete();
            java.io.FileWriter w = new java.io.FileWriter(f, true);
            try {
                w.write(line == null ? "\n" : line + "\n");
            } finally {
                w.close();
            }
        } catch (Exception ignored) {}
    }

    private String readLogText() {
        try {
            java.io.File f = logFile();
            if (!f.exists()) return "";
            int n = (int) f.length();
            byte[] b = new byte[n];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            try {
                int off = 0;
                while (off < n) {
                    int r = in.read(b, off, n - off);
                    if (r <= 0) break;
                    off += r;
                }
            } finally {
                in.close();
            }
            return new String(b, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    public class Bridge {
        @JavascriptInterface
        public String getPickedUri() {
            return pendingUri == null ? "" : pendingUri;
        }

        /* Запоминает путь к последней игре. Сам файл не копируется. */
        @JavascriptInterface
        public void saveLastGame(String uri, String name, final String gameId) {
            String src = (uri != null && uri.length() > 0) ? uri : pendingUri;
            String useName = (name != null && name.length() > 0) ? name : (pendingName == null ? "" : pendingName);
            String gid = gameId == null ? "" : gameId;
            if (src == null || src.length() == 0) {
                /* Восстановление после автооткрытия: путь уже в prefs. */
                if (prefs().getString("last_uri", "").length() > 0) {
                    prefs().edit().putString("last_name", useName).putString("last_gameId", gid).apply();
                }
                return;
            }
            prefs().edit()
                    .putString("last_uri", src)
                    .putString("last_name", useName)
                    .putString("last_gameId", gid)
                    .apply();
        }

        @JavascriptInterface
        public String getLastGame() {
            try {
                String uri = prefs().getString("last_uri", "");
                if (uri == null || uri.length() == 0) return null;
                JSONObject o = new JSONObject();
                o.put("uri", uri);
                o.put("name", prefs().getString("last_name", ""));
                o.put("gameId", prefs().getString("last_gameId", ""));
                return o.toString();
            } catch (Exception e) {
                return null;
            }
        }

        /* Читает игру по сохранённому пути. Нет файла/доступа — null. */
        @JavascriptInterface
        public String readFileByUri(String uri) {
            if (uri == null || uri.length() == 0) return null;
            InputStream in = null;
            java.io.ByteArrayOutputStream out = null;
            try {
                in = getContentResolver().openInputStream(Uri.parse(uri));
                if (in == null) return null;
                out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                int total = 0;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > 256 * 1024 * 1024) return null;
                    out.write(buf, 0, n);
                }
                if (total < 12) return null;
                return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            } finally {
                try { if (in != null) in.close(); } catch (Exception ignored) {}
                try { if (out != null) out.close(); } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public String listGamesData() {
            JSONArray arr = new JSONArray();
            try {
                File[] dirs = gamesRoot().listFiles();
                if (dirs == null) return arr.toString();
                List<JSONObject> items = new ArrayList<JSONObject>();
                for (File d : dirs) {
                    if (!d.isDirectory()) continue;
                    String gid = d.getName();
                    JSONObject m = null;
                    try {
                        String raw = readTextFile(new File(d, "meta.json"));
                        if (raw != null) m = new JSONObject(raw);
                    } catch (Exception ignored) {}
                    String name = "";
                    long lastUsed = d.lastModified();
                    if (m != null) {
                        String custom = m.optString("customName", "");
                        String title = m.optString("title", "");
                        String orig = m.optString("originalFilename", "");
                        if (custom.length() > 0) name = custom;
                        else if (title.length() > 0) name = title;
                        else if (orig.length() > 0) name = orig;
                        long lu = m.optLong("lastUsed", 0);
                        if (lu > 0) lastUsed = lu;
                    }
                    if (name.length() == 0) {
                        name = "Игра " + (gid.length() > 6 ? gid.substring(0, 6) : gid);
                    }
                    JSONObject o = new JSONObject();
                    o.put("gameId", gid);
                    o.put("name", name);
                    o.put("size", sizeOf(d));
                    o.put("lastUsed", lastUsed);
                    items.add(o);
                }
                Collections.sort(items, new Comparator<JSONObject>() {
                    @Override
                    public int compare(JSONObject a, JSONObject b) {
                        long x = a.optLong("lastUsed", 0);
                        long y = b.optLong("lastUsed", 0);
                        return x == y ? 0 : (y > x ? 1 : -1);
                    }
                });
                for (JSONObject o : items) arr.put(o);
            } catch (Exception ignored) {}
            return arr.toString();
        }

        @JavascriptInterface
        public void deleteSaves(String gameId) {
            File d = gameDir(gameId);
            if (d != null) deleteRec(new File(d, "saves"));
        }

        @JavascriptInterface
        public void deleteOther(String gameId) {
            File d = gameDir(gameId);
            if (d == null) return;
            File[] kids = d.listFiles();
            if (kids == null) return;
            for (File k : kids) {
                if (!"saves".equals(k.getName())) deleteRec(k);
            }
        }

        /* Один и тот же сейв мог попасть в две папки из-за разных id
           (старый hex-идентификатор и подпись Quixe). Сливаем в одну. */
        @JavascriptInterface
        public boolean mergeGameData(String fromId, String toId) {
            try {
                File from = gameDir(fromId);
                File to = gameDir(toId);
                if (from == null || to == null) return false;
                if (from.getAbsolutePath().equals(to.getAbsolutePath())) return false;
                if (!from.isDirectory()) return false;
                if (!to.exists()) to.mkdirs();
                mergeInto(from, to);
                deleteRec(from);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String listSaves(String gameId) {
            JSONArray arr = new JSONArray();
            File d = gameDir(gameId);
            if (d == null) return arr.toString();
            File dir = new File(d, "saves");
            File[] files = dir.listFiles();
            if (files == null) return arr.toString();
            List<JSONObject> items = new ArrayList<JSONObject>();
            for (File f : files) {
                if (!f.isFile()) continue;
                try {
                    JSONObject o = new JSONObject();
                    o.put("name", f.getName());
                    o.put("size", f.length());
                    o.put("modified", f.lastModified());
                    items.add(o);
                } catch (Exception ignored) {}
            }
            Collections.sort(items, new Comparator<JSONObject>() {
                @Override
                public int compare(JSONObject a, JSONObject b) {
                    long x = a.optLong("modified", 0);
                    long y = b.optLong("modified", 0);
                    return x == y ? 0 : (y > x ? 1 : -1);
                }
            });
            for (JSONObject o : items) arr.put(o);
            return arr.toString();
        }

        @JavascriptInterface
        public String readSave(String gameId, String name) {
            File d = gameDir(gameId);
            if (d == null) return null;
            File f = new File(new File(d, "saves"), safeFile(name));
            if (!f.isFile()) return null;
            try {
                InputStream in = new FileInputStream(f);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                } finally {
                    in.close();
                }
                return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public boolean writeSave(String gameId, String name, String b64) {
            File d = gameDir(gameId);
            if (d == null) return false;
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                File dir = new File(d, "saves");
                return writeBytesFile(new File(dir, safeFile(name)), data);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String readAux(String gameId, String name) {
            File d = gameDir(gameId);
            if (d == null) return null;
            return readTextFile(new File(d, safeFile(name)));
        }

        @JavascriptInterface
        public boolean writeAux(String gameId, String name, String b64) {
            File d = gameDir(gameId);
            if (d == null) return false;
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                File saves = new File(d, "saves");
                if (!saves.exists()) saves.mkdirs();
                return writeBytesFile(new File(d, safeFile(name)), data);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String exportGameArchive(String gameId) {
            File d = gameDir(gameId);
            if (d == null || !d.isDirectory()) return null;
            try {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ZipOutputStream zos = new ZipOutputStream(bos);
                zipDir(d, d.getName(), zos);
                zos.close();
                return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public String importGameArchive(String b64, boolean overwriteOther) {
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(data));
                String gameId = null;
                ZipEntry e;
                while ((e = zis.getNextEntry()) != null) {
                    String nm = e.getName() == null ? "" : e.getName().replace('\\', '/');
                    if (nm.length() == 0 || nm.endsWith("/")) continue;
                    int slash = nm.indexOf('/');
                    if (slash <= 0) continue;
                    String gid = safeId(nm.substring(0, slash));
                    if (gid.length() == 0) continue;
                    if (gameId == null) gameId = gid;
                    if (!gid.equals(gameId)) continue;
                    String rel = nm.substring(slash + 1);
                    if (rel.length() == 0 || rel.contains("..")) continue;
                    File d = gameDir(gid);
                    if (d == null) continue;
                    File target;
                    if (rel.startsWith("saves/")) {
                        String fn = safeFile(rel.substring(6).replace("/", "_"));
                        File saves = new File(d, "saves");
                        target = uniqueSaveFile(saves, fn);
                    } else {
                        String fn = safeFile(rel.replace("/", "_"));
                        target = new File(d, fn);
                        /* ui.json — настройки игры (быстрые кнопки): всегда
                           восстанавливаем из архива, иначе импорт бесполезен. */
                        if (target.exists() && !overwriteOther && !"ui.json".equals(fn)) continue;
                    }
                    File parent = target.getParentFile();
                    if (parent != null && !parent.exists()) parent.mkdirs();
                    OutputStream out = new FileOutputStream(target);
                    try {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = zis.read(buf)) > 0) out.write(buf, 0, n);
                    } finally {
                        out.close();
                    }
                }
                if (gameId == null) return null;
                File gdir = gameDir(gameId);
                if (gdir != null) new File(gdir, "saves").mkdirs();
                JSONObject o = new JSONObject();
                o.put("gameId", gameId);
                return o.toString();
            } catch (Exception e) {
                return null;
            }
        }

        /* ---------- обмен данными с другой версией приложения ---------- */

        @JavascriptInterface
        public String syncFolder() {
            try {
                JSONObject o = new JSONObject();
                o.put("set", syncTree() != null);
                o.put("name", syncTreeName());
                return o.toString();
            } catch (Exception e) {
                return "{\"set\":false,\"name\":\"\"}";
            }
        }

        @JavascriptInterface
        public void chooseSyncFolder() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { launchSyncPicker(); }
            });
        }

        /* Выгружает все данные игр одним архивом в выбранную папку. */
        @JavascriptInterface
        public String syncToFolder() {
            JSONObject o = new JSONObject();
            try {
                if (syncTree() == null) {
                    o.put("ok", false);
                    o.put("needFolder", true);
                    return o.toString();
                }
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ZipOutputStream zos = new ZipOutputStream(bos);
                int games = 0;
                File[] kids = gamesRoot().listFiles();
                if (kids != null) {
                    for (File d : kids) {
                        if (!d.isDirectory()) continue;
                        zipDir(d, "games/" + d.getName(), zos);
                        games++;
                    }
                }
                zos.close();
                byte[] data = bos.toByteArray();
                Uri target = writeSyncFile(data);
                if (target == null) {
                    o.put("ok", false);
                    o.put("error", "write");
                    return o.toString();
                }
                o.put("ok", true);
                o.put("games", games);
                o.put("bytes", data.length);
                o.put("folder", syncTreeName());
                return o.toString();
            } catch (Exception e) {
                try {
                    o.put("ok", false);
                    o.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {}
                return o.toString();
            }
        }

        /* Забирает архив из папки. Правила:
           сейвы  — с припиской номера при конфликте (одинаковые пропускаем);
           прочее — замещается данными из архива;
           ui.json — остаётся свой, если в нём уже есть кнопки. */
        @JavascriptInterface
        public String syncFromFolder() {
            JSONObject o = new JSONObject();
            try {
                if (syncTree() == null) {
                    o.put("ok", false);
                    o.put("needFolder", true);
                    return o.toString();
                }
                Uri doc = syncDocUri();
                if (doc == null) {
                    o.put("ok", false);
                    o.put("noFile", true);
                    return o.toString();
                }
                InputStream raw = getContentResolver().openInputStream(doc);
                if (raw == null) {
                    o.put("ok", false);
                    o.put("error", "open");
                    return o.toString();
                }
                java.util.LinkedHashSet<String> games = new java.util.LinkedHashSet<String>();
                int saves = 0, files = 0, keepUi = 0, same = 0;
                ZipInputStream zis = new ZipInputStream(new BufferedInputStream(raw));
                try {
                    ZipEntry e;
                    while ((e = zis.getNextEntry()) != null) {
                        String nm = e.getName() == null ? "" : e.getName().replace('\\', '/');
                        if (nm.length() == 0 || nm.endsWith("/")) continue;
                        if (!nm.startsWith("games/")) continue;
                        String rest = nm.substring(6);
                        int slash = rest.indexOf('/');
                        if (slash <= 0) continue;
                        String gid = safeId(rest.substring(0, slash));
                        String rel = rest.substring(slash + 1);
                        if (gid.length() == 0 || rel.length() == 0 || rel.contains("..")) continue;
                        File d = gameDir(gid);
                        if (d == null) continue;
                        if (!d.exists()) d.mkdirs();
                        byte[] data = readAllBytes(zis);
                        if (rel.startsWith("saves/")) {
                            String fn = safeFile(rel.substring(6).replace("/", "_"));
                            File sd = new File(d, "saves");
                            if (!sd.exists()) sd.mkdirs();
                            File target = new File(sd, fn);
                            if (target.exists()) {
                                if (java.util.Arrays.equals(readAllBytes(new FileInputStream(target)), data)) {
                                    same++;
                                    games.add(gid);
                                    continue;
                                }
                                target = uniqueSaveFile(sd, fn);
                            }
                            if (writeBytesFile(target, data)) {
                                saves++;
                                games.add(gid);
                            }
                            continue;
                        }
                        String fn = safeFile(rel.replace("/", "_"));
                        File target = new File(d, fn);
                        if ("ui.json".equals(fn) && hasQuickButtons(target)) {
                            keepUi++;
                            games.add(gid);
                            continue;
                        }
                        if (writeBytesFile(target, data)) {
                            files++;
                            games.add(gid);
                        }
                    }
                } finally {
                    try { zis.close(); } catch (Exception ignored) {}
                }
                o.put("ok", true);
                o.put("games", games.size());
                o.put("saves", saves);
                o.put("files", files);
                o.put("keepUi", keepUi);
                o.put("same", same);
                return o.toString();
            } catch (Exception e) {
                try {
                    o.put("ok", false);
                    o.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {}
                return o.toString();
            }
        }

        @JavascriptInterface
        public void showInputPanel() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { showInputUi(); }
            });
        }

        /* Системная клавиатура для HTML-поля страницы (строка команд).
           Поле уже в фокусе — просто просим IME показаться. */
        @JavascriptInterface
        public void showKeyboard() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        appendLog("native showKeyboard");
                        android.view.inputmethod.InputMethodManager imm =
                                (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                        if (imm != null && web != null) {
                            imm.showSoftInput(web, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void hideKeyboard() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.view.inputmethod.InputMethodManager imm =
                                (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                        if (imm != null && web != null) {
                            imm.hideSoftInputFromWindow(web.getWindowToken(), 0);
                        }
                        appendLog("native hideKeyboard");
                    } catch (Exception ignored) {}
                }
            });
        }

        /* ---------- журнал ввода: пишем в файл, отдаём из панели ---------- */

        @JavascriptInterface
        public void logLine(String line) {
            appendLog(line);
        }

        @JavascriptInterface
        public String readLog() {
            return readLogText();
        }

        @JavascriptInterface
        public void clearLog() {
            try { logFile().delete(); } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void saveLog() {
            try {
                String text = readLogText();
                if (text.length() == 0) text = "(empty log)\n";
                String path = writeDownload("questplayer-log.log", text.getBytes("UTF-8"));
                final String msg = "Лог сохранён: " + path;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception e) {
                final String msg = "Не удалось сохранить лог: " + e.getMessage();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public void shareLog() {
            try {
                String text = readLogText();
                if (text.length() == 0) text = "(empty log)\n";
                if (text.length() > 900000) text = text.substring(text.length() - 900000);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, "QuestPlayer input log");
                send.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, "Отправить лог"));
            } catch (Exception e) {
                final String msg = "Не удалось отправить лог: " + e.getMessage();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public void hideInputPanel() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { dismissInputPanel(); }
            });
        }

        @JavascriptInterface
        public void saveBase64(String name, String b64) {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String path = writeDownload(name, bytes);
                final String msg = "Saved to Downloads: " + path;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception e) {
                final String msg = "Could not save file: " + e.getMessage();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        /* Ориентация управляется нативно: WebView игнорирует
           screen.orientation.lock(), поэтому фиксируем её на уровне Activity.
           PORTRAIT/LANDSCAPE не допускают перевёрнутый режим. */
        @JavascriptInterface
        public void setOrientation(final String mode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if ("portrait".equals(mode)) {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                        } else if ("landscape".equals(mode)) {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
                        } else {
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        finishAndRemoveTask();
                    } catch (Exception e) {
                        finish();
                    }
                }
            });
        }
    }

    private String writeDownload(String name, byte[] bytes) throws Exception {
        String safe = safeName(name);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
            String low = safe.toLowerCase(Locale.US);
            v.put(MediaStore.Downloads.MIME_TYPE,
                    (low.endsWith(".log") || low.endsWith(".txt"))
                            ? "text/plain" : "application/octet-stream");
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new Exception("no Downloads entry");
            OutputStream out = getContentResolver().openOutputStream(uri);
            if (out == null) throw new Exception("no output stream");
            try {
                out.write(bytes);
                out.flush();
            } finally {
                out.close();
            }
            v.clear();
            v.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, v, null, null);
            return Environment.DIRECTORY_DOWNLOADS + "/" + safe;
        }

        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists()) dir.mkdirs();
        File f = new File(dir, safe);
        if (f.exists()) {
            String base = safe;
            String ext = "";
            int dot = safe.lastIndexOf('.');
            if (dot > 0) {
                base = safe.substring(0, dot);
                ext = safe.substring(dot);
            }
            f = new File(dir, base + "-" + System.currentTimeMillis() + ext);
        }
        FileOutputStream out = new FileOutputStream(f);
        try {
            out.write(bytes);
            out.flush();
        } finally {
            out.close();
        }
        return Environment.DIRECTORY_DOWNLOADS + "/" + f.getName();
    }

    private String safeName(String name) {
        String n = name == null ? "save" : name;
        int slash = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
        if (slash >= 0) n = n.substring(slash + 1);
        n = n.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
        if (n.length() == 0) n = "save";
        String lower = n.toLowerCase(Locale.US);
        /* Лог — обычный текстовый файл, расширение .sav ему не нужно. */
        if (!lower.endsWith(".sav") && !lower.endsWith(".glksave") && !lower.endsWith(".qpsaves")
                && !lower.endsWith(".log") && !lower.endsWith(".txt")) {
            n += ".sav";
        }
        return n;
    }
}
