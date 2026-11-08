package com.waven.musicplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class MediaActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && intent.getAction() != null) {
            if (MainActivity.instance != null) {
                MainActivity.instance.dispatchMediaAction(intent.getAction(), null);
            }
        }
    }
}