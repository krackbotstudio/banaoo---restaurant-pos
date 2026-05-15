# Dot-source from other scripts in this folder. Sets JAVA_HOME, ANDROID_HOME, Gradle/TEMP dirs.
# Expects this file to live in mobile/scripts/ (parent = mobile app root).

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $MobileRoot "android"

function Test-JdkRoot([string]$Root) {
  return $Root -and (Test-Path (Join-Path $Root "bin\java.exe"))
}

function Get-JavaMajorVersion([string]$jdkRoot) {
  if (-not (Test-JdkRoot $jdkRoot)) { return 0 }
  $java = Join-Path $jdkRoot "bin\java.exe"
  $prevEa = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $all = & $java -version 2>&1
    $text = ($all | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message }
        else { $_ }
      }) -join "`n"
    if ($text -match 'version "1\.(\d+)') { return [int]$Matches[1] }
    if ($text -match 'version "(\d+)') { return [int]$Matches[1] }
  } catch { }
  finally {
    $ErrorActionPreference = $prevEa
  }
  return 0
}

function Select-PreferredJdkFromOrderedList([string[]]$orderedRoots) {
  $seen = @{}
  $uniqueOrdered = [System.Collections.Generic.List[string]]::new()
  foreach ($r in $orderedRoots) {
    if (-not $r) { continue }
    if (-not (Test-JdkRoot $r)) { continue }
    if ($seen.ContainsKey($r)) { continue }
    $seen[$r] = $true
    [void]$uniqueOrdered.Add($r)
  }
  if ($uniqueOrdered.Count -eq 0) { return $null }

  $meta = foreach ($r in $uniqueOrdered) {
    [PSCustomObject]@{ Root = $r; Major = (Get-JavaMajorVersion $r) }
  }
  $ltsBand = $meta | Where-Object { $_.Major -ge 17 -and $_.Major -le 21 } | Sort-Object Major -Descending
  if ($ltsBand) { return $ltsBand[0].Root }
  $newer = $meta | Where-Object { $_.Major -gt 21 } | Sort-Object Major | Select-Object -First 1
  if ($newer) { return $newer.Root }
  $older = $meta | Where-Object { $_.Major -ge 11 } | Sort-Object Major -Descending | Select-Object -First 1
  if ($older) { return $older.Root }
  return $meta[0].Root
}

function Get-JdkRootsFromRegistry {
  $homes = [System.Collections.Generic.List[string]]::new()
  foreach ($regBase in @(
      'HKLM:\SOFTWARE\JavaSoft\JDK',
      'HKLM:\SOFTWARE\JavaSoft\Java Development Kit',
      'HKCU:\SOFTWARE\JavaSoft\JDK',
      'HKLM:\SOFTWARE\Eclipse Adoptium\JDK',
      'HKLM:\SOFTWARE\Microsoft\JDK',
      'HKLM:\SOFTWARE\Eclipse Foundation\JDK'
    )) {
    if (-not (Test-Path $regBase)) { continue }
    Get-ChildItem $regBase -ErrorAction SilentlyContinue | ForEach-Object {
      $p = Get-ItemProperty $_.PsPath -ErrorAction SilentlyContinue
      foreach ($key in @('JavaHome', 'Path', 'InstallationPath')) {
        $h = $p.$key
        if ($h -and (Test-JdkRoot $h) -and -not $homes.Contains($h)) { [void]$homes.Add($h) }
      }
    }
  }
  return $homes
}

function Get-JdkRootsFromProgramFileBases {
  $found = [System.Collections.Generic.List[string]]::new()
  $bases = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Eclipse Adoptium"),
    (Join-Path ${env:ProgramFiles} "Eclipse Adoptium"),
    (Join-Path ${env:ProgramFiles} "Java"),
    (Join-Path ${env:ProgramFiles} "Microsoft"),
    (Join-Path ${env:ProgramFiles} "Amazon Corretto"),
    (Join-Path ${env:ProgramFiles} "Zulu"),
    (Join-Path ${env:ProgramFiles} "BellSoft"),
    "F:\Program Files\Eclipse Adoptium",
    "F:\Program Files\Java",
    "F:\Program Files\Microsoft",
    "F:\Program Files\Amazon Corretto",
    "F:\Program Files\Zulu"
  )
  foreach ($base in $bases) {
    if (-not (Test-Path $base)) { continue }
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      if (Test-JdkRoot $_.FullName) {
        if (-not $found.Contains($_.FullName)) { [void]$found.Add($_.FullName) }
      }
      Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if (Test-JdkRoot $_.FullName) {
          if (-not $found.Contains($_.FullName)) { [void]$found.Add($_.FullName) }
        }
      }
    }
  }
  return $found
}

