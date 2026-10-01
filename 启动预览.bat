@echo off
cd /d "%~dp0"
start "zisheng-preview-server" /min cmd /c python -m http.server 8017
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8017/index.html"
echo.
echo Preview: http://127.0.0.1:8017
echo Close the minimized "zisheng-preview-server" window to stop the server.
timeout /t 5 /nobreak >nul
exit
