@echo off
rem Mare Liberum on your own machine: an empty sea, its state in the folder "state" beside this file
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is needed: https://nodejs.org
  pause
  exit /b 1
)
if "%MARE_STATE%"=="" set MARE_STATE=state
if "%MARE_HARBOUR_ROOM%"=="" set MARE_HARBOUR_ROOM=10
echo Mare Liberum starts. Your browser opens http://localhost:8787/harbour in a moment.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8787/harbour"
node serve.mjs
pause