$jdkFromFile = $null
$jdkPathFile = Join-Path $PSScriptRoot "jdk.path"
if (Test-Path $jdkPathFile) {
  $line = Get-Content $jdkPathFile -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -notmatch '^\s*#') } |
    Select-Object -First 1
  if ($line -and (Test-JdkRoot $line)) { $jdkFromFile = $line }
}

$ordered = [System.Collections.Generic.List[string]]::new()
if ($env:JAVA_HOME) { [void]$ordered.Add($env:JAVA_HOME.TrimEnd('\')) }
if ($jdkFromFile) { [void]$ordered.Add($jdkFromFile) }

foreach ($c in @(
    "F:\Program Files\Android\Android Studio\jbr",
    "F:\Program Files (x86)\Android\Android Studio\jbr",
    "F:\Android\Android Studio\jbr",
    (Join-Path ${env:ProgramFiles} "Android\Android Studio\jbr"),
    (Join-Path ${env:ProgramFiles(x86)} "Android\Android Studio\jbr"),
    (Join-Path $env:LOCALAPPDATA "Android\Android Studio\jbr"),
    (Join-Path $env:LOCALAPPDATA "Programs\Android\Android Studio\jbr")
  )) {
  if ($c) { [void]$ordered.Add($c) }
}

foreach ($root in @(
    "F:\Program Files\Android",
    "F:\Android",
    "F:\Applications",
    "F:\Dev"
  )) {
  if (-not (Test-Path $root)) { continue }
  foreach ($leaf in @("Android Studio", "android-studio")) {
    $jbr = Join-Path (Join-Path $root $leaf) "jbr"
    if (Test-JdkRoot $jbr) { [void]$ordered.Add($jbr) }
  }
  $directJbr = Join-Path $root "jbr"
  if (Test-JdkRoot $directJbr) { [void]$ordered.Add($directJbr) }
}

foreach ($h in (Get-JdkRootsFromRegistry)) { [void]$ordered.Add($h) }
foreach ($h in (Get-JdkRootsFromProgramFileBases)) { [void]$ordered.Add($h) }

$resolved = Select-PreferredJdkFromOrderedList @($ordered.ToArray())

$majPick = if ($resolved) { Get-JavaMajorVersion $resolved } else { 0 }
if ($resolved -and $majPick -gt 21) {
  throw @"
Selected JDK is Java $majPick at:
  $resolved

Expo / React Native Android Gradle expects JDK 17-21 (LTS).

Install JDK 21, unset JAVA_HOME or set it to JDK 21, or use scripts\jdk.path.

You may have Java 26+ installed; it is too new for this Gradle toolchain.
"@
}

if (-not $resolved) {
  Write-Error @"
No JDK found. Install JDK 17 or 21 (Temurin, Microsoft OpenJDK) or Android Studio.

Copy scripts\jdk.path.example to scripts\jdk.path with one line: path to JDK root (folder with bin\java.exe).
"@
}
$env:JAVA_HOME = $resolved

if (-not $env:ANDROID_HOME) {
  $sdkCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    "F:\Android\Sdk"
  )
  foreach ($sdkRoot in $sdkCandidates) {
    if ($sdkRoot -and (Test-Path (Join-Path $sdkRoot "platform-tools\adb.exe"))) {
      $env:ANDROID_HOME = $sdkRoot
      break
    }
  }
  if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  }
}

$GradleHome = "D:\gradle-banaoo"
$TempBuild = "D:\temp-banaoo-build"
New-Item -ItemType Directory -Force -Path $GradleHome, $TempBuild | Out-Null
$env:GRADLE_USER_HOME = $GradleHome
$env:TEMP = $TempBuild
$env:TMP = $TempBuild
