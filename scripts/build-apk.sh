#!/usr/bin/env bash
# StockPilot — Build APK script
# =============================
# Builds a release-ready APK with ProGuard/R8 obfuscation enabled.
#
# Usage:
#   bash scripts/build-apk.sh [debug|release]
#
# Default: release
set -e

cd "$(dirname "$0")/.."

BUILD_TYPE="${1:-release}"
echo "[StockPilot] Building $BUILD_TYPE APK..."

# 1. Generate keys if missing
if [ ! -f download/license_keys.txt ]; then
  echo "[StockPilot] Generating license keys..."
  npm run keys:all
fi

# 2. Build Next.js → static export to ./out
echo "[StockPilot] Building Next.js → ./out"
npm run build

# 3. Sync web assets to android/
echo "[StockPilot] Capacitor sync..."
npx cap sync android

# 4. Gradle build
echo "[StockPilot] Gradle $BUILD_TYPE build..."
cd android
./gradlew "assemble$(echo "$BUILD_TYPE" | sed 's/.*/\u&/')"

# 5. Print output location
APK_DIR="app/build/outputs/apk/$BUILD_TYPE"
APK_FILE="$APK_DIR/app-$BUILD_TYPE.apk"
if [ -f "$APK_FILE" ]; then
  echo ""
  echo "[StockPilot] ✅ APK built successfully:"
  echo "    $APK_FILE"
  ls -lh "$APK_FILE"
  if [ "$BUILD_TYPE" = "release" ]; then
    echo ""
    echo "[StockPilot] Next step: sign the APK"
    echo "    bash scripts/sign-apk.sh"
  fi
else
  echo "[StockPilot] ❌ Build failed — check the Gradle output above"
  exit 1
fi
