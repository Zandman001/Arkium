#!/usr/bin/env zsh
set -euo pipefail

app_name="Arkium.app"
project_dir="$PWD"
dist_dir="$project_dir/dist"

# 1) Install deps (in case package.json changed)
if [ -f "$project_dir/package.json" ]; then
  echo "[update] Installing dependencies..."
  npm install
fi

# 2) Build mac artifacts for current machine arch
#    This produces dist/mac-<arch>/Arkium.app and DMG/ZIP in dist/
 echo "[update] Building macOS app..."
npm run dist:mac

# 3) Locate the built .app (handles arm64 and x64 output folders)
mac_app_dir_arm64="$dist_dir/mac-arm64/$app_name"
mac_app_dir_x64="$dist_dir/mac/$app_name"

if [ -d "$mac_app_dir_arm64" ]; then
  built_app="$mac_app_dir_arm64"
elif [ -d "$mac_app_dir_x64" ]; then
  built_app="$mac_app_dir_x64"
else
  echo "[update] Could not find built app in dist/mac-arm64 or dist/mac." 1>&2
  exit 1
fi

echo "[update] Built app found at: $built_app"

# 4) Quit running app if open
if pgrep -x "Arkium" >/dev/null 2>&1; then
  echo "[update] Quitting running Arkium..."
  osascript -e 'tell application "Arkium" to quit' || true
  # Wait a bit for quit
  sleep 1
  # Fallback kill if needed
  if pgrep -x "Arkium" >/dev/null 2>&1; then
    killall Arkium || true
    sleep 1
  fi
fi

# 5) Install to /Applications (may prompt for password if needed)
apps_dir="/Applications"
target_app="$apps_dir/$app_name"

if [ -d "$target_app" ]; then
  echo "[update] Removing existing $target_app ..."
  rm -rf "$target_app"
fi

echo "[update] Copying new app into /Applications ..."
cp -R "$built_app" "$apps_dir/"

# 6) Done
echo "[update] Installed $app_name to $apps_dir"
echo "[update] You can now launch Arkium from Applications."
