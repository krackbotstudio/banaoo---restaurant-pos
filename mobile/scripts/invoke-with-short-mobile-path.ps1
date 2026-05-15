# Windows: short junction to mobile root avoids CMake/Ninja MAX_PATH failures.
# SUBST breaks some Expo subprocesses; directory junction does not.

function Invoke-WithShortMobilePath {
  param(
    [Parameter(Mandatory = $true)][string]$MobileRoot,
    [Parameter(Mandatory = $true)][scriptblock]$Work
  )

  $junctionPath = $null
  $workRoot = $MobileRoot
  if ($IsWindows -or $env:OS -match 'Windows') {
    $mobileAbs = (Resolve-Path -LiteralPath $MobileRoot).Path
    $candidates = @("D:\_bnmob", "D:\_bnmob2")
    foreach ($jp in $candidates) {
      if (Test-Path -LiteralPath $jp) {
        $item = Get-Item -LiteralPath $jp -Force -ErrorAction SilentlyContinue
        $isLink = $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
        if ($isLink) {
          $tgt = $item.Target
          if ($tgt -is [array]) { $tgt = $tgt[0] }
          if ([string]$tgt -ieq $mobileAbs) {
            $junctionPath = $jp
            break
          }
          cmd.exe /c "rmdir `"$jp`"" | Out-Null
        }
      }
      $parent = Split-Path -Parent $jp
      if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
      }
      cmd.exe /c "mklink /J `"$jp`" `"$mobileAbs`"" | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $junctionPath = $jp
        break
      }
    }
    if ($junctionPath) {
      $workRoot = $junctionPath
      Write-Host "Junction $junctionPath -> $mobileAbs (short paths for native build)" -ForegroundColor DarkGray
    }
  }

  try {
    & $Work $workRoot
  } finally {
    if ($junctionPath) {
      cmd.exe /c "rmdir `"$junctionPath`"" | Out-Null
    }
  }
}
