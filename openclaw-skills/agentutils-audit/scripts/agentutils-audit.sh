#!/usr/bin/env bash
# AgentUtils Audit Log - Audit trails for agent actions
# Usage:
#   agentutils-audit.sh log <action> [agent_name] [severity] [target] [metadata_json]
#   agentutils-audit.sh list [agent] [action] [severity] [limit]

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
  log)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-audit.sh log <action> [agent_name] [severity] [target] [metadata_json]"
      exit 1
    fi
    rate_limit
    payload="{\"action\":\"$2\""
    if [ -n "${3:-}" ]; then payload="${payload},\"agentName\":\"$3\""; fi
    if [ -n "${4:-}" ]; then payload="${payload},\"severity\":\"$4\""; fi
    if [ -n "${5:-}" ]; then payload="${payload},\"target\":\"$5\""; fi
    if [ -n "${6:-}" ]; then payload="${payload},\"metadata\":$6"; fi
    payload="${payload}}"
    curl -s -X POST "${BASE_URL}/audit" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    agent="${2:-}"
    action="${3:-}"
    severity="${4:-}"
    limit="${5:-50}"
    qs="limit=${limit}"
    [ -n "$agent" ] && qs="agent=${agent}&${qs}"
    [ -n "$action" ] && qs="action=${action}&${qs}"
    [ -n "$severity" ] && qs="severity=${severity}&${qs}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/audit?${qs}"
    ;;

  *)
    echo "AgentUtils Audit Log - Audit trails for agent actions"
    echo ""
    echo "Usage: agentutils-audit.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  log <action> [agent] [severity] [target] [meta]  Log an action"
    echo "  list [agent] [action] [severity] [limit]          Query logs"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
