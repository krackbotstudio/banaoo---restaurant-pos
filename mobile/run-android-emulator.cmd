@echo off
REM Debug build + install on emulator/device (uses short-path junction on Windows).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-android-emulator.ps1" %*
