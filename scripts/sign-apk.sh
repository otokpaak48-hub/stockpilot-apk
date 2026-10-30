#!/usr/bin/env bash
# StockPilot — Sign APK script
# ============================
# Signs the release APK using the keystore in android/keystore.properties.
#
# Pre-requisites:
#   1. Generated a keystore:
#        keytool -genkey -v -keystore android/stockpilot.keystore -alias stockpilot \
#          -keyalg RSA -keysize 2048 -validity 36500 \
#          -dname "CN=ObandeTechHub, O=ObandeTechHub, L=Lagos, C=NG"
#   2. Created android/keystore.properties (from .example) with the keystore password
#
# Usage:
#   bash scripts/sign-apk.sh
set -e

cd "$(dirname "$0")/.."
cd android

KEYSTORE_PROPS="keystore.properties"
if [ ! -f "$KEYSTORE_PROPS" ]; then
  echo "[StockPilot] ❌ keystore.properties not found."
  echo "             Copy keystore.properties.example to keystore.properties"
  echo "             and fill in your keystore credentials."
  exit 1
fi

# Read keystore properties
source <(grep -E '^[a-zA-Z]' "$KEYSTORE_PROPS" | sed 's/^/export /')

INPUT_APK="app/build/outputs/apk/release/app-release-unsigned.apk"
OUTPUT_APK="app/build/outputs/apk/release/StockPilot-v$(grep versionName app/build.gradle | head -1 | sed 's/.*"\(.*\)".*/\1/').apk"

if [ ! -f "$INPUT_APK" ]; then
  echo "[StockPilot] ❌ Release APK not found. Run scripts/build-apk.sh release first."
  exit 1
fi

echo "[StockPilot] Signing APK..."
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$storeFile" \
  -storepass "$storePassword" \
  -keypass "$keyPassword" \
  "$INPUT_APK" "$keyAlias"

echo "[StockPilot] Aligning with zipalign..."
zipalign -v 4 "$INPUT_APK" "$OUTPUT_APK"

echo ""
echo "[StockPilot] ✅ Signed APK ready:"
echo "    $OUTPUT_APK"
ls -lh "$OUTPUT_APK"
echo ""
echo "[StockPilot] Next steps:"
echo "  - Direct distribution: send $OUTPUT_APK via WhatsApp/Drive"
echo "  - Play Store: upload at https://play.google.com/console"
