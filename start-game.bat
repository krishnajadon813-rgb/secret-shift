@echo off
cd /d "%~dp0"
start "SECRET SHIFT local game" /D "%~dp0" cmd /k node scripts/serve.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
