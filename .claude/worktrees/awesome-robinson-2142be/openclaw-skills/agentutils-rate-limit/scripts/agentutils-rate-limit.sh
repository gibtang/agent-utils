#!/usr/bin/env bash
# AgentUtils Rate Limiter - Rate limiting as a service
# Usage:
#   agentutils-rate-limit.sh check <key> <limit> <window_seconds>
#   agentutils-rate-limit.sh status <key>
#   agentutils-rate-limit.sh reset <key>

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
  check)
    if [ -z "${4:-}" ]; then
      echo "Usage: agentutils-rate-limit.sh check <key> <limit> <window_seconds>"
      exit 1
    fi
    rate_limit
    curl -s -X POST "${BASE_URL}/rate-limit/check" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$2\",\"limit\":$3,\"windowSeconds\":$4}"
    ;;

  status)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-rate-limit.sh status <key>"
      exit 1
    fi
    rate_limit
    encoded_key=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$2'))")
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/rate-limit/${encoded_key}"
    ;;

  reset)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-rate-limit.sh reset <key>"
      exit 1
    fi
    rate_limit
    curl -s -X POST "${BASE_URL}/rate-limit/reset" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$2\"}"
    ;;

  *)
    echo "AgentUtils Rate Limiter - Rate limiting as a service"
    echo ""
    echo "Usage: agentutils-rate-limit.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  check <key> <limit> <window>  Check rate limit"
    echo "  status <key>                   Get rate limit status"
    echo "  reset <key>                    Reset rate limit counter"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
