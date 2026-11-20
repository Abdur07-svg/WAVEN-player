package com.waven.musicplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.view.KeyEvent;

public class MediaActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        if ("com.waven.musicplayer.ACTION_TOGGLE".equals(action)) {
            if (MainActivity.getInstance() != null) {
                MainActivity.getInstance().togglePlayPause();
            }
        } else if ("com.waven.musicplayer.ACTION_NEXT".equals(action)) {
            if (MainActivity.getInstance() != null) {
                MainActivity.getInstance().playNextTrack();
            }
        } else if ("com.waven.musicplayer.ACTION_PREV".equals(action)) {
            if (MainActivity.getInstance() != null) {
                MainActivity.getInstance().playPreviousTrack();
            }
        } else if ("com.waven.musicplayer.ACTION_CLOSE".equals(action)) {
            WavenPlaybackService.stopService(context);
            if (MainActivity.getInstance() != null) {
                MainActivity.getInstance().onPlaybackStopped();
            }
        } else if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
            if (event != null && event.getAction() == KeyEvent.ACTION_DOWN) {
                switch (event.getKeyCode()) {
                    case KeyEvent.KEYCODE_HEADSETHOOK:
                    case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                        if (MainActivity.getInstance() != null) MainActivity.getInstance().togglePlayPause();
                        break;
                    case KeyEvent.KEYCODE_MEDIA_PLAY:
                        if (MainActivity.getInstance() != null) MainActivity.getInstance().resumePlayback();
                        break;
                    case KeyEvent.KEYCODE_MEDIA_PAUSE:
                        if (MainActivity.getInstance() != null) MainActivity.getInstance().pausePlayback();
                        break;
                    case KeyEvent.KEYCODE_MEDIA_NEXT:
                        if (MainActivity.getInstance() != null) MainActivity.getInstance().playNextTrack();
                        break;
                    case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                        if (MainActivity.getInstance() != null) MainActivity.getInstance().playPreviousTrack();
                        break;
                }
            }
        }
    }
}
