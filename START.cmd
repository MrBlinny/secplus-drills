@echo off
REM Double-click launcher for Windows. Installs dependencies on first run,
REM then starts the tutor and opens it in your browser.
setlocal
cd /d "%~dp0"
title Security+ Tutor

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo.
  echo   This app needs Node 20 or newer. The download page is opening now -
  echo   take the "LTS" installer, accept the defaults, then run this file again.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

REM Node prints "v24.18.0"; strip the v and take the major version.
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set MAJOR=%%v
if %MAJOR% LSS 20 (
  echo.
  echo   Node %MAJOR% is too old - this app needs Node 20 or newer.
  echo   Install the current LTS from https://nodejs.org/en/download and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo.
  echo   First run - installing dependencies. This takes a minute.
  echo.
  call npm install
  if not exist "node_modules\express" (
    echo.
    echo   Install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Starting. Your browser will open in a moment.
echo   Leave this window open while you study - closing it stops the app.
echo.
node server\index.js

REM Only reached if the server exits or fails to start; keeps the error visible
REM instead of the window vanishing.
echo.
pause
