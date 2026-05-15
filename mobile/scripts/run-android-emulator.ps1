# Build debug app and install on a running Android emulator (or USB device).
# Prerequisites: Android Studio AVD started OR device connected; JDK 21; .env in mobile/ as in README.
#
# Uses the same short-path junction as build-release-apk.ps1 (Windows CMake/Ninja MAX_PATH).

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\android-build-env.ps1"
. "$PSScriptRoot\invoke-with-short-mobile-path.ps1"

$expoExtra = @($args)

Invoke-WithShortMobilePath $MobileRoot {
  param($workRoot)
  Push-Location $workRoot
  try {
    if ($expoExtra.Count -gt 0) {
      npx expo run:android @expoExtra
    } else {
      npx expo run:android
    }
  } finally {
    Pop-Location
  }
}
