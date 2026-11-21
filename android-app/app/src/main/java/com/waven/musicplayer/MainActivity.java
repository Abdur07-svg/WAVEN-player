package com.waven.musicplayer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int PERMISSION_REQ_CODE = 101;
    private static volatile MainActivity instance = null;

    private WebView webView;
    private WavenNativeBridge nativeBridge;

    public static MainActivity getInstance() {
        return instance;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Make status & navigation bars match Nocturne Pulse dark theme
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(0xFF0E0E13);
            getWindow().setNavigationBarColor(0xFF0E0E13);
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        nativeBridge = new WavenNativeBridge(this);
        webView.addJavascriptInterface(nativeBridge, "AndroidBridge");
        webView.addJavascriptInterface(nativeBridge, "WavenNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                sendJsMessage("if(window.onNativeBridgeReady) window.onNativeBridgeReady();");
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                return super.onConsoleMessage(cm);
            }
        });

        webView.loadUrl("file:///android_asset/index.html");

        // Check and request permissions on start if needed
        if (!hasAudioPermission()) {
            requestAudioPermissions();
        }
    }

    public boolean hasAudioPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Build.VERSION.SDK_INT >= 33) { // Android 13+
                return checkSelfPermission("android.permission.READ_MEDIA_AUDIO") == PackageManager.PERMISSION_GRANTED;
            } else {
                return checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
            }
        }
        return true;
    }

    public void requestAudioPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(new String[]{
                        "android.permission.READ_MEDIA_AUDIO",
                        "android.permission.POST_NOTIFICATIONS"
                }, PERMISSION_REQ_CODE);
            } else {
                requestPermissions(new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE
                }, PERMISSION_REQ_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            if (hasAudioPermission()) {
                sendJsMessage("if(window.onPermissionsGranted) window.onPermissionsGranted();");
                if (nativeBridge != null) {
                    nativeBridge.scanDeviceAudio();
                }
            } else {
                sendJsMessage("if(window.onPermissionsDenied) window.onPermissionsDenied();");
            }
        }
    }

    public void sendJsMessage(String jsCode) {
        if (webView != null) {
            runOnUiThread(() -> webView.evaluateJavascript(jsCode, null));
        }
    }

    public void togglePlayPause() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.togglePlayPause();");
    }

    public void resumePlayback() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.resume();");
    }

    public void pausePlayback() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.pause();");
    }

    public void playNextTrack() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.playNext();");
    }

    public void playPreviousTrack() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.playPrevious();");
    }

    public void onPlaybackStopped() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.player) window.wavenApp.player.pause();");
    }

    public void onTrackPrepared(int durationMs) {
        sendJsMessage("if(window.onTrackPrepared) window.onTrackPrepared(" + durationMs + ");");
    }

    public void onPlaybackStateChanged(boolean isPlaying, int positionMs, int durationMs) {
        sendJsMessage("if(window.onNativeStateChanged) window.onNativeStateChanged(" + isPlaying + "," + positionMs + "," + durationMs + ");");
    }

    public void onTrackCompleted() {
        sendJsMessage("if(window.onTrackEnded) window.onTrackEnded();");
    }

    @Override
    public void onBackPressed() {
        sendJsMessage("if(window.wavenApp && window.wavenApp.handleBackPress && window.wavenApp.handleBackPress()){} else { history.back(); }");
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        instance = null;
        super.onDestroy();
    }
}
