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
import java.util.HashSet;
import java.util.Set;

public class AudioScanner {

    private static final String[] AUDIO_EXTENSIONS = {
        ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma", ".mid"
    };

    public static String scanLocalMusic(Context context) {
        JSONArray trackList = new JSONArray();
        Set<String> seenPathsOrUris = new HashSet<>();
        ContentResolver resolver = context.getContentResolver();

        // 1. Primary Query on EXTERNAL_CONTENT_URI
        queryUri(resolver, MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, trackList, seenPathsOrUris, true);

        // 2. If Q+, also query VOLUME_EXTERNAL if list is still small
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && trackList.length() == 0) {
            try {
                Uri volUri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
                queryUri(resolver, volUri, trackList, seenPathsOrUris, false);
            } catch (Exception ignored) {}
        }

        // 3. Fallback: If still 0 songs found, query without any filter
        if (trackList.length() == 0) {
            queryUri(resolver, MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, trackList, seenPathsOrUris, false);
        }

        return trackList.toString();
    }

    private static void queryUri(ContentResolver resolver, Uri musicUri, JSONArray trackList, Set<String> seenPaths, boolean applyFilter) {
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

        // Permissive selection: do not strictly require IS_MUSIC=1 because many downloads/transfers lack it
        String selection = null;
        if (applyFilter) {
            selection = "(" + MediaStore.Audio.Media.IS_MUSIC + " != 0 OR " +
                        MediaStore.Audio.Media.MIME_TYPE + " LIKE 'audio/%' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.mp3' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.m4a' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.flac' OR " +
                        MediaStore.Audio.Media.DATA + " LIKE '%.wav')";
        }

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
                    long albumId = albumIdCol != -1 ? cursor.getLong(albumIdCol) : -1;
                    long dateAdded = dateCol != -1 ? cursor.getLong(dateCol) : System.currentTimeMillis() / 1000;

                    // Deduplication
                    String uniqueKey = (filePath != null && !filePath.isEmpty()) ? filePath : ("id_" + id);
                    if (seenPaths.contains(uniqueKey)) {
                        continue;
                    }

                    // Check extension if filePath exists
                    if (filePath != null && !filePath.isEmpty()) {
                        boolean isAudioExt = false;
                        String lowerPath = filePath.toLowerCase();
                        for (String ext : AUDIO_EXTENSIONS) {
                            if (lowerPath.endsWith(ext)) {
                                isAudioExt = true;
                                break;
                            }
                        }
                        // Ignore system ringtones / notifications if in system folders
                        if (lowerPath.contains("/ringtones/") || lowerPath.contains("/notifications/") || lowerPath.contains("/alarms/")) {
                            continue;
                        }
                    }

                    if (artist == null || "<unknown>".equalsIgnoreCase(artist.trim()) || artist.trim().isEmpty()) {
                        artist = "Unknown Artist";
                    }
                    if (album == null || "<unknown>".equalsIgnoreCase(album.trim()) || album.trim().isEmpty()) {
                        album = "Local Audio";
                    }
                    if (title == null || title.trim().isEmpty() || "<unknown>".equalsIgnoreCase(title.trim())) {
                        if (filePath != null && !filePath.isEmpty()) {
                            title = new File(filePath).getName();
                            // strip extension
                            int dotIdx = title.lastIndexOf('.');
                            if (dotIdx > 0) {
                                title = title.substring(0, dotIdx);
                            }
                        } else {
                            title = "Track " + id;
                        }
                    }

                    Uri contentTrackUri = ContentUris.withAppendedId(musicUri, id);
                    String coverArtUrl = "assets/covers/default_cover.png";
                    if (albumId > 0) {
                        coverArtUrl = ContentUris.withAppendedId(artworkUriBase, albumId).toString();
                    }

                    // If duration is 0 or unindexed, default to 180 seconds or approximate
                    if (duration <= 0) {
                        duration = 180000;
                    }

                    JSONObject trackObj = new JSONObject();
                    trackObj.put("id", "device_" + id);
                    trackObj.put("title", title);
                    trackObj.put("artist", artist);
                    trackObj.put("album", album);
                    trackObj.put("duration", duration);
                    trackObj.put("uri", contentTrackUri.toString());
                    trackObj.put("filePath", filePath != null ? filePath : "");
                    trackObj.put("coverArt", coverArtUrl);
                    trackObj.put("dateAdded", dateAdded);
                    trackObj.put("isLocalDevice", true);
                    trackObj.put("genre", "Local Audio");
                    trackObj.put("hires", true);

                    trackList.put(trackObj);
                    seenPaths.add(uniqueKey);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }
}
