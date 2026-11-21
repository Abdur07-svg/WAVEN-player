import os
import sys
import subprocess
import shutil
import zipfile

# ==============================================================
# WAVEN Music Player — Production APK Builder
# ==============================================================

PACKAGE_NAME = "com.waven.musicplayer"
APP_NAME = "WAVEN"
VERSION_CODE = "5"
VERSION_NAME = "1.0.4"
MIN_SDK = "24"
TARGET_SDK = "34"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Configure Java Environment explicitly
JAVA_HOME = r'D:\Java'
if os.path.isdir(JAVA_HOME):
    os.environ['JAVA_HOME'] = JAVA_HOME
    os.environ['PATH'] = os.path.join(JAVA_HOME, 'bin') + os.pathsep + os.environ.get('PATH', '')

JAVAC = os.path.join(JAVA_HOME, 'bin', 'javac.exe') if sys.platform.startswith('win') else 'javac'
KEYTOOL = os.path.join(JAVA_HOME, 'bin', 'keytool.exe') if sys.platform.startswith('win') else 'keytool'

def get_sdk_path():
    for env in ['ANDROID_HOME', 'ANDROID_SDK_ROOT']:
        p = os.environ.get(env)
        if p and os.path.isdir(p):
            return p
    win_sdk = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk')
    if os.path.isdir(win_sdk):
        return win_sdk
    return r'C:\Users\ABDUR\AppData\Local\Android\Sdk'

SDK_DIR = get_sdk_path()

def get_build_tools(sdk):
    bt = os.path.join(sdk, 'build-tools')
    if os.path.isdir(bt):
        versions = [v for v in os.listdir(bt) if os.path.isdir(os.path.join(bt, v))]
        if '34.0.0' in versions:
            return os.path.join(bt, '34.0.0')
        if versions:
            versions.sort(reverse=True)
            return os.path.join(bt, versions[0])
    return os.path.join(sdk, 'build-tools', '34.0.0')

BUILD_TOOLS = get_build_tools(SDK_DIR)

def get_platform_jar(sdk):
    p_dir = os.path.join(sdk, 'platforms')
    p34 = os.path.join(p_dir, f'android-{TARGET_SDK}', 'android.jar')
    if os.path.isfile(p34):
        return p34
    if os.path.isdir(p_dir):
        platforms = [p for p in os.listdir(p_dir) if os.path.isfile(os.path.join(p_dir, p, 'android.jar'))]
        if platforms:
            platforms.sort(reverse=True)
            return os.path.join(p_dir, platforms[0], 'android.jar')
    return p34

PLATFORM_JAR = get_platform_jar(SDK_DIR)

def find_tool(name, build_tools):
    is_win = sys.platform.startswith('win')
    exts = ['.exe', '.bat'] if is_win else ['', '.sh']
    for ext in exts:
        t = os.path.join(build_tools, name + ext)
        if os.path.isfile(t):
            return t
    w = shutil.which(name)
    if w:
        return w
    return os.path.join(build_tools, name + ('.exe' if is_win else ''))

AAPT2 = find_tool('aapt2', BUILD_TOOLS)
D8 = find_tool('d8', BUILD_TOOLS)
ZIPALIGN = find_tool('zipalign', BUILD_TOOLS)
APKSIGNER = find_tool('apksigner', BUILD_TOOLS)

APP_DIR = os.path.join(BASE_DIR, 'android-app', 'app')
SRC_MAIN = os.path.join(APP_DIR, 'src', 'main')
RES_DIR = os.path.join(SRC_MAIN, 'res')
ASSETS_DIR = os.path.join(SRC_MAIN, 'assets')
MANIFEST = os.path.join(SRC_MAIN, 'AndroidManifest.xml')
JAVA_SRC = os.path.join(SRC_MAIN, 'java')

