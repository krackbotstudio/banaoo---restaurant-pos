# Reads expo version from app.json → banaoo-app-V.0.08.apk (0.0.8 → 0.08)
param(
  [string]$MobileRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$appJsonPath = Join-Path $MobileRoot "app.json"
$raw = Get-Content -LiteralPath $appJsonPath -Raw | ConvertFrom-Json
$version = [string]$raw.expo.version
$parts = $version.Split(".")
if ($parts.Length -ge 3) {
  $label = "0.$($parts[1])$($parts[2])"
} else {
  $label = $version -replace '\.', ''
}
return "banaoo-app-V.$label.apk"
