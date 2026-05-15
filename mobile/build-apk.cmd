@echo off
REM Cloud APK via EAS (needs: npm.cmd run eas:login once, or EXPO_TOKEN).
cd /d "%~dp0"
call npm.cmd run build:apk
exit /b %ERRORLEVEL%
