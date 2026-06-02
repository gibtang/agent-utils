#!/usr/bin/env bash
# AgentUtils Agent Shield - PII redaction and hydration
# Usage:
#   agentutils-shield.sh clean <text>
#   agentutils-shield.sh hydrate <text> <session_id>
#   agentutils-shield.sh info

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
  clean)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-shield.sh clean <text>"
      exit 1
    fi
    rate_limit
    curl -s -X POST "${BASE_URL}/shield/clean" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$2\"}"
    ;;

  hydrate)
    if [ -z "${3:-}" ]; then
      echo "Usage: agentutils-shield.sh hydrate <text> <session_id>"
      exit 1
    fi
    rate_limit
    curl -s -X POST "${BASE_URL}/shield/hydrate" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$2\",\"sessionId\":\"$3\"}"
    ;;

  info)
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/shield"
    ;;

  *)
    echo "AgentUtils Agent Shield - PII Redaction & Hydration"
    echo ""
    echo "Usage: agentutils-shield.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  clean <text>                Redact PII from text"
    echo "  hydrate <text> <session>    Restore original PII values"
    echo "  info                        Get shield info"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
