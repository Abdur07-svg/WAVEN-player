package com.waven.musicplayer;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

public class AudioScanner {

    public static String scanLocalMusic(Context context) {
        JSONArray trackList = new JSONArray();
        ContentResolver resolver = context.getContentResolver();

        Uri musicUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            musicUri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        } else {
            musicUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        }

        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DATE_ADDED
        };

        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " >= 5000";
        String sortOrder = MediaStore.Audio.Media.DATE_ADDED + " DESC";

        Cursor cursor = null;
        try {
            cursor = resolver.query(musicUri, projection, selection, null, sortOrder);
            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                int albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);
                int dateCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED);

                Uri artworkUriBase = Uri.parse("content://media/external/audio/albumart");

                do {
                    long id = cursor.getLong(idCol);
                    String title = cursor.getString(titleCol);
                    String artist = cursor.getString(artistCol);
                    String album = cursor.getString(albumCol);
                    long duration = cursor.getLong(durationCol);
                    String filePath = cursor.getString(dataCol);
                    long albumId = cursor.getLong(albumIdCol);
                    long dateAdded = cursor.getLong(dateCol);

                    if (artist == null || "<unknown>".equalsIgnoreCase(artist.trim())) {
                        artist = "Unknown Artist";
                    }
                    if (album == null || "<unknown>".equalsIgnoreCase(album.trim())) {
                        album = "Unknown Album";
                    }
                    if (title == null || title.trim().isEmpty()) {
                        if (filePath != null) {
                            title = new File(filePath).getName();
                        } else {
                            title = "Track " + id;
                        }
                    }

                    Uri contentTrackUri = ContentUris.withAppendedId(musicUri, id);
                    Uri artUri = ContentUris.withAppendedId(artworkUriBase, albumId);

                    JSONObject trackObj = new JSONObject();
                    trackObj.put("id", "device_" + id);
                    trackObj.put("title", title);
                    trackObj.put("artist", artist);
                    trackObj.put("album", album);
                    trackObj.put("duration", duration);
                    trackObj.put("uri", contentTrackUri.toString());
                    trackObj.put("filePath", filePath != null ? filePath : "");
                    trackObj.put("coverArt", artUri.toString());
                    trackObj.put("dateAdded", dateAdded);
                    trackObj.put("isLocalDevice", true);

                    trackList.put(trackObj);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        return trackList.toString();
    }
}
