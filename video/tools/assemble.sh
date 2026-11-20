#!/usr/bin/env bash
# Encode rendered frames + audio into the final 1080p MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -v error -framerate 24 -i build/frames/f%05d.jpg -i build/audio.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=7" -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 44100 -movflags +faststart -shortest \
  "${1:-pip_and_bloo_rainbow_garden.mp4}"
