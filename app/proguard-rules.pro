# The page calls the bridge's methods by name.
-keepclassmembers class dev.glidian.homedeck.Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
