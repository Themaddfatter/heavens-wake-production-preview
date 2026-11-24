#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null || ! command -v ffmpeg >/dev/null; then
  printf '\nHWP relay needs Python 3 and FFmpeg installed before it can start.\n'
  read -r -p 'Press Return to close.'
  exit 1
fi
python3 -m venv .venv
.venv/bin/python -m pip install 'websockets==16.0'
exec .venv/bin/python relay.py
