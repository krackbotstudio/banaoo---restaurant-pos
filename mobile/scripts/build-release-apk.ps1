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
  $generated = Join-Path $workRoot "android\app\build\generated"
  if (Test-Path $generated) {
    Write-Host "Removing stale android/app/build/generated …" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $generated
  }
  Push-Location (Join-Path $workRoot "android")
  try {
    .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assembleRelease failed (exit $LASTEXITCODE)"
    }
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
  $webApkDir = Join-Path (Split-Path $MobileRoot -Parent) "public\downloads"
  New-Item -ItemType Directory -Force -Path $webApkDir | Out-Null
  $versionedName = & "$PSScriptRoot\apk-version-name.ps1" -MobileRoot $MobileRoot
  $versionedApk = Join-Path $webApkDir $versionedName
  $webApk = Join-Path $webApkDir "banaoo-latest.apk"
  Copy-Item -Force $apk.FullName $versionedApk
  Copy-Item -Force $apk.FullName $webApk
  $serverDl = Join-Path (Split-Path $MobileRoot -Parent) "server\downloads"
  New-Item -ItemType Directory -Force -Path $serverDl | Out-Null
  Copy-Item -Force $apk.FullName (Join-Path $serverDl "banaoo-latest.apk")
  Write-Host "`nAPK: $($apk.FullName)" -ForegroundColor Green
  Write-Host "Versioned: $versionedApk" -ForegroundColor Green
  Write-Host "Web download (latest): $webApk" -ForegroundColor Green
}
