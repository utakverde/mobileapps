@echo off
title SAMELCO II Mobile - Start Dev Server
cd /d "%~dp0"
echo ========================================
echo   Starting Expo dev server
echo ========================================
echo.
echo The launcher will automatically pick a free port if 8081 is busy.
echo Press Ctrl+C to stop the server.
echo.
call npm start
echo.
echo Dev server stopped.
pause
