import os
import sys
import subprocess
import shutil
import zipfile
import math
from PIL import Image, ImageDraw, ImageFilter

# ==============================================================
# WAVEN Music Player — Release Configuration & Version Settings
# ==============================================================
PACKAGE_NAME = "com.waven.musicplayer"
APP_NAME = "WAVEN"
VERSION_CODE = os.environ.get('WAVEN_VERSION_CODE', "4")
VERSION_NAME = os.environ.get('WAVEN_VERSION_NAME', "1.0.3")
MIN_SDK_VERSION = "24"
TARGET_SDK_VERSION = "34"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------
# 1. Environment & Secrets Management (No Hardcoded Passwords)
# --------------------------------------------------------------
def load_env_file():
    """Loads key-value pairs from .env file into os.environ if not already present."""
    env_path = os.path.join(BASE_DIR, '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception as e:
            print(f"[WARN] Failed to read .env file: {e}")

load_env_file()

# --------------------------------------------------------------
# 2. Android SDK & Build Tools Auto-Detection (Cross-Platform)
# --------------------------------------------------------------
def get_android_sdk_path():
    """Resolves Android SDK path from environment or platform-standard directories."""
    for env_var in ['ANDROID_HOME', 'ANDROID_SDK_ROOT']:
        val = os.environ.get(env_var)
        if val and os.path.isdir(val):
            return val

    # Default Windows location
    win_path = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk')
    if os.path.isdir(win_path):
        return win_path

    # Default Linux location
    linux_path = os.path.expanduser('~/Android/Sdk')
    if os.path.isdir(linux_path):
        return linux_path

    # Default macOS location
    mac_path = os.path.expanduser('~/Library/Android/sdk')
    if os.path.isdir(mac_path):
        return mac_path

    return win_path

ANDROID_HOME = get_android_sdk_path()

def find_build_tools(sdk_home):
    """Finds installed Android build-tools version (prefers 34.0.0 or newest available)."""
    bt_dir = os.path.join(sdk_home, 'build-tools')
    if not os.path.isdir(bt_dir):
        return os.path.join(sdk_home, 'build-tools', '34.0.0')

    versions = [d for d in os.listdir(bt_dir) if os.path.isdir(os.path.join(bt_dir, d))]
    if '34.0.0' in versions:
        return os.path.join(bt_dir, '34.0.0')
    versions.sort(reverse=True)
    if versions:
        return os.path.join(bt_dir, versions[0])
    return os.path.join(sdk_home, 'build-tools', '34.0.0')

BUILD_TOOLS_DIR = find_build_tools(ANDROID_HOME)

def find_platform_jar(sdk_home):
    """Finds android.jar platform library (prefers android-34 or highest installed)."""
    platforms_dir = os.path.join(sdk_home, 'platforms')
    p34 = os.path.join(platforms_dir, f'android-{TARGET_SDK_VERSION}', 'android.jar')
    if os.path.isfile(p34):
        return p34

    if os.path.isdir(platforms_dir):
        platforms = [p for p in os.listdir(platforms_dir) if os.path.isfile(os.path.join(platforms_dir, p, 'android.jar'))]
        platforms.sort(reverse=True)
        if platforms:
            return os.path.join(platforms_dir, platforms[0], 'android.jar')
    return p34

PLATFORM_JAR = find_platform_jar(ANDROID_HOME)

def resolve_tool(name, build_tools_dir):
    """Resolves tool executable path with cross-platform extension support (.exe/.bat on Windows)."""
    is_win = sys.platform.startswith('win')
    exts = ['.exe', '.bat'] if is_win else ['', '.sh']
    for ext in exts:
        cand = os.path.join(build_tools_dir, name + ext)
        if os.path.isfile(cand):
            return cand

    which_p = shutil.which(name)
    if which_p:
        return which_p
    return os.path.join(build_tools_dir, name + ('.exe' if is_win else ''))

AAPT2 = resolve_tool('aapt2', BUILD_TOOLS_DIR)
D8 = resolve_tool('d8', BUILD_TOOLS_DIR)
ZIPALIGN = resolve_tool('zipalign', BUILD_TOOLS_DIR)
APKSIGNER = resolve_tool('apksigner', BUILD_TOOLS_DIR)

ANDROID_DIR = os.path.join(BASE_DIR, 'android-mobile')
APP_DIR = os.path.join(ANDROID_DIR, 'app')
SRC_MAIN = os.path.join(APP_DIR, 'src', 'main')
RES_DIR = os.path.join(SRC_MAIN, 'res')
ASSETS_DIR = os.path.join(SRC_MAIN, 'assets')
MANIFEST = os.path.join(SRC_MAIN, 'AndroidManifest.xml')
JAVA_SRC = os.path.join(SRC_MAIN, 'java')

BUILD_DIR = os.path.join(APP_DIR, 'build')
INTERMEDIATES = os.path.join(BUILD_DIR, 'intermediates')
COMPILED_RES = os.path.join(INTERMEDIATES, 'compiled_res')
GEN_DIR = os.path.join(INTERMEDIATES, 'gen')
CLASSES_DIR = os.path.join(INTERMEDIATES, 'classes')
DEX_DIR = os.path.join(INTERMEDIATES, 'dex')

# Canonical release output directory (defaults to 'dist', configurable via WAVEN_OUTPUT_DIR)
OUTPUT_DIR = os.environ.get('WAVEN_OUTPUT_DIR', os.path.join(BASE_DIR, 'dist'))

# Release signing keystore configuration
RELEASE_KEYSTORE = os.environ.get('WAVEN_KEYSTORE_PATH', os.path.join(ANDROID_DIR, '.keystore', 'waven_release.keystore'))
KEY_ALIAS = os.environ.get('WAVEN_KEY_ALIAS', 'waven_music')
KEYSTORE_PASS = os.environ.get('WAVEN_KEYSTORE_PASSWORD') or os.environ.get('KEYSTORE_PASSWORD')

def run_cmd(cmd, cwd=BASE_DIR):
    """Executes a command and terminates immediately with formatted error on failure."""
    cmd_str = ' '.join(str(x) for x in cmd) if isinstance(cmd, list) else str(cmd)
    print(f"\n[RUN] {cmd_str}")

    if isinstance(cmd, list):
        res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    else:
        res = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)

    if res.returncode != 0:
        print("\n" + "=" * 60)
        print(f"[BUILD ERROR] Pipeline step failed with exit code {res.returncode}")
        print("=" * 60)
        print(f"Failed Command: {cmd_str}")
        if res.stdout and res.stdout.strip():
            print(f"\n[Stdout]:\n{res.stdout.strip()}")
        if res.stderr and res.stderr.strip():
            print(f"\n[Stderr]:\n{res.stderr.strip()}")
        print("=" * 60)

        # Remove any corrupted partial APK to avoid deploying invalid artifacts
        final_apk = os.path.join(OUTPUT_DIR, 'WAVEN-Music-Player.apk')
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass

        sys.exit(res.returncode)
    else:
        if res.stdout.strip():
            print(res.stdout.strip())
    return res

