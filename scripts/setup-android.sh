#!/usr/bin/env bash
# StockPilot — Android dev environment setup
# ==========================================
# One-time setup script for Android development. Verifies that all
# required tools are installed and sets up the Android project.
set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "  StockPilot — Android dev setup"
echo "=========================================="

# 1. Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not installed. Install Node 20+ from https://nodejs.org"
  exit 1
fi
echo "✅ Node $(node -v)"

# 2. Check Java 17
if ! command -v java &> /dev/null; then
  echo "❌ Java not installed. Install JDK 17:"
  echo "   sudo apt install openjdk-17-jdk   # Ubuntu/Debian"
  echo "   brew install openjdk@17            # macOS"
  exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -1 | sed 's/.*"\(.*\)".*/\1/' | cut -d. -f1)
if [ "$JAVA_VERSION" != "17" ] && [ "$JAVA_VERSION" -lt 17 ] 2>/dev/null; then
  echo "⚠️  Java 17 recommended (you have $JAVA_VERSION)"
else
  echo "✅ Java $(java -version 2>&1 | head -1)"
fi

# 3. Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
  echo "❌ ANDROID_HOME not set. Install Android Studio:"
  echo "   https://developer.android.com/studio"
  echo "   Then add to ~/.bashrc or ~/.zshrc:"
  echo "   export ANDROID_HOME=\$HOME/Android/Sdk"
  echo "   export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
  exit 1
fi
echo "✅ ANDROID_HOME=$ANDROID_HOME"

# 4. Install npm dependencies
echo ""
echo "[StockPilot] Installing npm dependencies..."
npm install

# 5. Generate keys
echo ""
echo "[StockPilot] Generating license / PIN / tier keys..."
npm run keys:all

# 6. Build Next.js
echo ""
echo "[StockPilot] Building Next.js → ./out"
npm run build

# 7. Add Android platform
echo ""
echo "[StockPilot] Adding Capacitor Android platform..."
if [ ! -d android/app/src/main/java/com/obandetechhub/stockpilot ]; then
  npx cap add android
else
  echo "    (android/ already exists — skipping cap add)"
fi

# 8. Sync
echo ""
echo "[StockPilot] Syncing web assets to android/..."
npx cap sync android

echo ""
echo "=========================================="
echo "  ✅ Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Open android/ in Android Studio:   npx cap open android"
echo "  2. Or build APK from command line:     bash scripts/build-apk.sh debug"
echo "  3. Or run on a connected device:       cd android && ./gradlew installDebug"
echo ""
