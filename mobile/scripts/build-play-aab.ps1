# Build a Google Play–ready Android App Bundle (.aab) via EAS.
# Prerequisites: eas login, EXPO_TOKEN or interactive login, app.json version bumped.

$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path $PSScriptRoot -Parent
Push-Location $MobileRoot
try {
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "Node/npx not found on PATH."
  }
  Write-Host "Building production AAB (profile: production, buildType: app-bundle)..." -ForegroundColor Cyan
  npx eas-cli build --platform android --profile production --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "EAS build failed with exit code $LASTEXITCODE" }
  Write-Host "`nDownload the .aab from the URL above, or run: npx eas-cli build:list" -ForegroundColor Green
} finally {
  Pop-Location
}
