@echo off
REM Google Play release: builds signed AAB via EAS (not a local APK).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-play-aab.ps1"
exit /b %ERRORLEVEL%