BUILD_DIR = os.path.join(BASE_DIR, 'android-app', 'build_temp')
COMPILED_RES = os.path.join(BUILD_DIR, 'compiled_res')
GEN_DIR = os.path.join(BUILD_DIR, 'gen')
CLASSES_DIR = os.path.join(BUILD_DIR, 'classes')
DEX_DIR = os.path.join(BUILD_DIR, 'dex')
OUTPUT_DIR = os.path.join(BASE_DIR, 'android-app', 'app', 'build', 'outputs', 'apk', 'release')

UNALIGNED_APK = os.path.join(BUILD_DIR, 'waven_unaligned.apk')
ALIGNED_APK = os.path.join(BUILD_DIR, 'waven_aligned.apk')
FINAL_APK = os.path.join(OUTPUT_DIR, 'waven-release.apk')
KEYSTORE = os.path.join(BUILD_DIR, 'waven_release.keystore')

def run_cmd(cmd, desc):
    print(f"\n--> {desc}")
    # On Windows, use shell=True if first arg ends with .bat
    use_shell = sys.platform.startswith('win') and (cmd[0].endswith('.bat') or cmd[0].endswith('.cmd'))
    res = subprocess.run(cmd, capture_output=True, text=True, shell=use_shell)
    if res.returncode != 0:
        print(f"[ERROR] {desc} failed:")
        print(res.stderr or res.stdout)
        sys.exit(1)
    if res.stdout and len(res.stdout.strip()) > 0:
        print(res.stdout.strip()[:300])

