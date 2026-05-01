#!/usr/bin/env bash
# AgentUtils Checkpoint - Pause agents for human approval
# Usage:
#   agentutils-checkpoint.sh create <agent_name> <description> <webhook_url> [state_json]
#   agentutils-checkpoint.sh list [page] [limit]
#   agentutils-checkpoint.sh poll <id>
#   agentutils-checkpoint.sh resume <id> <approve|reject> [reason]

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
      echo "Usage: agentutils-checkpoint.sh create <agent_name> <description> <webhook_url> [state_json]"
      exit 1
    fi
    rate_limit
    payload=$(cat <<EOF
{"agentName":"$2","taskDescription":"$3","webhookUrl":"$4"${5:+,"state":$5}}
EOF
)
    curl -s -X POST "${BASE_URL}/checkpoint" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    page="${2:-1}"
    limit="${3:-20}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/checkpoint?page=${page}&limit=${limit}"
    ;;

  poll)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-checkpoint.sh poll <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/checkpoint/${2}"
    ;;

  resume)
    if [ -z "${3:-}" ]; then
      echo "Usage: agentutils-checkpoint.sh resume <id> <approve|reject> [reason]"
      exit 1
    fi
    rate_limit
    payload=$(cat <<EOF
{"action":"$3"${4:+,"reason":"$4"}}
EOF
)
    curl -s -X POST "${BASE_URL}/checkpoint/${2}/resume" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  *)
    echo "AgentUtils Checkpoint - Human-in-the-Loop"
    echo ""
    echo "Usage: agentutils-checkpoint.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  create <agent> <desc> <webhook> [state]  Create checkpoint"
    echo "  list [page] [limit]                       List checkpoints"
    echo "  poll <id>                                  Check status"
    echo "  resume <id> <approve|reject> [reason]      Approve or reject"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
