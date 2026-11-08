package com.waven.musicplayer;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class WavenPlaybackService extends Service {
    public static final String ACTION_START_FOREGROUND = "com.waven.musicplayer.action.START_FOREGROUND";
    public static final String ACTION_STOP_FOREGROUND = "com.waven.musicplayer.action.STOP_FOREGROUND";
    public static final String ACTION_UPDATE_NOTIFICATION = "com.waven.musicplayer.action.UPDATE_NOTIFICATION";
    public static final String EXTRA_NOTIFICATION = "extra_notification";
    private static final int NOTIF_ID = 2026;

    public static volatile Notification currentNotification = null;
    public static volatile WavenPlaybackService instance = null;
    private static volatile boolean isServiceRunning = false;
    private PowerManager.WakeLock wakeLock = null;

    public static boolean isRunning() {
        return isServiceRunning;
    }

    public static void startForegroundPlayback(Context context, Notification notification) {
        if (notification != null) {
            currentNotification = notification;
        }
        if (context == null) return;

        // If service is already active, immediately update notification with zero latency
        if (instance != null && currentNotification != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    instance.startForeground(NOTIF_ID, currentNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    instance.startForeground(NOTIF_ID, currentNotification);
                }
                instance.acquireWakeLock();
                return;
            } catch (Throwable ignored) {}
        }

        try {
            Intent intent = new Intent(context, WavenPlaybackService.class);
            intent.setAction(ACTION_START_FOREGROUND);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void pauseForegroundPlayback(Context context) {
        try {
            if (instance != null) {
                instance.releaseWakeLock();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    instance.stopForeground(STOP_FOREGROUND_DETACH);
                } else {
                    instance.stopForeground(false);
                }
            }
        } catch (Exception ignored) {}
    }

    public static void stopService(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, WavenPlaybackService.class);
            context.stopService(intent);
        } catch (Exception ignored) {}
    }

    public void acquireWakeLock() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(12 * 60 * 60 * 1000L);
            }
        } catch (Exception ignored) {}
    }

    public void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        isServiceRunning = true;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WAVEN:PlaybackWakeLock");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        isServiceRunning = true;
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        Notification notif = currentNotification;
        if (notif == null) {
            notif = intent.getParcelableExtra(EXTRA_NOTIFICATION);
        }

        if (ACTION_START_FOREGROUND.equals(action) || ACTION_UPDATE_NOTIFICATION.equals(action)) {
            if (notif != null) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                    } else {
                        startForeground(NOTIF_ID, notif);
                    }
                } catch (Throwable t) {
                    try {
                        startForeground(NOTIF_ID, notif);
                    } catch (Throwable ignored) {}
                }
                acquireWakeLock();
            }
        } else if (ACTION_STOP_FOREGROUND.equals(action)) {
            releaseWakeLock();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_DETACH);
            } else {
                stopForeground(false);
            }
        }

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        instance = null;
        isServiceRunning = false;
        releaseWakeLock();
        try {
            stopForeground(true);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}