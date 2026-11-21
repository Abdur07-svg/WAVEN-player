package com.waven.musicplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class WavenPlaybackService extends Service implements
        MediaPlayer.OnCompletionListener,
        MediaPlayer.OnErrorListener,
        MediaPlayer.OnPreparedListener,
        AudioManager.OnAudioFocusChangeListener {

    public static final String ACTION_PLAY_TRACK = "com.waven.musicplayer.action.PLAY_TRACK";
    public static final String ACTION_TOGGLE_PLAY = "com.waven.musicplayer.action.TOGGLE";
    public static final String ACTION_PAUSE = "com.waven.musicplayer.action.PAUSE";
    public static final String ACTION_RESUME = "com.waven.musicplayer.action.RESUME";
    public static final String ACTION_STOP = "com.waven.musicplayer.action.STOP";
    public static final String ACTION_SEEK = "com.waven.musicplayer.action.SEEK";

    public static final String EXTRA_TRACK_TITLE = "extra_title";
    public static final String EXTRA_TRACK_ARTIST = "extra_artist";
    public static final String EXTRA_TRACK_URI = "extra_uri";
    public static final String EXTRA_IS_ASSET = "extra_is_asset";
    public static final String EXTRA_SEEK_POS = "extra_seek_pos";

    private static final String CHANNEL_ID = "waven_playback_channel";
    private static final int NOTIF_ID = 2026;

    private static volatile WavenPlaybackService instance = null;
    private MediaPlayer mediaPlayer;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private PowerManager.WakeLock wakeLock;

    private String currentTitle = "WAVEN Music";
    private String currentArtist = "Nocturne Pulse";
    private String currentUri = "";
    private boolean isCurrentAsset = false;
    private boolean isPlaybackPrepared = false;
    private boolean isBecomingNoisyRegistered = false;

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                pausePlayback();
                if (MainActivity.getInstance() != null) {
                    MainActivity.getInstance().pausePlayback();
                }
            }
        }
    };

    public static WavenPlaybackService getInstance() {
        return instance;
    }

    public static void stopService(Context context) {
        Intent intent = new Intent(context, WavenPlaybackService.class);
        intent.setAction(ACTION_STOP);
        context.stopService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "waven:playbackWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        initMediaSession();
        createNotificationChannel();
        registerBecomingNoisy();
    }

    private void initMediaSession() {
        mediaSession = new MediaSession(this, "WavenMediaSession");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                resumePlayback();
                if (MainActivity.getInstance() != null) MainActivity.getInstance().resumePlayback();
            }

            @Override
            public void onPause() {
                pausePlayback();
                if (MainActivity.getInstance() != null) MainActivity.getInstance().pausePlayback();
            }

            @Override
            public void onSkipToNext() {
                if (MainActivity.getInstance() != null) MainActivity.getInstance().playNextTrack();
            }

            @Override
            public void onSkipToPrevious() {
                if (MainActivity.getInstance() != null) MainActivity.getInstance().playPreviousTrack();
            }

            @Override
            public void onSeekTo(long pos) {
                seekPlayback((int) pos);
            }

            @Override
            public void onStop() {
                stopForeground(true);
                stopSelf();
            }
        });

        PlaybackState state = new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
                        PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP)
                .setState(PlaybackState.STATE_NONE, 0, 1.0f)
                .build();
        mediaSession.setPlaybackState(state);
        mediaSession.setActive(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "WAVEN Playback",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Background audio controls for WAVEN");
                channel.setShowBadge(false);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void registerBecomingNoisy() {
        if (!isBecomingNoisyRegistered) {
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            registerReceiver(becomingNoisyReceiver, filter);
            isBecomingNoisyRegistered = true;
        }
    }

    private void unregisterBecomingNoisy() {
        if (isBecomingNoisyRegistered) {
            try {
                unregisterReceiver(becomingNoisyReceiver);
            } catch (Exception ignored) {}
            isBecomingNoisyRegistered = false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_PLAY_TRACK.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TRACK_TITLE);
            String artist = intent.getStringExtra(EXTRA_TRACK_ARTIST);
            String uriStr = intent.getStringExtra(EXTRA_TRACK_URI);
            boolean isAsset = intent.getBooleanExtra(EXTRA_IS_ASSET, false);
            playNewTrack(title, artist, uriStr, isAsset);
        } else if (ACTION_TOGGLE_PLAY.equals(action)) {
            togglePlayback();
        } else if (ACTION_PAUSE.equals(action)) {
            pausePlayback();
        } else if (ACTION_RESUME.equals(action)) {
            resumePlayback();
        } else if (ACTION_SEEK.equals(action)) {
            int pos = intent.getIntExtra(EXTRA_SEEK_POS, 0);
            seekPlayback(pos);
        } else if (ACTION_STOP.equals(action)) {
            stopPlayback();
        }

        return START_NOT_STICKY;
    }

    private synchronized void playNewTrack(String title, String artist, String uriStr, boolean isAsset) {
        this.currentTitle = (title != null && !title.isEmpty()) ? title : "WAVEN Track";
        this.currentArtist = (artist != null && !artist.isEmpty()) ? artist : "WAVEN Artist";
        this.currentUri = uriStr;
        this.isCurrentAsset = isAsset;

        if (mediaPlayer != null) {
            try {
                mediaPlayer.reset();
            } catch (Exception e) {
                mediaPlayer.release();
                mediaPlayer = null;
            }
        }

        if (mediaPlayer == null) {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setOnCompletionListener(this);
            mediaPlayer.setOnErrorListener(this);
            mediaPlayer.setOnPreparedListener(this);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build());
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC);
            }
        }

        isPlaybackPrepared = false;

        try {
            if (requestAudioFocus()) {
                if (isAsset) {
                    AssetFileDescriptor afd = getAssets().openFd(uriStr);
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    afd.close();
                } else {
                    if (uriStr.startsWith("content://")) {
                        mediaPlayer.setDataSource(getApplicationContext(), Uri.parse(uriStr));
                    } else if (uriStr.startsWith("file://")) {
                        mediaPlayer.setDataSource(Uri.parse(uriStr).getPath());
                    } else {
                        mediaPlayer.setDataSource(uriStr);
                    }
                }
                mediaPlayer.prepareAsync();
            }
        } catch (Exception e) {
            e.printStackTrace();
            isPlaybackPrepared = false;
        }
    }

    @Override
    public void onPrepared(MediaPlayer mp) {
        isPlaybackPrepared = true;
        mp.start();
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(12 * 60 * 60 * 1000L);
        }
        updatePlaybackState(PlaybackState.STATE_PLAYING);
        showNotification(true);

        if (MainActivity.getInstance() != null) {
            MainActivity.getInstance().onTrackPrepared(mp.getDuration());
        }
    }

    public synchronized void togglePlayback() {
        if (mediaPlayer != null && isPlaybackPrepared) {
            if (mediaPlayer.isPlaying()) {
                pausePlayback();
            } else {
                resumePlayback();
            }
        }
    }

    public synchronized void pausePlayback() {
        if (mediaPlayer != null && isPlaybackPrepared && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            updatePlaybackState(PlaybackState.STATE_PAUSED);
            showNotification(false);
            if (MainActivity.getInstance() != null) {
                MainActivity.getInstance().onPlaybackStateChanged(false, mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
            }
        }
    }

    public synchronized void resumePlayback() {
        if (mediaPlayer != null && isPlaybackPrepared && !mediaPlayer.isPlaying()) {
            if (requestAudioFocus()) {
                mediaPlayer.start();
                if (wakeLock != null && !wakeLock.isHeld()) {
                    wakeLock.acquire(12 * 60 * 60 * 1000L);
                }
                updatePlaybackState(PlaybackState.STATE_PLAYING);
                showNotification(true);
                if (MainActivity.getInstance() != null) {
                    MainActivity.getInstance().onPlaybackStateChanged(true, mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
                }
            }
        }
    }

    public synchronized void seekPlayback(int positionMs) {
        if (mediaPlayer != null && isPlaybackPrepared) {
            mediaPlayer.seekTo(positionMs);
            updatePlaybackState(mediaPlayer.isPlaying() ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED);
        }
    }

    public synchronized void stopPlayback() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.reset();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        isPlaybackPrepared = false;
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        abandonAudioFocus();
        updatePlaybackState(PlaybackState.STATE_STOPPED);
        stopForeground(true);
        stopSelf();
    }

    public boolean isPlaying() {
        return mediaPlayer != null && isPlaybackPrepared && mediaPlayer.isPlaying();
    }

    public int getCurrentPosition() {
        return (mediaPlayer != null && isPlaybackPrepared) ? mediaPlayer.getCurrentPosition() : 0;
    }

    public int getDuration() {
        return (mediaPlayer != null && isPlaybackPrepared) ? mediaPlayer.getDuration() : 0;
    }

    private void updatePlaybackState(int state) {
        if (mediaSession != null) {
            long pos = (mediaPlayer != null && isPlaybackPrepared) ? mediaPlayer.getCurrentPosition() : 0;
            PlaybackState.Builder b = new PlaybackState.Builder()
                    .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
                            PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                            PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP)
                    .setState(state, pos, 1.0f);
            mediaSession.setPlaybackState(b.build());
        }
    }

    private void showNotification(boolean isPlaying) {
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pContent = PendingIntent.getActivity(this, 0, contentIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent prevIntent = new Intent("com.waven.musicplayer.ACTION_PREV");
        PendingIntent pPrev = PendingIntent.getBroadcast(this, 1, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent toggleIntent = new Intent("com.waven.musicplayer.ACTION_TOGGLE");
        PendingIntent pToggle = PendingIntent.getBroadcast(this, 2, toggleIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent nextIntent = new Intent("com.waven.musicplayer.ACTION_NEXT");
        PendingIntent pNext = PendingIntent.getBroadcast(this, 3, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent closeIntent = new Intent("com.waven.musicplayer.ACTION_CLOSE");
        PendingIntent pClose = PendingIntent.getBroadcast(this, 4, closeIntent, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        Bitmap largeIcon = generateAppNotificationBitmap();

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setSmallIcon(android.R.drawable.ic_media_play)
                .setLargeIcon(largeIcon)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setContentIntent(pContent)
                .setDeleteIntent(pClose)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Previous", pPrev).build())
                .addAction(new Notification.Action.Builder(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "Pause" : "Play", pToggle).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Next", pNext).build());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setStyle(new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }

    private Bitmap generateAppNotificationBitmap() {
        try {
            Bitmap b = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            Paint p = new Paint();
            p.setColor(0xFF131318);
            c.drawRect(new Rect(0, 0, 128, 128), p);

            Paint pAccent = new Paint();
            pAccent.setColor(0xFFCCF22E);
            pAccent.setAntiAlias(true);
            c.drawCircle(64, 64, 44, pAccent);

            Paint pIcon = new Paint();
            pIcon.setColor(0xFF0E0E13);
            pIcon.setAntiAlias(true);
            pIcon.setTextSize(36);
            pIcon.setTextAlign(Paint.Align.CENTER);
            c.drawText("W", 64, 76, pIcon);

            return b;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean requestAudioFocus() {
        if (audioManager == null) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(this)
                    .build();
            int res = audioManager.requestAudioFocus(audioFocusRequest);
            return res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } else {
            int res = audioManager.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            return res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(this);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                pausePlayback();
                if (MainActivity.getInstance() != null) MainActivity.getInstance().pausePlayback();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                if (mediaPlayer != null && isPlaybackPrepared) {
                    mediaPlayer.setVolume(0.2f, 0.2f);
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                if (mediaPlayer != null && isPlaybackPrepared) {
                    mediaPlayer.setVolume(1.0f, 1.0f);
                    resumePlayback();
                    if (MainActivity.getInstance() != null) MainActivity.getInstance().resumePlayback();
                }
                break;
        }
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        updatePlaybackState(PlaybackState.STATE_PAUSED);
        if (MainActivity.getInstance() != null) {
            MainActivity.getInstance().onTrackCompleted();
        }
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        isPlaybackPrepared = false;
        return false;
    }

    @Override
    public void onDestroy() {
        stopPlayback();
        unregisterBecomingNoisy();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
