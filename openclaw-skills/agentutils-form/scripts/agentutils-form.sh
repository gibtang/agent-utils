#!/usr/bin/env bash
# AgentUtils Agent Form - Structured data collection from humans
# Usage:
#   agentutils-form.sh create <title> <fields_json> <webhook_url> [ttl_seconds]
#   agentutils-form.sh list [limit]
#   agentutils-form.sh get <id>

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
  create)
    if [ -z "${4:-}" ]; then
      echo "Usage: agentutils-form.sh create <title> <fields_json> <webhook_url> [ttl_seconds]"
      exit 1
    fi
    rate_limit
    payload="{\"title\":\"$2\",\"fields\":$3,\"webhookUrl\":\"$4\""
    if [ -n "${5:-}" ]; then
      payload="${payload},\"ttl\":${5}"
    fi
    payload="${payload}}"
    curl -s -X POST "${BASE_URL}/form" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    limit="${2:-50}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/form?limit=${limit}"
    ;;

  get)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-form.sh get <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/form/${2}"
    ;;

  *)
    echo "AgentUtils Agent Form - Structured data collection"
    echo ""
    echo "Usage: agentutils-form.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  create <title> <fields_json> <webhook> [ttl]  Create a form"
    echo "  list [limit]                                    List forms"
    echo "  get <id>                                        Get form details"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
