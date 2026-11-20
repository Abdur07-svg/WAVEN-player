# WAVEN ProGuard Rules
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.waven.musicplayer.** { *; }