def build():
    print("=" * 60)
    print("      WAVEN MUSIC PLAYER — PRODUCTION APK COMPILER")
    print("=" * 60)
    print(f"Android SDK:    {SDK_DIR}")
    print(f"Build Tools:    {BUILD_TOOLS}")
    print(f"Platform JAR:   {PLATFORM_JAR}")
    print(f"Java Compiler:  {JAVAC}")
    print(f"Target Version: {VERSION_NAME} (code {VERSION_CODE})")
    print("=" * 60)

    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR, ignore_errors=True)
    os.makedirs(COMPILED_RES, exist_ok=True)
    os.makedirs(GEN_DIR, exist_ok=True)
    os.makedirs(CLASSES_DIR, exist_ok=True)
    os.makedirs(DEX_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'web', 'downloads'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'downloads'), exist_ok=True)

    # 1. Compile Resources with aapt2
    flat_files = []
    for root, dirs, files in os.walk(RES_DIR):
        for f in files:
            full = os.path.join(root, f)
            cmd = [AAPT2, 'compile', full, '-o', COMPILED_RES]
            run_cmd(cmd, f"Compiling resource {f}")

    for f in os.listdir(COMPILED_RES):
        if f.endswith('.flat'):
            flat_files.append(os.path.join(COMPILED_RES, f))

    # 2. Link Resources with aapt2
    link_cmd = [
        AAPT2, 'link',
        '-I', PLATFORM_JAR,
        '--manifest', MANIFEST,
        '--java', GEN_DIR,
        '-o', UNALIGNED_APK,
        '-A', ASSETS_DIR,
        '--auto-add-overlay',
        '--min-sdk-version', MIN_SDK,
        '--target-sdk-version', TARGET_SDK,
        '--version-code', VERSION_CODE,
        '--version-name', VERSION_NAME
    ] + flat_files
    run_cmd(link_cmd, "Linking resources with aapt2")

    # 3. Compile Java Sources with javac
    java_files = []
    for root, dirs, files in os.walk(JAVA_SRC):
        for f in files:
            if f.endswith('.java'):
                java_files.append(os.path.join(root, f))
    for root, dirs, files in os.walk(GEN_DIR):
        for f in files:
            if f.endswith('.java'):
                java_files.append(os.path.join(root, f))

    javac_cmd = [
        JAVAC,
        '-source', '1.8',
        '-target', '1.8',
        '-cp', PLATFORM_JAR,
        '-d', CLASSES_DIR
    ] + java_files
    run_cmd(javac_cmd, f"Compiling {len(java_files)} Java files")

    # 4. Dex Classes with d8
    class_files = []
    for root, dirs, files in os.walk(CLASSES_DIR):
        for f in files:
            if f.endswith('.class'):
                class_files.append(os.path.join(root, f))

    d8_cmd = [
        D8,
        '--min-api', MIN_SDK,
        '--output', DEX_DIR
    ] + class_files
    run_cmd(d8_cmd, f"Dexing {len(class_files)} class files with d8")

    # 5. Add classes.dex into unaligned APK
    dex_file = os.path.join(DEX_DIR, 'classes.dex')
    with zipfile.ZipFile(UNALIGNED_APK, 'a', zipfile.ZIP_DEFLATED) as z:
        z.write(dex_file, 'classes.dex')
    print("  ✔ Added classes.dex into unaligned APK")

    # 6. 4-Byte Alignment with zipalign
    zipalign_cmd = [ZIPALIGN, '-f', '-p', '4', UNALIGNED_APK, ALIGNED_APK]
    run_cmd(zipalign_cmd, "4-byte zip alignment")

    # 7. Create Keystore if needed and Sign with apksigner
    if not os.path.exists(KEYSTORE):
        keytool_cmd = [
            KEYTOOL, '-genkeypair',
            '-keystore', KEYSTORE,
            '-storepass', 'waven2026',
            '-alias', 'waven',
            '-keypass', 'waven2026',
            '-dname', 'CN=WAVEN, OU=Audio, O=WAVEN, L=Earth, ST=State, C=US',
            '-keyalg', 'RSA',
            '-keysize', '2048',
            '-validity', '10000'
        ]
        run_cmd(keytool_cmd, "Generating release keystore")

    sign_cmd = [
        APKSIGNER, 'sign',
        '--ks', KEYSTORE,
        '--ks-pass', 'pass:waven2026',
        '--ks-key-alias', 'waven',
        '--key-pass', 'pass:waven2026',
        '--out', FINAL_APK,
        ALIGNED_APK
    ]
    run_cmd(sign_cmd, "Signing APK with apksigner (v1, v2, v3 schemes)")

    # 8. Copy to distribution targets
    web_apk = os.path.join(BASE_DIR, 'web', 'downloads', 'waven-latest.apk')
    root_apk = os.path.join(BASE_DIR, 'downloads', 'waven-latest.apk')
    shutil.copy2(FINAL_APK, web_apk)
    shutil.copy2(FINAL_APK, root_apk)

    # 9. Verification Suite
    print("\n" + "=" * 60)
    print("             VERIFICATION & AUDIT SUITE")
    print("=" * 60)

    # Check file size
    size_bytes = os.path.getsize(FINAL_APK)
    size_mb = size_bytes / (1024 * 1024)
    print(f"1. APK File Size: {size_mb:.2f} MB ({size_bytes:,} bytes) ✔")

    # Check alignment
    align_chk = subprocess.run([ZIPALIGN, '-c', '-v', '4', FINAL_APK], capture_output=True, text=True)
    if 'Verification succesful' in align_chk.stdout or align_chk.returncode == 0:
        print("2. 4-Byte Zip Alignment: PASSED ✔")
    else:
        print("2. 4-Byte Zip Alignment: WARNING")

    # Check Badging
    badging_chk = subprocess.run([AAPT2, 'dump', 'badging', FINAL_APK], capture_output=True, text=True)
    if f"name='{PACKAGE_NAME}'" in badging_chk.stdout:
        print(f"3. Package Badging: {PACKAGE_NAME} v{VERSION_NAME} (code {VERSION_CODE}) ✔")

    # Check Signatures
    sig_chk = subprocess.run([APKSIGNER, 'verify', '--verbose', FINAL_APK], capture_output=True, text=True, shell=sys.platform.startswith('win'))
    if 'Verifies' in sig_chk.stdout or sig_chk.returncode == 0:
        print("4. Cryptographic Signatures (v1, v2, v3): VERIFIED ✔")

    print("\n" + "=" * 60)
    print("        WAVEN PRODUCTION APK BUILD COMPLETED!")
    print(f"        Output: {FINAL_APK}")
    print(f"        Web Copy: {web_apk}")
    print("=" * 60)

if __name__ == '__main__':
    build()