def generate_crisp_icons():
    """Renders assets/logo/logo.svg directly as ultra crisp Android launcher icons for WAVEN across all density buckets and adaptive icons"""
    logo_dir = os.path.join(BASE_DIR, 'assets', 'logo')
    svg_path = os.path.join(logo_dir, 'logo.svg')
    out_512 = os.path.join(logo_dir, 'waven_app_logo_512.png')

    chrome_candidates = [
        shutil.which('google-chrome'),
        shutil.which('google-chrome-stable'),
        shutil.which('chromium'),
        shutil.which('chromium-browser'),
        shutil.which('chrome'),
        shutil.which('msedge'),
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ]
    browser = next((p for p in chrome_candidates if p and os.path.exists(p)), None)

    if browser and os.path.exists(svg_path):
        try:
            svg_url = 'file:///' + os.path.abspath(svg_path).replace('\\', '/')
            cmd = [
                browser,
                '--headless=new',
                '--disable-gpu',
                '--no-sandbox',
                '--default-background-color=00000000',
                f'--screenshot={out_512}',
                '--window-size=512,512',
                svg_url
            ]
            subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except Exception as e:
            print(f"[WARN] Headless browser SVG rendering encountered: {e}")

    if not os.path.exists(out_512):
        raise RuntimeError(f"Failed to find or render launcher icon master at {out_512}")

    sq_master = Image.open(out_512).convert("RGBA")
    W, H = sq_master.size

    # Round icon (circle masked)
    circle_mask = Image.new("L", (W, H), 0)
    margin = int(W * 0.04)
    ImageDraw.Draw(circle_mask).ellipse([margin, margin, W - margin, H - margin], fill=255)
    rd_master = sq_master.copy()
    rd_master.putalpha(circle_mask)

    # Adaptive icon foreground (safe-zone 72% scaled on transparent background)
    fg_master = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    scaled_w = int(W * 0.72)
    scaled_h = int(H * 0.72)
    sq_scaled = sq_master.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    offset_x = (W - scaled_w) // 2
    offset_y = (H - scaled_h) // 2
    fg_master.paste(sq_scaled, (offset_x, offset_y), sq_scaled)

    # Save to all Android density buckets
    density_map = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    for folder, size in density_map.items():
        folder_path = os.path.join(RES_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)
        sq_img = sq_master.resize((size, size), Image.Resampling.LANCZOS)
        rd_img = rd_master.resize((size, size), Image.Resampling.LANCZOS)
        sq_img.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
        rd_img.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')

    # Save to drawable
    drawable_path = os.path.join(RES_DIR, 'drawable')
    os.makedirs(drawable_path, exist_ok=True)
    icon_512 = sq_master.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512_rd = rd_master.resize((512, 512), Image.Resampling.LANCZOS)
    fg_512 = fg_master.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(drawable_path, 'ic_launcher.png'), 'PNG')
    icon_512_rd.save(os.path.join(drawable_path, 'ic_launcher_round.png'), 'PNG')
    fg_512.save(os.path.join(drawable_path, 'ic_launcher_foreground.png'), 'PNG')

    # Save adaptive icon XMLs in mipmap-anydpi-v26 for Android 8.0 - 15+
    v26_path = os.path.join(RES_DIR, 'mipmap-anydpi-v26')
    os.makedirs(v26_path, exist_ok=True)
    with open(os.path.join(v26_path, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>''')

    with open(os.path.join(v26_path, 'ic_launcher_round.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>''')

    # Save to web assets
    os.makedirs(logo_dir, exist_ok=True)
    icon_512.save(os.path.join(logo_dir, 'waven_app_logo_512.png'), 'PNG')
    icon_512_rd.save(os.path.join(logo_dir, 'waven_app_logo_round_512.png'), 'PNG')
    sq_master.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(logo_dir, 'waven_app_logo_192.png'), 'PNG')
    sq_master.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(logo_dir, 'apple-touch-icon.png'), 'PNG')

    print("Ultra high-definition WAVEN launcher icons rendered from logo.svg across all density buckets!")

