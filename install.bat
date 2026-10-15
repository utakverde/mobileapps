@echo off
title SAMELCO II Mobile - Install Dependencies
cd /d "%~dp0"
echo ========================================
echo   Installing dependencies
echo ========================================
echo.
call npm install
echo.
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo Install completed successfully.
pause
