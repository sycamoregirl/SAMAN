package com.saman.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;
    private static final int REQUEST_STORAGE = 1001;

    private File getSyncDir() {
        File dir = new File(Environment.getExternalStorageDirectory(), "SAMAN/sync");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public class SyncBridge {
        @JavascriptInterface
        public String readSyncFile(String filename) {
            try {
                File f = new File(getSyncDir(), filename);
                if (!f.exists()) return "";
                FileInputStream fis = new FileInputStream(f);
                byte[] data = new byte[(int) f.length()];
                fis.read(data);
                fis.close();
                return new String(data, StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean writeSyncFile(String filename, String content) {
            try {
                File f = new File(getSyncDir(), filename);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.close();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String writeDownloadsFile(String filename, String content) {
            try {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, filename);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.close();
                return f.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public long getSyncFileTime(String filename) {
            File f = new File(getSyncDir(), filename);
            if (!f.exists()) return 0;
            return f.lastModified();
        }

        @JavascriptInterface
        public String getSyncDirPath() {
            return getSyncDir().getAbsolutePath();
        }

        @JavascriptInterface
        public boolean syncFileExists(String filename) {
            return new File(getSyncDir(), filename).exists();
        }

        @JavascriptInterface
        public String listSyncFiles() {
            File dir = getSyncDir();
            File[] files = dir.listFiles();
            if (files == null) return "[]";
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (File f : files) {
                if (f.getName().startsWith("SAMAN_") && f.getName().endsWith(".json")) {
                    if (!first) sb.append(",");
                    sb.append("\"").append(f.getName()).append("\"");
                    first = false;
                }
            }
            sb.append("]");
            return sb.toString();
        }

        @JavascriptInterface
        public long getFileSize(String filename) {
            File f = new File(getSyncDir(), filename);
            if (!f.exists()) return 0;
            return f.length();
        }

        @JavascriptInterface
        public boolean isStorageAccessible() {
            File dir = getSyncDir();
            return dir.exists();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        webView = new WebView(this);
        setContentView(webView);

        webView.addJavascriptInterface(new SyncBridge(), "SyncBridge");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setMediaPlaybackRequiresUserGesture(false);

        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        settings.setSupportMultipleWindows(false);
        settings.setBlockNetworkImage(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setBackgroundColor(0xFF2D0808);

        webView.clearCache(true);

        requestStoragePermission();

        webView.loadUrl("file:///android_asset/index.html");
    }

    private void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= 30) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, REQUEST_STORAGE);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, REQUEST_STORAGE);
                }
            }
        } else if (Build.VERSION.SDK_INT >= 23) {
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_STORAGE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
