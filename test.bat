@echo off
title SAMELCO II Mobile - Run Tests
cd /d "%~dp0"
echo ========================================
echo   Running project checks
echo ========================================
echo.
call npm run typecheck
if errorlevel 1 goto :fail
echo.
call npm run lint
if errorlevel 1 goto :fail
echo.
call npm run test:invoice
if errorlevel 1 goto :fail
echo.
echo All checks passed.
pause
exit /b 0

:fail
echo.
echo ERROR: One or more checks failed.
pause
exit /b 1
