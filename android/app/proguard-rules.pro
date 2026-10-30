# StockPilot — ProGuard / R8 rules
# ---------------------------------
# Layer 12 — Anti-reverse-engineering
#
# Goals:
#   1. Obfuscate + minify all app code
#   2. Keep Capacitor plugin entry points (reflection)
#   3. Keep ML Kit + Bluetooth class signatures
#   4. Strip debug logs in release

# ----- Capacitor core -----
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.Plugin { *; }

# ----- Capacitor plugins (reflection) -----
-keep class com.capacitorjs.*.** { *; }
-keep class com.capacitorcommunity.*.** { *; }
-keep class io.capacitorjs.*.** { *; }

# ----- ML Kit barcode scanning -----
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.mlkit.**

# ----- Bluetooth serial -----
-keep class com.megster.bluetooth.** { *; }
-dontwarn com.megster.bluetooth.**

# ----- AndroidX (don't warn on missing classes) -----
-dontwarn androidx.**

# ----- Kotlin stdlib (if used by plugins) -----
-dontwarn kotlin.**

# ----- Cordova plugins (legacy) -----
-keep class org.apache.cordova.** { *; }

# ----- Strip logs in release -----
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# ----- WebView / JS bridge reflection -----
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ----- StockPilot app code (obfuscate everything; keep MainActivity) -----
-keep class com.obandetechhub.stockpilot.MainActivity { *; }

# ----- Resource classes (R) -----
-keep class **.R$* { <fields>; }
-keep class **.R { <fields>; }

# ----- Generic keep rules for serialization -----
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
