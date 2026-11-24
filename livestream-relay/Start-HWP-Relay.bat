@echo off
cd /d "%~dp0"
where py >nul 2>nul || (echo Python 3 is required. & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo FFmpeg is required on PATH. & pause & exit /b 1)
py -3 -m venv .venv || (pause & exit /b 1)
.venv\Scripts\python.exe -m pip install websockets==16.0 || (pause & exit /b 1)
.venv\Scripts\python.exe relay.py
pause
