#!/usr/bin/env bash
# AgentUtils AgentVerify OTP - Temporary phone numbers for verification
# Usage:
#   agentutils-otp.sh provision [country_code]
#   agentutils-otp.sh list
#   agentutils-otp.sh poll <id>
#   agentutils-otp.sh cancel <id>

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
  provision)
    rate_limit
    payload="{}"
    if [ -n "${2:-}" ]; then
      payload="{\"countryCode\":\"$2\"}"
    fi
    curl -s -X POST "${BASE_URL}/otp" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/otp"
    ;;

  poll)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-otp.sh poll <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/otp/${2}"
    ;;

  cancel)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-otp.sh cancel <id>"
      exit 1
    fi
    rate_limit
    curl -s -X DELETE "${BASE_URL}/otp/${2}" \
      -H "x-api-key: ${API_KEY}"
    ;;

  *)
    echo "AgentUtils AgentVerify OTP - Temporary phone numbers"
    echo ""
    echo "Usage: agentutils-otp.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  provision [country]  Provision a temporary phone number"
    echo "  list                 List active OTP sessions"
    echo "  poll <id>            Poll for OTP code"
    echo "  cancel <id>          Cancel OTP session"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
