# Local release AAB for Play Store upload (Gradle bundleRelease).
# Uses same env as build-release-apk.ps1. Signed with debug keystore unless you configure release signing.
# For production upload key via Expo: npm run eas:login && npm run build:aab

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\android-build-env.ps1"
. "$PSScriptRoot\invoke-with-short-mobile-path.ps1"

Invoke-WithShortMobilePath $MobileRoot {
  param($workRoot)
  Push-Location (Join-Path $workRoot "android")
  try {
    .\gradlew.bat bundleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle bundleRelease failed (exit $LASTEXITCODE)"
    }
  } finally {
    Pop-Location
  }
}

$bundleDir = Join-Path $MobileRoot "android\app\build\outputs\bundle\release"
$aab = Get-ChildItem -Path $bundleDir -Filter "*.aab" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $aab) {
  throw "No .aab found under $bundleDir"
}

$versionedName = (& "$PSScriptRoot\apk-version-name.ps1" -MobileRoot $MobileRoot) -replace '\.apk$', '.aab'
$playDir = Join-Path $MobileRoot "play-store\releases"
$repoRoot = Split-Path $MobileRoot -Parent
$publicDir = Join-Path $repoRoot "public\downloads"

New-Item -ItemType Directory -Force -Path $playDir | Out-Null
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

$playAab = Join-Path $playDir $versionedName
$playLatest = Join-Path $playDir "banaoo-latest.aab"
$publicAab = Join-Path $publicDir $versionedName

Copy-Item -Force $aab.FullName $playAab
Copy-Item -Force $aab.FullName $playLatest
Copy-Item -Force $aab.FullName $publicAab

Write-Host "`nAAB (gradle): $($aab.FullName)" -ForegroundColor Green
Write-Host "Play store copy: $playAab" -ForegroundColor Green
Write-Host "Latest alias:    $playLatest" -ForegroundColor Green
Write-Host "Public copy:     $publicAab" -ForegroundColor Green
Write-Host "`nPackage: com.banaoo | Upload this .aab in Play Console → Testing → Internal testing" -ForegroundColor Cyan
