@echo off
title SAMELCO II Mobile - Debug Mode
cd /d "%~dp0"
echo ========================================
echo   Starting Emulator + Dev Server
echo ========================================
echo.
echo [1/2] Launching emulator...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-emulator.ps1"
if errorlevel 1 (
    echo ERROR: Emulator failed to start.
    pause
    exit /b 1
)
echo.
echo [2/2] Starting Expo dev server...
echo   Press 'a' to open on Android emulator
echo   Press 'r' to reload
echo   Press Ctrl+C to stop
echo.
call npm start
echo.
echo Dev server stopped.
pause
