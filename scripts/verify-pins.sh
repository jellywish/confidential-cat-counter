#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PINS_FILE="$ROOT_DIR/pins.json"

if [[ ! -f "$PINS_FILE" ]]; then
  echo "No pins.json found; skipping pins verification"
  exit 0
fi

expected_policy_digest=$(jq -r '.policy_digest' "$PINS_FILE")
if [[ -z "$expected_policy_digest" || "$expected_policy_digest" == "null" ]]; then
  echo "pins.json missing policy_digest; skipping"
  exit 0
fi

# Query ml-service /health if available; else compute from bundle if provided
if command -v curl >/dev/null 2>&1; then
  health=$(curl -sf http://localhost:8000/health || true)
  if [[ -n "$health" ]]; then
    actual=$(echo "$health" | jq -r '.policy_digest')
  fi
fi

if [[ -z "${actual:-}" || "$actual" == "null" ]]; then
  # Fallback: compute digest directly if POLICY_BUNDLE_PATH provided
  if [[ -n "${POLICY_BUNDLE_PATH:-}" && -f "$POLICY_BUNDLE_PATH" ]]; then
    actual=$(jq -cS '.' "$POLICY_BUNDLE_PATH" | shasum -a 256 | awk '{print $1}')
  else
    echo "Could not determine current policy digest; skipping"
    exit 0
  fi
fi

if [[ "$actual" != "$expected_policy_digest" ]]; then
  echo "❌ Policy digest mismatch: expected=$expected_policy_digest actual=$actual"
  exit 1
fi

echo "✅ Policy digest matches pins.json ($expected_policy_digest)"

