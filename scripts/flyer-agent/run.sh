#!/usr/bin/env bash
# Spike: one flyer-agent run. Builds the brief, then Claude (headless) art-directs
# Gemini in the run directory. Prints Claude's cost/time; Gemini's are in calls.jsonl.
#
#   scripts/flyer-agent/run.sh <eventId> <runDir> [model]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
event="$1"; run="$2"; model="${3:-claude-opus-5-5}"
mkdir -p "$run"
: "${DATABASE_URL:?set DATABASE_URL}"; : "${GEMINI_API_KEY:?set GEMINI_API_KEY}"

bun "$here/brief.ts" "$event" "$run" > /dev/null 2>&1
export FLYER_RUN_DIR="$run" TOOLS="$here/tools.ts"
started=$(date +%s)
cd "$run"
{ sed "s#\$TOOLS#$here/tools.ts#g" "$here/art-director.md"; echo; echo "Make the flyer for the event in brief.json now."; } \
  | claude -p --model "$model" --output-format json \
      --allowedTools "Bash(bun $here/tools.ts:*)" Read Write \
      > "$run/claude.json"
echo "elapsed_s=$(( $(date +%s) - started ))" > "$run/timing.txt"
cat "$run/timing.txt"
