#!/usr/bin/env bash
# AgentUtils Image Upload - Host an image and get a URL in one call
# Usage:
#   agentutils-image-upload.sh upload <image_path> [retention_hours]

set -euo pipefail

BASE_URL="https://agentutils.dev/api"
API_KEY="${AGENTUTILS_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "Error: Set AGENTUTILS_API_KEY environment variable (au_...)"
  exit 1
fi

# Minimal client-side rate limiting (1 req/sec) to avoid hammering the API.
rate_limit() {
  local now=$(date +%s)
  local last="${_AU_LAST_CALL:-0}"
  local diff=$((now - last))
  if [ "$diff" -lt 1 ]; then
    sleep $((1 - diff))
  fi
  _AU_LAST_CALL=$now
}

# Map a file extension to its MIME type; reject non-image files early so we
# fail fast before hitting the server's content-type validation (HTTP 415).
ext_to_mime() {
  case "${1,,}" in
    jpg|jpeg) echo "image/jpeg" ;;
    png)      echo "image/png" ;;
    webp)     echo "image/webp" ;;
    gif)      echo "image/gif" ;;
    *)        return 1 ;;
  esac
}

case "${1:-}" in
  upload)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-image-upload.sh upload <image_path> [retention_hours]"
      exit 1
    fi
    file_path="$2"
    if [ ! -f "$file_path" ]; then
      echo "Error: File not found: $file_path"
      exit 1
    fi
    ext="${file_path##*.}"
    if ! mime="$(ext_to_mime "$ext")"; then
      echo "Error: Unsupported file type. Allowed: jpg, jpeg, png, webp, gif"
      exit 1
    fi
    rate_limit
    args=(-s -X POST "${BASE_URL}/upload" -H "x-api-key: ${API_KEY}" -F "file=@${file_path};type=${mime}")
    if [ -n "${3:-}" ]; then
      args+=(-F "retentionHours=${3}")
    fi
    curl "${args[@]}"
    ;;

  *)
    echo "AgentUtils Image Upload - Host an image and get a URL in one call"
    echo ""
    echo "Usage: agentutils-image-upload.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  upload <image> [hours]  Upload an image (jpg/png/webp/gif), get a hosted URL"
    echo "                         retention_hours defaults to 24"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