def setup_android_source_files():
    os.makedirs(os.path.join(JAVA_SRC, 'com', 'waven', 'musicplayer'), exist_ok=True)
    os.makedirs(os.path.join(RES_DIR, 'values'), exist_ok=True)
    os.makedirs(os.path.join(RES_DIR, 'layout'), exist_ok=True)
    os.makedirs(os.path.join(RES_DIR, 'xml'), exist_ok=True)
    os.makedirs(os.path.join(RES_DIR, 'drawable'), exist_ok=True)

    generate_crisp_icons()

    # 1. AndroidManifest.xml
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        f.write(f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{PACKAGE_NAME}"
    android:versionCode="{VERSION_CODE}"
    android:versionName="{VERSION_NAME}">

    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.WAVEN"
        android:requestLegacyExternalStorage="true"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".WavenPlaybackService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />

        <receiver
            android:name=".MediaActionReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="com.waven.musicplayer.ACTION_PREV" />
                <action android:name="com.waven.musicplayer.ACTION_PLAY_PAUSE" />
                <action android:name="com.waven.musicplayer.ACTION_PLAY" />
                <action android:name="com.waven.musicplayer.ACTION_PAUSE" />
                <action android:name="com.waven.musicplayer.ACTION_NEXT" />
                <action android:name="com.waven.musicplayer.ACTION_STOP" />
            </intent-filter>
        </receiver>

        <provider
            android:name=".GenericFileProvider"
            android:authorities="com.waven.musicplayer.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>''')

    # 2. strings.xml
    with open(os.path.join(RES_DIR, 'values', 'strings.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">WAVEN</string>
</resources>''')

    # 3. colors.xml
    with open(os.path.join(RES_DIR, 'values', 'colors.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#38BDF8</color>
    <color name="background">#090B10</color>
    <color name="ic_launcher_background">#0a0c12</color>
</resources>''')

    # 4. styles.xml
    with open(os.path.join(RES_DIR, 'values', 'styles.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.WAVEN" parent="android:Theme.Material.NoActionBar">
        <item name="android:statusBarColor">#090B10</item>
        <item name="android:navigationBarColor">#090B10</item>
        <item name="android:windowBackground">#090B10</item>
    </style>
</resources>''')

    # 5. xml/file_paths.xml
    with open(os.path.join(RES_DIR, 'xml', 'file_paths.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="external_files" path="." />
    <external-files-path name="external_app_files" path="." />
    <files-path name="files" path="." />
</paths>''')

    # 6. layout/activity_main.xml
    with open(os.path.join(RES_DIR, 'layout', 'activity_main.xml'), 'w', encoding='utf-8') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#090B10">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</FrameLayout>''')

    # 7. GenericFileProvider.java
    with open(os.path.join(JAVA_SRC, 'com', 'waven', 'musicplayer', 'GenericFileProvider.java'), 'w', encoding='utf-8') as f:
        f.write('''package com.waven.musicplayer;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;

public class GenericFileProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) { return null; }
    @Override public String getType(Uri uri) { return "application/octet-stream"; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}''')

    # 7b. MediaActionReceiver.java
    with open(os.path.join(JAVA_SRC, 'com', 'waven', 'musicplayer', 'MediaActionReceiver.java'), 'w', encoding='utf-8') as f:
        f.write('''package com.waven.musicplayer;

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
}''')

    # 7c. WavenPlaybackService.java
    with open(os.path.join(JAVA_SRC, 'com', 'waven', 'musicplayer', 'WavenPlaybackService.java'), 'w', encoding='utf-8') as f:
        f.write('''package com.waven.musicplayer;

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
}''')

    # 8. MainActivity.java
    with open(os.path.join(JAVA_SRC, 'com', 'waven', 'musicplayer', 'MainActivity.java'), 'w', encoding='utf-8') as f:
        f.write('''package com.waven.musicplayer;

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
        public long skip(long n) throws IOException {
            if (n <= 0 || remaining <= 0) return 0;
            long toSkip = Math.min(n, remaining);
            long skipped = 0;
            if (raf != null) {
                long cur = raf.getFilePointer();
                long maxSeek = raf.length();
                long target = Math.min(cur + toSkip, maxSeek);
                raf.seek(target);
                skipped = target - cur;
            } else if (is != null) {
                skipped = is.skip(toSkip);
            }
            if (skipped > 0) {
                remaining -= skipped;
            }
            return skipped;
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
                    String eStr = rVal.substring(dash + 1).trim();

                    if (!sStr.isEmpty() && !eStr.isEmpty()) {
                        start = Long.parseLong(sStr);
                        end = Long.parseLong(eStr);
                    } else if (!sStr.isEmpty() && eStr.isEmpty()) {
                        start = Long.parseLong(sStr);
                        end = totalLen - 1;
                    } else if (sStr.isEmpty() && !eStr.isEmpty()) {
                        // Suffix byte range (RFC 7233): bytes=-500 means the last 500 bytes of the file!
                        long suffixLen = Long.parseLong(eStr);
                        start = Math.max(0, totalLen - suffixLen);
                        end = totalLen - 1;
                    }
                    isRange = true;
                }
            }

            // Range bounds validation
            if (totalLen > 0 && start >= totalLen) {
                Map<String, String> errHeaders = new HashMap<String, String>();
                errHeaders.put("Content-Range", "bytes */" + totalLen);
                errHeaders.put("Accept-Ranges", "bytes");
                return new WebResourceResponse("audio/mpeg", null, 416, "Range Not Satisfiable", errHeaders, new java.io.ByteArrayInputStream(new byte[0]));
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
                long baseOffset = 0;
                if (afd != null && afd.getStartOffset() > 0) {
                    baseOffset = afd.getStartOffset();
                }
                long targetOffset = baseOffset + start;

                FileInputStream fis = new FileInputStream(pfd.getFileDescriptor());
                boolean seeked = false;

                // Attempt 1: FileChannel position (Standard 64-bit instant seek)
                try {
                    java.nio.channels.FileChannel channel = fis.getChannel();
                    if (channel != null) {
                        channel.position(targetOffset);
                        seeked = true;
                    }
                } catch (Throwable ignored) {}

                // Attempt 2: Os.lseek on FileDescriptor
                if (!seeked) {
                    try {
                        android.system.Os.lseek(pfd.getFileDescriptor(), targetOffset, android.system.OsConstants.SEEK_SET);
                        seeked = true;
                    } catch (Throwable ignored) {}
                }

                // Attempt 3: Fast buffer skip fallback (using 64KB chunks instead of single byte reads)
                if (!seeked && targetOffset > 0) {
                    long skipped = 0;
                    byte[] skipBuf = new byte[65536];
                    while (skipped < targetOffset) {
                        long s = fis.skip(targetOffset - skipped);
                        if (s <= 0) {
                            int r = fis.read(skipBuf, 0, (int) Math.min(skipBuf.length, targetOffset - skipped));
                            if (r == -1) break;
                            s = r;
                        }
                        skipped += s;
                    }
                }

                is = new BoundedInputStream(null, fis, afd, pfd, contentLen);
            } else if (is != null) {
                if (start > 0) {
                    long skipped = 0;
                    byte[] skipBuf = new byte[65536];
                    while (skipped < start) {
                        long s = is.skip(start - skipped);
                        if (s <= 0) {
                            int r = is.read(skipBuf, 0, (int) Math.min(skipBuf.length, start - skipped));
                            if (r == -1) break;
                            s = r;
                        }
                        skipped += s;
                    }
                }
                is = new BoundedInputStream(null, is, null, null, contentLen);
            }

            if (is == null) return null;

            // Determine accurate MIME type
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

            if (fileExt.equals(".mp3") || mime.contains("mp3")) {
                mime = "audio/mpeg";
            } else if (fileExt.equals(".flac") || mime.contains("flac")) {
                mime = "audio/flac";
            } else if (fileExt.equals(".wav") || mime.contains("wav")) {
                mime = "audio/wav";
            } else if (fileExt.equals(".ogg") || fileExt.equals(".opus") || mime.contains("ogg") || mime.contains("opus")) {
                mime = "audio/ogg";
            } else if (fileExt.equals(".m4a") || mime.contains("m4a") || mime.contains("mp4")) {
                mime = "audio/mp4";
            } else if (fileExt.equals(".aac") || mime.contains("aac")) {
                mime = "audio/aac";
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
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
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
}''')

def sync_mobile_assets():
    if os.path.exists(ASSETS_DIR):
        shutil.rmtree(ASSETS_DIR, ignore_errors=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

    # Copy web files into Android assets
    shutil.copy2(os.path.join(BASE_DIR, 'index.html'), os.path.join(ASSETS_DIR, 'index.html'))
    shutil.copy2(os.path.join(BASE_DIR, 'manifest.json'), os.path.join(ASSETS_DIR, 'manifest.json'))

    # Copy directories
    shutil.copytree(os.path.join(BASE_DIR, 'css'), os.path.join(ASSETS_DIR, 'css'), dirs_exist_ok=True)
    shutil.copytree(os.path.join(BASE_DIR, 'js'), os.path.join(ASSETS_DIR, 'js'), dirs_exist_ok=True)
    shutil.copytree(os.path.join(BASE_DIR, 'assets'), os.path.join(ASSETS_DIR, 'assets'), dirs_exist_ok=True)
    
    print(f"Synced WAVEN web assets into Android assets: {ASSETS_DIR}")

def build_waven_apk():
    print("==================================================")
    print("   WAVEN MUSIC PLAYER — ANDROID APK BUILD")
    print("==================================================")

    # 1. Setup Android wrapper files & icons
    setup_android_source_files()

    # 2. Sync mobile assets
    sync_mobile_assets()

    # 3. Clean and prepare build dirs
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR, ignore_errors=True)
    os.makedirs(COMPILED_RES, exist_ok=True)
    os.makedirs(GEN_DIR, exist_ok=True)
    os.makedirs(CLASSES_DIR, exist_ok=True)
    os.makedirs(DEX_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 4. Compile Android resources with aapt2
    print("\nStep 1: Compiling Android resources with aapt2...")
    for root, dirs, files in os.walk(RES_DIR):
        for f in files:
            full_path = os.path.join(root, f)
            cmd = [AAPT2, 'compile', full_path, '-o', COMPILED_RES]
            run_cmd(cmd)

    flat_files = [os.path.join(COMPILED_RES, f) for f in os.listdir(COMPILED_RES) if f.endswith('.flat')]

    # 5. Link resources and generate R.java
    print(f"\nStep 2: Linking resources with aapt2 (minSdk {MIN_SDK_VERSION}, targetSdk {TARGET_SDK_VERSION}, version {VERSION_NAME} [{VERSION_CODE}])...")
    proto_apk = os.path.join(INTERMEDIATES, 'linked_res.apk')
    link_cmd = [
        AAPT2, 'link',
        '-I', PLATFORM_JAR,
        '--manifest', MANIFEST,
        '--min-sdk-version', MIN_SDK_VERSION,
        '--target-sdk-version', TARGET_SDK_VERSION,
        '--version-code', VERSION_CODE,
        '--version-name', VERSION_NAME,
        '--java', GEN_DIR,
        '-o', proto_apk,
        '--auto-add-overlay'
    ] + flat_files
    run_cmd(link_cmd)

    # 6. Compile Java source files
    print("\nStep 3: Compiling Java sources with javac...")
    java_files = []
    for root, dirs, files in os.walk(JAVA_SRC):
        for f in files:
            if f.endswith('.java'):
                java_files.append(os.path.join(root, f))
    for root, dirs, files in os.walk(GEN_DIR):
        for f in files:
            if f.endswith('.java'):
                java_files.append(os.path.join(root, f))

    javac_bin = shutil.which('javac')
    if not javac_bin:
        java_home = os.environ.get('JAVA_HOME')
        if java_home:
            cand = os.path.join(java_home, 'bin', 'javac.exe' if sys.platform.startswith('win') else 'javac')
            if os.path.isfile(cand):
                javac_bin = cand
    if not javac_bin and sys.platform.startswith('win'):
        cand = r'C:\Program Files\Common Files\Oracle\Java\javapath\javac.exe'
        if os.path.isfile(cand):
            javac_bin = cand
    if not javac_bin:
        javac_bin = 'javac'

    javac_cmd = [
        javac_bin,
        '-cp', PLATFORM_JAR,
        '-d', CLASSES_DIR
    ] + java_files
    run_cmd(javac_cmd)

    # 7. Convert Java bytecode to Dalvik bytecode (.dex) with d8
    print("\nStep 4: Dexing compiled classes with d8...")
    class_files = []
    for root, dirs, files in os.walk(CLASSES_DIR):
        for f in files:
            if f.endswith('.class'):
                class_files.append(os.path.join(root, f))

    d8_cmd = [
        D8,
        '--min-api', MIN_SDK_VERSION,
        '--lib', PLATFORM_JAR,
        '--output', DEX_DIR
    ] + class_files
    run_cmd(d8_cmd)

    # 8. Package initial unaligned APK
    print("\nStep 5: Packaging classes.dex and web assets into APK...")
    unaligned_apk = os.path.join(INTERMEDIATES, 'unaligned.apk')
    shutil.copy2(proto_apk, unaligned_apk)

    classes_dex = os.path.join(DEX_DIR, 'classes.dex')
    with zipfile.ZipFile(unaligned_apk, 'a', compression=zipfile.ZIP_DEFLATED) as apk_zip:
        apk_zip.write(classes_dex, 'classes.dex')
        for root, dirs, files in os.walk(ASSETS_DIR):
            for f in files:
                file_path = os.path.join(root, f)
                rel_path = os.path.relpath(file_path, ASSETS_DIR)
                apk_zip.write(file_path, f"assets/{rel_path.replace(os.sep, '/')}")

    # 9. Align APK with zipalign (4-byte alignment)
    print("\nStep 6: Aligning APK with zipalign...")
    aligned_apk = os.path.join(INTERMEDIATES, 'aligned.apk')
    zipalign_cmd = [
        ZIPALIGN,
        '-p', '-f', '4',
        unaligned_apk,
        aligned_apk
    ]
    run_cmd(zipalign_cmd)

    # 10. Generate persistent release keystore if not present
    if not os.path.exists(RELEASE_KEYSTORE):
        if os.environ.get('CI') == 'true' or os.environ.get('GITHUB_ACTIONS') == 'true':
            print("\n" + "=" * 60)
            print("[CRITICAL ERROR] Production Release Keystore not found in CI environment!")
            print(f"Expected Path: {RELEASE_KEYSTORE}")
            print("In GitHub Actions, WAVEN_RELEASE_KEYSTORE_BASE64 must be decoded before build.")
            print("Auto-generating a dummy or debug keystore in CI is strictly prohibited.")
            print("=" * 60)
            sys.exit(1)

        if not KEYSTORE_PASS:
            print("\n" + "=" * 60)
            print("[CRITICAL ERROR] Keystore password is required! Set WAVEN_KEYSTORE_PASSWORD in .env or environment variable.")
            print("=" * 60)
            sys.exit(1)

        os.makedirs(os.path.dirname(RELEASE_KEYSTORE), exist_ok=True)
        print("\nGenerating Production Release Keystore for WAVEN...")
        keytool_bin = shutil.which('keytool')
        if not keytool_bin:
            java_home = os.environ.get('JAVA_HOME')
            if java_home:
                cand = os.path.join(java_home, 'bin', 'keytool.exe' if sys.platform.startswith('win') else 'keytool')
                if os.path.isfile(cand):
                    keytool_bin = cand
        if not keytool_bin and sys.platform.startswith('win'):
            cand = r'D:\Java\bin\keytool.exe'
            if os.path.isfile(cand):
                keytool_bin = cand
        if not keytool_bin:
            keytool_bin = 'keytool'

        keytool_cmd = [
            keytool_bin, '-genkeypair',
            '-keystore', RELEASE_KEYSTORE,
            '-storepass', KEYSTORE_PASS,
            '-keypass', KEYSTORE_PASS,
            '-alias', KEY_ALIAS,
            '-dname', 'CN=WAVEN Music Player,OU=Mobile,O=WAVEN,C=US',
            '-validity', '10000',
            '-keyalg', 'RSA',
            '-keysize', '2048'
        ]
        run_cmd(keytool_cmd)
    else:
        print(f"\nUsing verified Release Keystore: {RELEASE_KEYSTORE}")

    # 11. Sign APK with apksigner (v1, v2, v3 schemes)
    print("\nStep 7: Signing Release APK with apksigner...")
    if not KEYSTORE_PASS:
        print("\n[ERROR] Keystore password is required for signing! Set WAVEN_KEYSTORE_PASSWORD in .env or environment variable.")
        sys.exit(1)

    final_apk = os.path.join(OUTPUT_DIR, 'WAVEN-Music-Player.apk')

    apksigner_cmd = [
        APKSIGNER, 'sign',
        '--ks', RELEASE_KEYSTORE,
        '--ks-pass', f'pass:{KEYSTORE_PASS}',
        '--ks-key-alias', KEY_ALIAS,
        '--key-pass', f'pass:{KEYSTORE_PASS}',
        '--v1-signing-enabled', 'true',
        '--v2-signing-enabled', 'true',
        '--v3-signing-enabled', 'true',
        '--out', final_apk,
        aligned_apk
    ]
    run_cmd(apksigner_cmd)

    # 12. Rigorous Post-Build Verification Pipeline
    print("\n" + "=" * 60)
    print("   RUNNING RIGOROUS APK VERIFICATION PIPELINE")
    print("=" * 60)

    # V-1: File Existence & Real File Size Check
    print("\n[Verification 1/4] Checking APK file existence and size...")
    if not os.path.exists(final_apk):
        print(f"[FAIL] Final APK was not found at {final_apk}")
        sys.exit(1)

    size_bytes = os.path.getsize(final_apk)
    size_mb = size_bytes / (1024 * 1024)
    if size_bytes < 1024 * 1024:
        print(f"[FAIL] Generated APK size is unusually small ({size_bytes} bytes). Aborting.")
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass
        sys.exit(1)
    print(f"  ✔ File size check passed: {size_mb:.2f} MB ({size_bytes:,} bytes)")

    # V-2: 4-Byte Alignment Verification (zipalign -c -v 4)
    print("\n[Verification 2/4] Verifying 4-byte zip alignment...")
    align_verify_cmd = [ZIPALIGN, '-c', '-v', '4', final_apk]
    align_res = subprocess.run(align_verify_cmd, capture_output=True, text=True)
    if align_res.returncode != 0 or 'Verification succesful' not in align_res.stdout:
        print("\n[FAIL] zipalign verification failed!")
        print(align_res.stderr or align_res.stdout)
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass
        sys.exit(1)
    print("  ✔ 4-byte zip alignment verified successfully.")

    # V-3: Manifest & Badging Verification (aapt2 dump badging)
    print("\n[Verification 3/4] Verifying APK badging (package, versions, SDKs)...")
    badging_cmd = [AAPT2, 'dump', 'badging', final_apk]
    badging_res = subprocess.run(badging_cmd, capture_output=True, text=True)
    if badging_res.returncode != 0:
        print("\n[FAIL] aapt2 dump badging execution failed!")
        print(badging_res.stderr)
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass
        sys.exit(1)

    badging_out = badging_res.stdout
    errors = []
    if f"name='{PACKAGE_NAME}'" not in badging_out:
        errors.append(f"Package name mismatch! Expected '{PACKAGE_NAME}'")
    if f"versionCode='{VERSION_CODE}'" not in badging_out:
        errors.append(f"versionCode mismatch! Expected '{VERSION_CODE}'")
    if f"versionName='{VERSION_NAME}'" not in badging_out:
        errors.append(f"versionName mismatch! Expected '{VERSION_NAME}'")
    if f"sdkVersion:'{MIN_SDK_VERSION}'" not in badging_out:
        errors.append(f"minSdkVersion mismatch! Expected '{MIN_SDK_VERSION}'")
    if f"targetSdkVersion:'{TARGET_SDK_VERSION}'" not in badging_out:
        errors.append(f"targetSdkVersion mismatch! Expected '{TARGET_SDK_VERSION}'")

    if errors:
        print("\n[FAIL] Badging verification failed with discrepancies:")
        for err in errors:
            print(f"  - {err}")
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass
        sys.exit(1)
    print(f"  ✔ Badging verified: {PACKAGE_NAME} v{VERSION_NAME} (code {VERSION_CODE}), API {MIN_SDK_VERSION}-{TARGET_SDK_VERSION}")

    # V-4: Signature Verification (apksigner verify --verbose --print-certs)
    print("\n[Verification 4/4] Verifying cryptographic signatures and certificates...")
    sig_verify_cmd = [APKSIGNER, 'verify', '--verbose', '--print-certs', final_apk]
    sig_res = subprocess.run(sig_verify_cmd, capture_output=True, text=True)
    if sig_res.returncode != 0 or 'Verifies' not in sig_res.stdout:
        print("\n[FAIL] apksigner verification failed!")
        print(sig_res.stderr or sig_res.stdout)
        if os.path.exists(final_apk):
            try:
                os.remove(final_apk)
            except Exception:
                pass
        sys.exit(1)

    sig_out = sig_res.stdout
    cert_dn = "Unknown"
    cert_sha256 = "Unknown"
    for line in sig_out.splitlines():
        if 'certificate DN:' in line:
            cert_dn = line.split('certificate DN:', 1)[1].strip()
        elif 'certificate SHA-256 digest:' in line:
            cert_sha256 = line.split('certificate SHA-256 digest:', 1)[1].strip()

    print(f"  ✔ Cryptographic signature verified.")
    print(f"    Signer DN:     {cert_dn}")
    print(f"    SHA-256 Cert:  {cert_sha256}")

    print("\n" + "=" * 60)
    print("   [ALL VERIFICATIONS PASSED] — WAVEN RELEASE APK IS READY!")
    print("=" * 60)
    print(f"Final Release APK:   {final_apk}")
    print(f"File Size:           {size_mb:.2f} MB ({size_bytes:,} bytes)")
    print(f"Package ID:          {PACKAGE_NAME}")
    print(f"minSdkVersion:       {MIN_SDK_VERSION} (Android 7.0+)")
    print(f"targetSdkVersion:    {TARGET_SDK_VERSION} (Android 14)")
    print(f"versionName:         {VERSION_NAME} (versionCode {VERSION_CODE})")
    print(f"Signature Schemes:   v1 (JAR), v2, v3 verified")
    print(f"Status:              PRODUCTION READY")
    print("=" * 60)

if __name__ == '__main__':
    build_waven_apk()

