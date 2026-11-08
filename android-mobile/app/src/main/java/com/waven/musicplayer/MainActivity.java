package com.waven.musicplayer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    public static MainActivity instance = null;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 101;
    private final static int PERMISSION_REQ_CODE = 102;
    private long backPressedTime = 0;
    private volatile String lastScannedSongsJson = "[]";
    private volatile boolean isScanning = false;

    private final static String NOTIF_CHANNEL_ID = "waven_playback_channel";
    private final static int NOTIF_ID = 2026;
    public final static String ACTION_PREV = "com.waven.musicplayer.ACTION_PREV";
    public final static String ACTION_PLAY_PAUSE = "com.waven.musicplayer.ACTION_PLAY_PAUSE";
    public final static String ACTION_PLAY = "com.waven.musicplayer.ACTION_PLAY";
    public final static String ACTION_PAUSE = "com.waven.musicplayer.ACTION_PAUSE";
    public final static String ACTION_NEXT = "com.waven.musicplayer.ACTION_NEXT";
    public final static String ACTION_STOP = "com.waven.musicplayer.ACTION_STOP";
    public final static String ACTION_SEEK_TO = "com.waven.musicplayer.ACTION_SEEK_TO";

    private NotificationManager notificationManager;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean wasPlayingBeforeFocusLoss = false;
    private boolean isNoisyReceiverRegistered = false;

    private String currentTitle = "WAVEN";
    private String currentArtist = "Local Music";
    private String currentAlbum = "Local Music";
    private String currentArtworkUrl = "";
    private boolean currentIsPlaying = false;
    private long lastNotifUpdateTime = 0;

    private volatile boolean isPlayerReady = false;
    private final List<String> pendingActionQueue = new ArrayList<String>();
    private final Map<String, Long> lastActionTimes = new ConcurrentHashMap<String, Long>();
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    private static class ArtworkCache {
        private static String cachedKey = null;
        private static Bitmap cachedBitmap = null;

        public static synchronized Bitmap get(String key) {
            if (key != null && key.equals(cachedKey) && cachedBitmap != null && !cachedBitmap.isRecycled()) {
                return cachedBitmap;
            }
            return null;
        }

        public static synchronized void put(String key, Bitmap bmp) {
            cachedKey = key;
            cachedBitmap = bmp;
        }
    }

    private static class BoundedInputStream extends InputStream {
        private final java.io.RandomAccessFile raf;
        private final InputStream is;
        private final android.content.res.AssetFileDescriptor afd;
        private final android.os.ParcelFileDescriptor pfd;
        private long remaining;

        public BoundedInputStream(java.io.RandomAccessFile raf, InputStream is, android.content.res.AssetFileDescriptor afd, android.os.ParcelFileDescriptor pfd, long length) {
            this.raf = raf;
            this.is = is;
            this.afd = afd;
            this.pfd = pfd;
            this.remaining = length;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int b;
            if (raf != null) {
                b = raf.read();
            } else if (is != null) {
                b = is.read();
            } else {
                return -1;
            }
            if (b >= 0) {
                remaining--;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (b == null) throw new NullPointerException();
            if (off < 0 || len < 0 || len > b.length - off) throw new IndexOutOfBoundsException();
            if (len == 0) return 0;
            if (remaining <= 0) return -1;

            int toRead = (int) Math.min(len, remaining);
            int bytesRead;
            if (raf != null) {
                bytesRead = raf.read(b, off, toRead);
            } else if (is != null) {
                bytesRead = is.read(b, off, toRead);
            } else {
                return -1;
            }

            if (bytesRead > 0) {
                remaining -= bytesRead;
                return bytesRead;
            }
            return bytesRead;
        }

        @Override
        public int available() throws IOException {
            if (remaining <= 0) return 0;
            return (int) Math.min(remaining, 65536);
        }

        @Override
        public void close() throws IOException {
            try { if (is != null) is.close(); } catch (Exception ignored) {}
            try { if (raf != null) raf.close(); } catch (Exception ignored) {}
            try { if (afd != null) afd.close(); } catch (Exception ignored) {}
            try { if (pfd != null) pfd.close(); } catch (Exception ignored) {}
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }

        @JavascriptInterface
        public boolean isWavenApp() {
            return true;
        }

        @JavascriptInterface
        public void notifyPlayerReady() {
            onPlayerReady();
        }

        @JavascriptInterface
        public String getScannedSongs() {
            return lastScannedSongsJson != null ? lastScannedSongsJson : "[]";
        }

        @JavascriptInterface
        public void triggerDeviceScan() {
            scanDeviceMusicAsync();
        }

        @JavascriptInterface
        public void updatePlaybackState(final boolean isPlaying, final String title, final String artist, final String album, final String artworkUrl, final long durationSecs, final long currentSecs) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    processPlaybackStateUpdate(isPlaying, title, artist, album, artworkUrl, durationSecs, currentSecs);
                }
            });
        }

        @JavascriptInterface
        public void updatePlaybackState(final boolean isPlaying, final String title, final String artist, final long durationSecs, final long currentSecs) {
            updatePlaybackState(isPlaying, title, artist, "Local Music", "", durationSecs, currentSecs);
        }

        @JavascriptInterface
        public void keepScreenOn(final boolean enable) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (enable) {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    } else {
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                }
            });
        }

        @JavascriptInterface
        public void checkAndRequestAudioPermissions() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    requestAppPermissions();
                }
            });
        }

        @JavascriptInterface
        public void closeApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }
    }

    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            // Chromium WebView internally manages audio focus for HTML5 audio playback.
            // Under NO circumstance should MainActivity self-pause the WebView!
        }
    };

    private boolean requestAudioFocus() {
        // Chromium WebView handles audio focus natively for HTML5 <audio>.
        // Avoid duplicate focus requests from MainActivity to prevent self-pause loops.
        return true;
    }

    private void abandonAudioFocus() {
    }

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                dispatchMediaAction(ACTION_PAUSE, null);
            }
        }
    };

    private synchronized void registerBecomingNoisy() {
        if (!isNoisyReceiverRegistered) {
            try {
                registerReceiver(becomingNoisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
                isNoisyReceiverRegistered = true;
            } catch (Exception ignored) {}
        }
    }

    private synchronized void unregisterBecomingNoisy() {
        if (isNoisyReceiverRegistered) {
            try {
                unregisterReceiver(becomingNoisyReceiver);
            } catch (Exception ignored) {}
            isNoisyReceiverRegistered = false;
        }
    }

    public void onPlayerReady() {
        isPlayerReady = true;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (!pendingActionQueue.isEmpty() && webView != null) {
                    List<String> queued = new ArrayList<String>(pendingActionQueue);
                    pendingActionQueue.clear();
                    for (String act : queued) {
                        dispatchMediaAction(act, null);
                    }
                }
            }
        });
    }

    public void dispatchMediaAction(final String action, final Object extra) {
        if (action == null) return;
        long now = SystemClock.elapsedRealtime();
        Long lastTime = lastActionTimes.get(action);
        if (lastTime != null && (now - lastTime < 180)) {
            return;
        }
        lastActionTimes.put(action, now);

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !isPlayerReady) {
                    pendingActionQueue.add(action);
                    return;
                }

                if (ACTION_PLAY.equals(action)) {
                    requestAudioFocus();
                    webView.evaluateJavascript("if (window.player) { window.player.resume(); }", null);
                } else if (ACTION_PAUSE.equals(action)) {
                    webView.evaluateJavascript("if (window.player) { window.player.pause(); }", null);
                } else if (ACTION_PLAY_PAUSE.equals(action)) {
                    webView.evaluateJavascript("if (window.player) { window.player.togglePlay(); }", null);
                } else if (ACTION_NEXT.equals(action)) {
                    webView.evaluateJavascript("if (window.player) { window.player.next(); }", null);
                } else if (ACTION_PREV.equals(action)) {
                    webView.evaluateJavascript("if (window.player) { window.player.previous(); }", null);
                } else if (ACTION_STOP.equals(action)) {
                    webView.evaluateJavascript("if (window.player) { window.player.pause(); window.player.seek(0); }", null);
                } else if (ACTION_SEEK_TO.equals(action) && extra instanceof Long) {
                    double sec = ((Long) extra) / 1000.0;
                    webView.evaluateJavascript("if (window.player) { window.player.seek(" + sec + "); }", null);
                }
            }
        });
    }

    public void handleMediaAction(final String action) {
        dispatchMediaAction(action, null);
    }

    private void initMediaSystem() {
        try {
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    NOTIF_CHANNEL_ID,
                    "WAVEN Music Playback",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Playback controls for background music");
                channel.setShowBadge(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                notificationManager = getSystemService(NotificationManager.class);
                if (notificationManager != null) {
                    notificationManager.createNotificationChannel(channel);
                }
            } else {
                notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            }

            mediaSession = new MediaSession(this, "WAVEN");
            mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            mediaSession.setCallback(new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    dispatchMediaAction(ACTION_PLAY, null);
                }

                @Override
                public void onPause() {
                    dispatchMediaAction(ACTION_PAUSE, null);
                }

                @Override
                public void onSkipToNext() {
                    dispatchMediaAction(ACTION_NEXT, null);
                }

                @Override
                public void onSkipToPrevious() {
                    dispatchMediaAction(ACTION_PREV, null);
                }

                @Override
                public void onStop() {
                    dispatchMediaAction(ACTION_STOP, null);
                }

                @Override
                public void onSeekTo(final long pos) {
                    dispatchMediaAction(ACTION_SEEK_TO, pos);
                }

                @Override
                public boolean onMediaButtonEvent(Intent mediaButtonIntent) {
                    if (mediaButtonIntent != null && Intent.ACTION_MEDIA_BUTTON.equals(mediaButtonIntent.getAction())) {
                        android.view.KeyEvent event = mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                        if (event != null && event.getAction() == android.view.KeyEvent.ACTION_DOWN) {
                            int keyCode = event.getKeyCode();
                            switch (keyCode) {
                                case android.view.KeyEvent.KEYCODE_MEDIA_PLAY:
                                    dispatchMediaAction(ACTION_PLAY, null);
                                    return true;
                                case android.view.KeyEvent.KEYCODE_MEDIA_PAUSE:
                                    dispatchMediaAction(ACTION_PAUSE, null);
                                    return true;
                                case android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                                case android.view.KeyEvent.KEYCODE_HEADSETHOOK:
                                    dispatchMediaAction(ACTION_PLAY_PAUSE, null);
                                    return true;
                                case android.view.KeyEvent.KEYCODE_MEDIA_NEXT:
                                    dispatchMediaAction(ACTION_NEXT, null);
                                    return true;
                                case android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                                    dispatchMediaAction(ACTION_PREV, null);
                                    return true;
                                case android.view.KeyEvent.KEYCODE_MEDIA_STOP:
                                    dispatchMediaAction(ACTION_STOP, null);
                                    return true;
                            }
                        }
                    }
                    return super.onMediaButtonEvent(mediaButtonIntent);
                }
            });
            mediaSession.setActive(true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleMediaActionIntent(intent);
    }

    private void handleMediaActionIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        dispatchMediaAction(intent.getAction(), null);
    }

    private void processPlaybackStateUpdate(boolean isPlaying, String title, String artist, String album, String artworkUrl, long durationSecs, long currentSecs) {
        long now = SystemClock.elapsedRealtime();
        boolean trackChanged = (title != null && !title.equals(currentTitle)) ||
                               (artist != null && !artist.equals(currentArtist)) ||
                               (artworkUrl != null && !artworkUrl.equals(currentArtworkUrl));
        boolean stateChanged = (isPlaying != currentIsPlaying);

        if (!trackChanged && !stateChanged && (now - lastNotifUpdateTime < 200)) {
            return;
        }
        lastNotifUpdateTime = now;

        currentIsPlaying = isPlaying;
        if (title != null && !title.trim().isEmpty()) currentTitle = title;
        if (artist != null && !artist.trim().isEmpty()) currentArtist = artist;
        if (album != null && !album.trim().isEmpty()) currentAlbum = album;
        if (artworkUrl != null) currentArtworkUrl = artworkUrl;

        if (currentIsPlaying) {
            requestAudioFocus();
            registerBecomingNoisy();
        } else {
            unregisterBecomingNoisy();
        }

        final String artKey = (currentArtworkUrl != null && !currentArtworkUrl.isEmpty()) ? currentArtworkUrl : ("res_" + currentTitle);
        Bitmap cached = ArtworkCache.get(artKey);

        if (cached != null) {
            applyMediaSessionAndNotification(cached, durationSecs, currentSecs, currentIsPlaying);
        } else {
            applyMediaSessionAndNotification(getDefaultLauncherBitmap(), durationSecs, currentSecs, currentIsPlaying);

            final String targetUrl = currentArtworkUrl;
            artworkExecutor.execute(new Runnable() {
                @Override
                public void run() {
                    Bitmap decoded = decodeSafeBitmap(targetUrl);
                    if (decoded != null) {
                        ArtworkCache.put(artKey, decoded);
                        final Bitmap finalArt = decoded;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (targetUrl != null && targetUrl.equals(currentArtworkUrl)) {
                                    applyMediaSessionAndNotification(finalArt, durationSecs, currentSecs, currentIsPlaying);
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    private void applyMediaSessionAndNotification(Bitmap artBitmap, long durationSecs, long currentSecs, boolean isPlaying) {
        Bitmap art = (artBitmap != null && !artBitmap.isRecycled()) ? artBitmap : getDefaultLauncherBitmap();

        if (mediaSession != null) {
            int state = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
            float speed = isPlaying ? 1.0f : 0.0f;
            long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
                           PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT |
                           PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_STOP |
                           PlaybackState.ACTION_SEEK_TO;

            String mediaId = "waven_" + System.currentTimeMillis() + "_" + Math.abs(currentTitle.hashCode());

            MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, mediaId)
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, currentArtist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST, currentArtist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, Math.max(0, durationSecs) * 1000L);

            if (art != null) {
                metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
                metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ART, art);
                metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, art);
            }

            mediaSession.setMetadata(metaBuilder.build());

            PlaybackState.Builder stateBuilder = new PlaybackState.Builder()
                .setActions(actions)
                .setState(state, Math.max(0, currentSecs) * 1000L, speed, SystemClock.elapsedRealtime());
            mediaSession.setPlaybackState(stateBuilder.build());
            mediaSession.setActive(true);
        }

        try {
            int flag = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flag |= PendingIntent.FLAG_IMMUTABLE;
            }

            Intent prevIntent = new Intent(this, MediaActionReceiver.class).setAction(ACTION_PREV);
            PendingIntent prevPending = PendingIntent.getBroadcast(this, 1, prevIntent, flag);

            Intent playPauseIntent = new Intent(this, MediaActionReceiver.class).setAction(ACTION_PLAY_PAUSE);
            PendingIntent playPausePending = PendingIntent.getBroadcast(this, 2, playPauseIntent, flag);

            Intent nextIntent = new Intent(this, MediaActionReceiver.class).setAction(ACTION_NEXT);
            PendingIntent nextPending = PendingIntent.getBroadcast(this, 3, nextIntent, flag);

            Intent openAppIntent = new Intent(this, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent openPending = PendingIntent.getActivity(this, 0, openAppIntent, flag);

            Notification.MediaStyle mediaStyle = new Notification.MediaStyle();
            if (mediaSession != null) {
                mediaStyle.setMediaSession(mediaSession.getSessionToken());
            }
            mediaStyle.setShowActionsInCompactView(0, 1, 2);

            Notification.Builder notifBuilder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                notifBuilder = new Notification.Builder(this, NOTIF_CHANNEL_ID);
            } else {
                notifBuilder = new Notification.Builder(this);
                notifBuilder.setPriority(Notification.PRIORITY_HIGH);
            }

            int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
            String playPauseText = isPlaying ? "Pause" : "Play";

            notifBuilder.setSmallIcon(android.R.drawable.ic_media_play)
                        .setContentTitle(currentTitle)
                        .setContentText(currentArtist)
                        .setSubText(currentAlbum)
                        .setContentIntent(openPending)
                        .setStyle(mediaStyle)
                        .setOngoing(isPlaying)
                        .setOnlyAlertOnce(false)
                        .setVisibility(Notification.VISIBILITY_PUBLIC);

            if (art != null) {
                notifBuilder.setLargeIcon(art);
            }

            notifBuilder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous, "Previous", prevPending).build());

            notifBuilder.addAction(new Notification.Action.Builder(
                playPauseIcon, playPauseText, playPausePending).build());

            notifBuilder.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next, "Next", nextPending).build());

            Notification notif = notifBuilder.build();

            // CRITICAL: Always post update directly via notificationManager so the displayed title/artist changes instantly!
            if (notificationManager != null) {
                try {
                    notificationManager.notify(NOTIF_ID, notif);
                } catch (Throwable ignored) {}
            }

            if (isPlaying) {
                WavenPlaybackService.startForegroundPlayback(this, notif);
            } else {
                WavenPlaybackService.pauseForegroundPlayback(this);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Bitmap getDefaultLauncherBitmap() {
        try {
            return BitmapFactory.decodeResource(getResources(), R.drawable.ic_launcher);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Bitmap generateProceduralCoverBitmap(String title, String artist) {
        try {
            int width = 256;
            int height = 256;
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            String key = (title != null ? title : "") + " " + (artist != null ? artist : "");
            int hash = key.hashCode();

            int[][] palettes = {
                {0xFF3B82F6, 0xFF1D4ED8}, // Royal Blue
                {0xFF8B5CF6, 0xFF4C1D95}, // Violet
                {0xFF06B6D4, 0xFF0E7490}, // Cyan
                {0xFFEC4899, 0xFFBE185D}, // Berry Pink
                {0xFF10B981, 0xFF047857}, // Emerald
                {0xFFF59E0B, 0xFFB45309}, // Amber
                {0xFF6366F1, 0xFF3730A3}, // Indigo
                {0xFFEF4444, 0xFFF97316}, // Crimson Sunset
                {0xFF14B8A6, 0xFF0F766E}, // Teal
                {0xFFF43F5E, 0xFFEA580C}, // Rose Coral
                {0xFF7C3AED, 0xFF4F46E5}, // Electric Iris
                {0xFF84CC16, 0xFF10B981}  // Lime Jade
            };

            int idx = Math.abs(hash) % palettes.length;
            int c1 = palettes[idx][0];
            int c2 = palettes[idx][1];

            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setShader(new LinearGradient(0, 0, width, height, c1, c2, Shader.TileMode.CLAMP));
            canvas.drawRect(0, 0, width, height, paint);

            // Subtle vinyl rings
            paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE);
            paint.setColor(0x28FFFFFF);
            paint.setStrokeWidth(2.5f);
            canvas.drawCircle(width / 2f, height / 2f, width * 0.38f, paint);
            paint.setColor(0x18FFFFFF);
            canvas.drawCircle(width / 2f, height / 2f, width * 0.28f, paint);

            // Center circular badge
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(0x45000000);
            canvas.drawCircle(width / 2f, height / 2f, width * 0.18f, paint);

            // Musical note or initial letter
            paint.setColor(0xFFFFFFFF);
            paint.setTextSize(width * 0.20f);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextAlign(Paint.Align.CENTER);
            String initial = "♪";
            if (title != null && !title.trim().isEmpty()) {
                char ch = title.trim().charAt(0);
                if (Character.isLetterOrDigit(ch)) {
                    initial = String.valueOf(Character.toUpperCase(ch));
                }
            }
            Rect bounds = new Rect();
            paint.getTextBounds(initial, 0, initial.length(), bounds);
            float y = (height / 2f) + (bounds.height() / 2f) - bounds.bottom;
            canvas.drawText(initial, width / 2f, y, paint);

            return bitmap;
        } catch (Exception e) {
            return getDefaultLauncherBitmap();
        }
    }

    private Bitmap decodeSafeBitmap(String url) {
        if (url == null || url.trim().isEmpty()) return null;
        try {
            if (url.startsWith("https://waven.local/artwork")) {
                Uri artUri = Uri.parse(url);
                String songIdStr = artUri.getQueryParameter("id");
                String albumIdStr = artUri.getQueryParameter("albumId");
                String title = artUri.getQueryParameter("title");
                String artist = artUri.getQueryParameter("artist");

                // Android 10+ (API 29+) official hardware-accelerated MediaStore thumbnail
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && songIdStr != null) {
                    try {
                        long songId = Long.parseLong(songIdStr);
                        Uri audioUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, songId);
                        Bitmap thumb = getContentResolver().loadThumbnail(audioUri, new android.util.Size(512, 512), null);
                        if (thumb != null) return thumb;
                    } catch (Exception ignored) {}
                }

                if (albumIdStr != null) {
                    try {
                        long albumId = Long.parseLong(albumIdStr);
                        Uri contentArtUri = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId);
                        InputStream is = getContentResolver().openInputStream(contentArtUri);
                        if (is != null) {
                            Bitmap bmp = BitmapFactory.decodeStream(is);
                            is.close();
                            if (bmp != null) return bmp;
                        }
                    } catch (Exception ignored) {}
                }

                return generateProceduralCoverBitmap(title != null ? title : currentTitle, artist != null ? artist : currentArtist);
            } else if (url.startsWith("file://") || url.startsWith("/")) {
                String path = url.startsWith("file://") ? url.substring(7) : url;
                File f = new File(path);
                if (f.exists() && f.canRead()) {
                    return BitmapFactory.decodeFile(path);
                }
            }
        } catch (Exception ignored) {}
        return generateProceduralCoverBitmap(currentTitle, currentArtist);
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            List<String> perms = new ArrayList<String>();
            if (checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), PERMISSION_REQ_CODE);
            } else {
                scanDeviceMusicAsync();
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, PERMISSION_REQ_CODE);
            } else {
                scanDeviceMusicAsync();
            }
        } else {
            scanDeviceMusicAsync();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            boolean hasAudio = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                hasAudio = (checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                hasAudio = (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED);
            } else {
                hasAudio = true;
            }

            if (hasAudio) {
                scanDeviceMusicAsync();
            } else {
                if (webView != null) {
                    webView.evaluateJavascript("window.app && window.app.showToast('Please grant storage permission to load device music', 'info')", null);
                }
            }
        }
    }

    private synchronized void scanDeviceMusicAsync() {
        if (isScanning) return;
        isScanning = true;

        new Thread(new Runnable() {
            @Override
            public void run() {
                JSONArray jsonArray = new JSONArray();
                Cursor cursor = null;
                try {
                    ContentResolver resolver = getContentResolver();
                    Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    String[] projection = new String[]{
                        MediaStore.Audio.Media._ID,
                        MediaStore.Audio.Media.TITLE,
                        MediaStore.Audio.Media.ARTIST,
                        MediaStore.Audio.Media.ALBUM,
                        MediaStore.Audio.Media.DURATION,
                        MediaStore.Audio.Media.SIZE,
                        MediaStore.Audio.Media.ALBUM_ID,
                        MediaStore.Audio.Media.DATE_ADDED,
                        MediaStore.Audio.Media.DATA
                    };
                    String selection = "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0) OR ("
                                     + MediaStore.Audio.Media.DURATION + " >= 15000) OR ("
                                     + MediaStore.Audio.Media.SIZE + " >= 300000)";
                    String sortOrder = MediaStore.Audio.Media.DATE_ADDED + " DESC";

                    cursor = resolver.query(uri, projection, selection, null, sortOrder);
                    if (cursor != null) {
                        int idIdx = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                        int titleIdx = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                        int artistIdx = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                        int albumIdx = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                        int durIdx = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                        int sizeIdx = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                        int albIdIdx = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);
                        int dateIdx = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED);
                        int dataIdx = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);

                        while (cursor.moveToNext()) {
                            long id = idIdx != -1 ? cursor.getLong(idIdx) : 0;
                            String title = titleIdx != -1 ? cursor.getString(titleIdx) : "Unknown Title";
                            String artist = artistIdx != -1 ? cursor.getString(artistIdx) : "Unknown Artist";
                            String album = albumIdx != -1 ? cursor.getString(albumIdx) : "Single";
                            long durationMs = durIdx != -1 ? cursor.getLong(durIdx) : 0;
                            long size = sizeIdx != -1 ? cursor.getLong(sizeIdx) : 0;
                            long albumId = albIdIdx != -1 ? cursor.getLong(albIdIdx) : 0;
                            long dateAdded = dateIdx != -1 ? cursor.getLong(dateIdx) : 0;
                            String filePath = dataIdx != -1 ? cursor.getString(dataIdx) : "";
                            if (filePath == null) filePath = "";

                            String encodedPath = "";
                            try {
                                if (!filePath.isEmpty()) {
                                    encodedPath = java.net.URLEncoder.encode(filePath, "UTF-8");
                                }
                            } catch (Exception ignored) {}

                            if (title == null || title.trim().isEmpty()) title = "Unknown Title";
                            if (artist == null || "<unknown>".equalsIgnoreCase(artist.trim()) || artist.trim().isEmpty()) artist = "Unknown Artist";
                            if (album == null || "<unknown>".equalsIgnoreCase(album.trim()) || album.trim().isEmpty()) album = "Single";

                            JSONObject song = new JSONObject();
                            song.put("id", "loc_native_" + id);
                            song.put("nativeId", id);
                            song.put("title", title);
                            song.put("artist", artist);
                            song.put("album", album);
                            song.put("filePath", filePath);
                            song.put("duration", Math.max(1, Math.round(durationMs / 1000.0)));
                            song.put("fileSize", size);
                            song.put("sourceType", "android-media");
                            song.put("streamUrl", "https://waven.local/audio?id=" + id + (encodedPath.isEmpty() ? "" : "&path=" + encodedPath) + "&size=" + size);
                            String encTitle = "";
                            String encArtist = "";
                            try {
                                encTitle = java.net.URLEncoder.encode(title, "UTF-8");
                                encArtist = java.net.URLEncoder.encode(artist, "UTF-8");
                            } catch (Exception ignored) {}
                            song.put("artwork", "https://waven.local/artwork?id=" + id + "&albumId=" + albumId + "&title=" + encTitle + "&artist=" + encArtist);
                            song.put("hasEmbeddedArtwork", true);
                            song.put("isLocal", true);
                            song.put("formatName", "Audio");
                            song.put("addedAt", dateAdded > 0 ? dateAdded * 1000L : System.currentTimeMillis());

                            jsonArray.put(song);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    if (cursor != null) {
                        try { cursor.close(); } catch (Exception ignored) {}
                    }
                    isScanning = false;
                }

                lastScannedSongsJson = jsonArray.toString();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null) {
                            webView.evaluateJavascript("if (window.onNativeSongsScanned) { window.onNativeSongsScanned(); }", null);
                        }
                    }
                });
            }
        }).start();
    }

    private WebResourceResponse handleAudioRangeRequest(String idStr, String filePath, String sizeStr, WebResourceRequest request) {
        java.io.RandomAccessFile raf = null;
        android.content.res.AssetFileDescriptor afd = null;
        android.os.ParcelFileDescriptor pfd = null;
        InputStream is = null;
        long totalLen = -1;
        Uri contentUri = null;

        try {
            // Strategy 1: Direct File via RandomAccessFile (Fastest for accessible files)
            if (filePath != null && !filePath.isEmpty()) {
                java.io.File file = new java.io.File(filePath);
                if (file.exists() && file.canRead()) {
                    try {
                        raf = new java.io.RandomAccessFile(file, "r");
                        totalLen = raf.length();
                    } catch (Exception e) {
                        if (raf != null) { try { raf.close(); } catch (Exception ignored) {} raf = null; }
                    }
                }
            }

            // Strategy 2: MediaStore ContentResolver via AssetFileDescriptor or ParcelFileDescriptor
            if (raf == null && idStr != null && !idStr.isEmpty()) {
                try {
                    long id = Long.parseLong(idStr);
                    contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);

                    // Try openAssetFileDescriptor first
                    try {
                        afd = getContentResolver().openAssetFileDescriptor(contentUri, "r");
                        if (afd != null) {
                            totalLen = afd.getLength();
                            pfd = afd.getParcelFileDescriptor();
                        }
                    } catch (Exception ignored) {}

                    // If afd failed, try openFileDescriptor directly
                    if (pfd == null) {
                        pfd = getContentResolver().openFileDescriptor(contentUri, "r");
                        if (pfd != null) {
                            totalLen = pfd.getStatSize();
                        }
                    }

                    if (pfd != null && totalLen <= 0) {
                        try {
                            totalLen = android.system.Os.fstat(pfd.getFileDescriptor()).st_size;
                        } catch (Throwable ignored) {}
                    }
                } catch (Exception e) {
                    if (afd != null) { try { afd.close(); } catch (Exception ignored) {} afd = null; }
                    if (pfd != null) { try { pfd.close(); } catch (Exception ignored) {} pfd = null; }
                }
            }

            // Fallback totalLen from sizeStr parameter if still unknown
            if (totalLen <= 0 && sizeStr != null && !sizeStr.isEmpty()) {
                try {
                    totalLen = Long.parseLong(sizeStr);
                } catch (Exception ignored) {}
            }

            // Strategy 3: Standard ContentResolver openInputStream if raf and pfd unavailable
            if (raf == null && pfd == null && contentUri != null) {
                try {
                    InputStream rawIs = getContentResolver().openInputStream(contentUri);
                    if (rawIs != null) {
                        is = rawIs;
                        if (totalLen <= 0) totalLen = 1;
                    }
                } catch (Exception ignored) {}
            }

            if (raf == null && pfd == null && is == null) return null;
            if (totalLen <= 0) totalLen = 1;

            // Parse Range header if present
            String rangeHeader = null;
            Map<String, String> reqHeaders = request != null ? request.getRequestHeaders() : null;
            if (reqHeaders != null) {
                for (Map.Entry<String, String> e : reqHeaders.entrySet()) {
                    if ("range".equalsIgnoreCase(e.getKey())) {
                        rangeHeader = e.getValue();
                        break;
                    }
                }
            }

            long start = 0;
            long end = totalLen - 1;
            boolean isRange = false;

            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String rVal = rangeHeader.substring(6).trim();
                int dash = rVal.indexOf('-');
                if (dash != -1) {
                    String sStr = rVal.substring(0, dash).trim();
                    if (!sStr.isEmpty()) start = Long.parseLong(sStr);
                    String eStr = rVal.substring(dash + 1).trim();
                    if (!eStr.isEmpty()) end = Long.parseLong(eStr);
                    isRange = true;
                }
            }

            if (end < 0 || end >= totalLen) {
                end = totalLen - 1;
            }
            if (start < 0) start = 0;
            if (start > end) start = end;

            long contentLen = (end >= start) ? (end - start + 1) : 0;

            // Reposition stream to start
            if (raf != null) {
                raf.seek(start);
                is = new BoundedInputStream(raf, null, null, null, contentLen);
            } else if (pfd != null) {
                FileInputStream fis = null;
                boolean seekedViaOs = false;
                try {
                    android.system.Os.lseek(pfd.getFileDescriptor(), start, android.system.OsConstants.SEEK_SET);
                    seekedViaOs = true;
                } catch (Throwable ignored) {}

                if (afd != null && !seekedViaOs) {
                    fis = afd.createInputStream();
                } else {
                    fis = new FileInputStream(pfd.getFileDescriptor());
                }

                if (!seekedViaOs && start > 0) {
                    long skipped = 0;
                    while (skipped < start) {
                        long s = fis.skip(start - skipped);
                        if (s <= 0) {
                            if (fis.read() == -1) break;
                            s = 1;
                        }
                        skipped += s;
                    }
                }

                is = new BoundedInputStream(null, fis, afd, pfd, contentLen);
            } else if (is != null) {
                if (start > 0) {
                    long skipped = 0;
                    while (skipped < start) {
                        long s = is.skip(start - skipped);
                        if (s <= 0) {
                            if (is.read() == -1) break;
                            s = 1;
                        }
                        skipped += s;
                    }
                }
                is = new BoundedInputStream(null, is, null, null, contentLen);
            }

            if (is == null) return null;

            // Determine MIME type
            String mime = "audio/mpeg";
            String fileExt = "";
            if (filePath != null && filePath.contains(".")) {
                fileExt = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
            }

            if (contentUri != null) {
                try {
                    String queriedMime = getContentResolver().getType(contentUri);
                    if (queriedMime != null && !queriedMime.isEmpty()) {
                        mime = queriedMime.toLowerCase();
                    }
                } catch (Exception ignored) {}
            }

            if (mime.contains("mp3") || fileExt.equals(".mp3")) {
                mime = "audio/mpeg";
            } else if (mime.contains("flac") || fileExt.equals(".flac")) {
                mime = "audio/flac";
            } else if (mime.contains("wav") || fileExt.equals(".wav")) {
                mime = "audio/wav";
            } else if (mime.contains("ogg") || mime.contains("opus") || fileExt.equals(".ogg") || fileExt.equals(".opus")) {
                mime = "audio/ogg";
            } else if (mime.contains("mp4") || mime.contains("m4a") || mime.contains("aac") || fileExt.equals(".m4a") || fileExt.equals(".aac")) {
                mime = "audio/mp4";
            } else {
                mime = "audio/mpeg";
            }

            Map<String, String> respHeaders = new HashMap<String, String>();
            respHeaders.put("Content-Type", mime);
            respHeaders.put("Accept-Ranges", "bytes");
            respHeaders.put("Access-Control-Allow-Origin", "*");
            respHeaders.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            respHeaders.put("Access-Control-Allow-Headers", "*");
            respHeaders.put("Cache-Control", "no-cache, no-store, must-revalidate");
            respHeaders.put("Pragma", "no-cache");
            respHeaders.put("Expires", "0");
            if (contentLen > 0) {
                respHeaders.put("Content-Length", String.valueOf(contentLen));
            }

            if (request != null && request.getMethod() != null &&
                ("HEAD".equalsIgnoreCase(request.getMethod()) || "OPTIONS".equalsIgnoreCase(request.getMethod()))) {
                try { is.close(); } catch (Exception ignored) {}
                is = new java.io.ByteArrayInputStream(new byte[0]);
            }

            // CRITICAL: encoding MUST be null for binary audio streams (never pass "UTF-8"!)
            if (isRange) {
                respHeaders.put("Content-Range", "bytes " + start + "-" + end + "/" + totalLen);
                return new WebResourceResponse(mime, null, 206, "Partial Content", respHeaders, is);
            } else {
                return new WebResourceResponse(mime, null, 200, "OK", respHeaders, is);
            }
        } catch (Exception e) {
            e.printStackTrace();
            if (is != null) { try { is.close(); } catch (Exception ignored) {} }
            if (raf != null) { try { raf.close(); } catch (Exception ignored) {} }
            if (afd != null) { try { afd.close(); } catch (Exception ignored) {} }
            if (pfd != null) { try { pfd.close(); } catch (Exception ignored) {} }
            return null;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        setContentView(R.layout.activity_main);

        initMediaSystem();
        handleMediaActionIntent(getIntent());

        requestAppPermissions();

        webView = findViewById(R.id.webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("window.isAndroidAPK = true; window.isWavenNative = true; if (window.onNativeSongsScanned) { window.onNativeSongsScanned(); }", null);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    Uri uri = request.getUrl();
                    if ("waven.local".equals(uri.getHost())) {
                        String path = uri.getPath();
                        if ("/audio".equals(path)) {
                            String idStr = uri.getQueryParameter("id");
                            String pathParam = uri.getQueryParameter("path");
                            String sizeParam = uri.getQueryParameter("size");
                            WebResourceResponse res = handleAudioRangeRequest(idStr, pathParam, sizeParam, request);
                            if (res != null) return res;
                        } else if ("/artwork".equals(path)) {
                            WebResourceResponse res = handleArtworkRequest(uri);
                            if (res != null) return res;
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            private WebResourceResponse handleArtworkRequest(Uri uri) {
                if (uri == null) return null;
                String songIdStr = uri.getQueryParameter("id");
                String albumIdStr = uri.getQueryParameter("albumId");
                Bitmap bmp = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && songIdStr != null) {
                    try {
                        long songId = Long.parseLong(songIdStr);
                        Uri audioUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, songId);
                        bmp = getContentResolver().loadThumbnail(audioUri, new android.util.Size(512, 512), null);
                    } catch (Exception ignored) {}
                }
                if (bmp == null && albumIdStr != null) {
                    try {
                        long albumId = Long.parseLong(albumIdStr);
                        Uri artUri = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId);
                        InputStream is = getContentResolver().openInputStream(artUri);
                        if (is != null) {
                            Map<String, String> headers = new HashMap<String, String>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            headers.put("Content-Type", "image/jpeg");
                            return new WebResourceResponse("image/jpeg", null, 200, "OK", headers, is);
                        }
                    } catch (Exception ignored) {}
                }
                if (bmp == null) {
                    String titleParam = uri.getQueryParameter("title");
                    String artistParam = uri.getQueryParameter("artist");
                    bmp = generateProceduralCoverBitmap(titleParam != null ? titleParam : ("Track " + songIdStr), artistParam != null ? artistParam : "Local Music");
                }
                if (bmp != null) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.PNG, 90, baos);
                    ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
                    Map<String, String> headers = new HashMap<String, String>();
                    headers.put("Access-Control-Allow-Origin", "*");
                    headers.put("Content-Type", "image/png");
                    return new WebResourceResponse("image/png", null, 200, "OK", headers, bais);
                }
                return null;
            }

            @SuppressWarnings("deprecation")
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                if (url != null && url.contains("waven.local")) {
                    Uri uri = Uri.parse(url);
                    String path = uri.getPath();
                    if ("/audio".equals(path)) {
                        String idStr = uri.getQueryParameter("id");
                        String pathParam = uri.getQueryParameter("path");
                        String sizeParam = uri.getQueryParameter("size");
                        WebResourceResponse res = handleAudioRangeRequest(idStr, pathParam, sizeParam, null);
                        if (res != null) return res;
                    } else if ("/artwork".equals(path)) {
                        WebResourceResponse res = handleArtworkRequest(uri);
                        if (res != null) return res;
                    }
                }
                return super.shouldInterceptRequest(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("file:///android_asset/") || url.contains("waven.local"))) {
                    return false;
                }
                if (url != null && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                android.util.Log.d("WAVEN_JS", cm.message() + " [" + cm.sourceId() + ":" + cm.lineNumber() + "]");
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setTitle("WAVEN")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel())
                    .create()
                    .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setTitle("WAVEN")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .create()
                    .show();
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{ data.getData() };
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        unregisterBecomingNoisy();
        abandonAudioFocus();
        WavenPlaybackService.stopService(this);
        if (notificationManager != null) {
            notificationManager.cancel(NOTIF_ID);
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        artworkExecutor.shutdown();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("(function(){ if (window.immersiveManager && window.immersiveManager.isActive) { window.immersiveManager.close(); return 'immersive_closed'; } if (window.navigation && window.navigation.currentView !== 'home') { window.navigation.navigateTo('home'); return 'nav_home'; } return 'exit'; })()", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String result) {
                    if (result != null && (result.contains("immersive_closed") || result.contains("nav_home"))) {
                        return;
                    }

                    if (currentIsPlaying) {
                        moveTaskToBack(true);
                        return;
                    }

                    if (backPressedTime + 2000 > System.currentTimeMillis()) {
                        finish();
                    } else {
                        Toast.makeText(MainActivity.this, "Press back again to exit WAVEN", Toast.LENGTH_SHORT).show();
                        backPressedTime = System.currentTimeMillis();
                    }
                }
            });
            return;
        }

        if (currentIsPlaying) {
            moveTaskToBack(true);
            return;
        }

        super.onBackPressed();
    }
}