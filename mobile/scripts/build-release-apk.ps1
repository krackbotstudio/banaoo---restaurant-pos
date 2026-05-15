# Release APK build helper for Windows.
# Dot-sources android-build-env.ps1 (JDK 17-21, SDK, Gradle cache on D:).
# Uses a short directory junction on D: when needed (CMake MAX_PATH on Windows).
#
# If build fails with "not enough space on the disk", free several GB on C: first.

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\android-build-env.ps1"
. "$PSScriptRoot\invoke-with-short-mobile-path.ps1"

Invoke-WithShortMobilePath $MobileRoot {
  param($workRoot)
  Push-Location (Join-Path $workRoot "android")
  try {
    .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
  } finally {
    Pop-Location
  }
}

$releaseDir = Join-Path $MobileRoot "android\app\build\outputs\apk\release"
$apk = Get-ChildItem -Path $releaseDir -Filter "banaoo-app-*.apk" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $apk) {
  $legacy = Join-Path $releaseDir "app-release.apk"
  if (Test-Path $legacy) { $apk = Get-Item $legacy }
}
if ($apk) {
  Write-Host "`nAPK: $($apk.FullName)" -ForegroundColor Green
}
