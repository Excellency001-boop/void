#!/bin/bash
# Lays your voice recording over the silent demo video.
# usage: ./add-voice.sh voice.m4a        (optional: OFFSET=0.5 shifts the voice later, negative earlier)
set -e
cd "$(dirname "$0")"
VOICE="${1:?usage: ./add-voice.sh voice.m4a}"
# A file from the studio is named voice-pre<seconds>.webm: it has that much lead-in before the video began.
if [ -z "${OFFSET:-}" ]; then
  PRE="$(basename "$VOICE" | sed -nE 's/.*-pre([0-9]+(\.[0-9]+)?)\..*/\1/p')"
  OFFSET="${PRE:+-$PRE}"
fi
OFFSET="${OFFSET:-0}"
FF="$(command -v ffmpeg || true)"
[ -z "$FF" ] && { echo "ffmpeg not found. Install it with: brew install ffmpeg"; exit 1; }
# Voice is levelled to broadcast loudness and padded or trimmed to the video length.
"$FF" -y -loglevel error -i VOID-demo-silent.mp4 -itsoffset "$OFFSET" -i "$VOICE" \
  -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5,apad[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -ar 48000 -b:a 192k -shortest -movflags +faststart VOID-demo.mp4
echo "wrote $(pwd)/VOID-demo.mp4"
