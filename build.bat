@echo off
title SAMELCO II Mobile - Build APK
cd /d "%~dp0"
echo ========================================
echo   Building APK (Debug)...
echo ========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-apk.ps1" -BuildType Debug -Install -SkipChecks
echo.
echo Build process completed.
if errorlevel 1 (
    echo ERROR: Build failed. Check logs above.
    pause
    exit /b 1
)
timeout /t 5 /nobreak >nul
