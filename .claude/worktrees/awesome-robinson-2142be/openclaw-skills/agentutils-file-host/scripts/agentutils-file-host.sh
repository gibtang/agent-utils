#!/usr/bin/env bash
# AgentUtils File Host - Ephemeral file hosting for AI agents
# Usage:
#   agentutils-file-host.sh upload <file_path> [ttl_hours]
#   agentutils-file-host.sh get <file_id>

set -euo pipefail

BASE_URL="https://agentutils.dev/api"
API_KEY="${AGENTUTILS_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "Error: Set AGENTUTILS_API_KEY environment variable (au_...)"
  exit 1
fi

rate_limit() {
  local now=$(date +%s)
  local last="${_AU_LAST_CALL:-0}"
  local diff=$((now - last))
  if [ "$diff" -lt 1 ]; then
    sleep $((1 - diff))
  fi
  _AU_LAST_CALL=$now
}

case "${1:-}" in
  upload)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-file-host.sh upload <file_path> [ttl_hours]"
      exit 1
    fi
    rate_limit
    args=(-s -X POST "${BASE_URL}/file-host" -H "x-api-key: ${API_KEY}" -F "file=@${2}")
    if [ -n "${3:-}" ]; then
      args+=(-F "ttl=${3}")
    fi
    curl "${args[@]}"
    ;;

  get)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-file-host.sh get <file_id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/file-host/${2}"
    ;;

  *)
    echo "AgentUtils File Host - Ephemeral file hosting"
    echo ""
    echo "Usage: agentutils-file-host.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  upload <file> [ttl]  Upload a file (ttl in hours, default 1)"
    echo "  get <id>             Retrieve file info"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
