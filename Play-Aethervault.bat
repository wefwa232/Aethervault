@echo off
REM Double-click to play. Opens the game in your default browser.
REM (index.html also works directly; this just serves it locally so everything behaves identically.)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found - opening index.html directly.
  start "" "%~dp0index.html"
  exit /b
)
start "" "http://127.0.0.1:5173"
node serve.mjs 5173
