#!/usr/bin/env bash
# AgentUtils Webhook Inbox - Temporary webhook capture
# Usage:
#   agentutils-webhook.sh create [label] [forward_url] [ttl_seconds]
#   agentutils-webhook.sh list [limit]
#   agentutils-webhook.sh messages <id>
#   agentutils-webhook.sh delete <id>

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
    rate_limit
    payload="{}"
    if [ -n "${2:-}" ] || [ -n "${3:-}" ] || [ -n "${4:-}" ]; then
      payload="{"
      [ -n "${2:-}" ] && payload="${payload}\"label\":\"$2\","
      [ -n "${3:-}" ] && payload="${payload}\"forwardUrl\":\"$3\","
      [ -n "${4:-}" ] && payload="${payload}\"ttl\":${4},"
      payload="${payload%,}}"
    fi
    curl -s -X POST "${BASE_URL}/webhook" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    limit="${2:-50}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/webhook?limit=${limit}"
    ;;

  messages)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-webhook.sh messages <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/webhook/${2}"
    ;;

  delete)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-webhook.sh delete <id>"
      exit 1
    fi
    rate_limit
    curl -s -X DELETE "${BASE_URL}/webhook/${2}" \
      -H "x-api-key: ${API_KEY}"
    ;;

  *)
    echo "AgentUtils Webhook Inbox - Temporary webhook capture"
    echo ""
    echo "Usage: agentutils-webhook.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  create [label] [forward_url] [ttl]  Create webhook inbox"
    echo "  list [limit]                         List inboxes"
    echo "  messages <id>                        Get inbox messages"
    echo "  delete <id>                          Delete inbox"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
