#!/usr/bin/env bash
# AgentUtils Notification Router - Email notifications for agents
# Usage:
#   agentutils-notify.sh send <message> [priority] [to] [subject]
#   agentutils-notify.sh list [status] [priority] [limit]
#   agentutils-notify.sh get <id>

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
  send)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-notify.sh send <message> [priority] [to] [subject]"
      exit 1
    fi
    rate_limit
    priority="${3:-normal}"
    payload="{\"message\":\"$2\",\"priority\":\"${priority}\""
    if [ -n "${4:-}" ]; then
      payload="${payload},\"to\":\"$4\""
    fi
    if [ -n "${5:-}" ]; then
      payload="${payload},\"subject\":\"$5\""
    fi
    payload="${payload}}"
    curl -s -X POST "${BASE_URL}/notify" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    status="${2:-}"
    priority="${3:-}"
    limit="${4:-20}"
    qs="limit=${limit}"
    [ -n "$status" ] && qs="status=${status}&${qs}"
    [ -n "$priority" ] && qs="priority=${priority}&${qs}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/notify?${qs}"
    ;;

  get)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-notify.sh get <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/notify/${2}"
    ;;

  *)
    echo "AgentUtils Notification Router"
    echo ""
    echo "Usage: agentutils-notify.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  send <message> [priority] [to] [subject]  Send notification"
    echo "  list [status] [priority] [limit]            List history"
    echo "  get <id>                                     Get notification detail"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
