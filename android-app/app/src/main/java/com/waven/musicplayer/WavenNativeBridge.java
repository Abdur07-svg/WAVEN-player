package com.waven.musicplayer;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import org.json.JSONObject;

public class WavenNativeBridge {
    private final MainActivity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile String lastScannedTracksJson = "[]";

    public WavenNativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public String getAppVersion() {
        return "1.0.3";
    }

    @JavascriptInterface
    public int getVersionCode() {
        return 4;
    }

    @JavascriptInterface
    public boolean hasAudioPermissions() {
        return activity.hasAudioPermission();
    }

    @JavascriptInterface
    public void requestAudioPermissions() {
        activity.requestAudioPermissions();
    }

    @JavascriptInterface
    public String getLastScannedAudio() {
        return lastScannedTracksJson;
    }

    @JavascriptInterface
    public String scanAndGetDeviceAudio() {
        if (!activity.hasAudioPermission()) {
            activity.requestAudioPermissions();
            return "[]";
        }
        lastScannedTracksJson = AudioScanner.scanLocalMusic(activity);
        return lastScannedTracksJson;
    }

    @JavascriptInterface
    public void scanDeviceAudio() {
        if (!activity.hasAudioPermission()) {
            activity.requestAudioPermissions();
            activity.sendJsMessage("if(window.onDeviceAudioScanError) window.onDeviceAudioScanError('Storage permission required. Please allow audio access.');");
            return;
        }

        new Thread(() -> {
            try {
                String tracksJson = AudioScanner.scanLocalMusic(activity);
                lastScannedTracksJson = tracksJson;
                mainHandler.post(() -> {
                    // Safe invocation passing the Java string safely via the Bridge method
                    activity.sendJsMessage("if(window.onDeviceAudioScanned){ window.onDeviceAudioScanned(window.AndroidBridge.getLastScannedAudio()); }");
                });
            } catch (Exception e) {
                e.printStackTrace();
                final String err = e.getMessage() != null ? e.getMessage() : "Unknown scanning error";
                mainHandler.post(() -> {
                    activity.sendJsMessage("if(window.onDeviceAudioScanError) window.onDeviceAudioScanError('" + err.replace("'", "\\'") + "');");
                });
            }
        }).start();
    }

    @JavascriptInterface
    public void playTrack(String trackJsonStr) {
        try {
            JSONObject obj = new JSONObject(trackJsonStr);
            String title = obj.optString("title", "Track");
            String artist = obj.optString("artist", "Artist");
            String uri = obj.optString("uri", "");
            boolean isAsset = obj.optBoolean("isAsset", false);

            Intent intent = new Intent(activity, WavenPlaybackService.class);
            intent.setAction(WavenPlaybackService.ACTION_PLAY_TRACK);
            intent.putExtra(WavenPlaybackService.EXTRA_TRACK_TITLE, title);
            intent.putExtra(WavenPlaybackService.EXTRA_TRACK_ARTIST, artist);
            intent.putExtra(WavenPlaybackService.EXTRA_TRACK_URI, uri);
            intent.putExtra(WavenPlaybackService.EXTRA_IS_ASSET, isAsset);

            activity.startService(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void togglePlayPause() {
        Intent intent = new Intent(activity, WavenPlaybackService.class);
        intent.setAction(WavenPlaybackService.ACTION_TOGGLE_PLAY);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void pauseAudio() {
        Intent intent = new Intent(activity, WavenPlaybackService.class);
        intent.setAction(WavenPlaybackService.ACTION_PAUSE);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void resumeAudio() {
        Intent intent = new Intent(activity, WavenPlaybackService.class);
        intent.setAction(WavenPlaybackService.ACTION_RESUME);
        activity.startService(intent);
    }

    @JavascriptInterface
    public void seekTo(int positionMs) {
        Intent intent = new Intent(activity, WavenPlaybackService.class);
        intent.setAction(WavenPlaybackService.ACTION_SEEK);
        intent.putExtra(WavenPlaybackService.EXTRA_SEEK_POS, positionMs);
        activity.startService(intent);
    }

    @JavascriptInterface
    public int getCurrentPosition() {
        WavenPlaybackService svc = WavenPlaybackService.getInstance();
        return svc != null ? svc.getCurrentPosition() : 0;
    }

    @JavascriptInterface
    public int getDuration() {
        WavenPlaybackService svc = WavenPlaybackService.getInstance();
        return svc != null ? svc.getDuration() : 0;
    }

    @JavascriptInterface
    public boolean isPlaying() {
        WavenPlaybackService svc = WavenPlaybackService.getInstance();
        return svc != null && svc.isPlaying();
    }

    @JavascriptInterface
    public void openAppSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", activity.getPackageName(), null));
            activity.startActivity(intent);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void showToast(String message) {
        mainHandler.post(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }
}
