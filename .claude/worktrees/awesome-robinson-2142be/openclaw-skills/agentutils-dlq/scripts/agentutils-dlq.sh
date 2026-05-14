#!/usr/bin/env bash
# AgentUtils Dead Letter Queue - Capture, inspect, and retry failed agent tasks
# Usage:
#   agentutils-dlq.sh capture <agent> <task_type> <error> [retry_webhook]
#   agentutils-dlq.sh list [status] [page] [limit]
#   agentutils-dlq.sh inspect <id>
#   agentutils-dlq.sh retry <id>
#   agentutils-dlq.sh dismiss <id>

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
  capture)
    if [ -z "${4:-}" ]; then
      echo "Usage: agentutils-dlq.sh capture <agent_name> <task_type> <error> [retry_webhook]"
      exit 1
    fi
    rate_limit
    payload=$(cat <<EOF
{"agentName":"$2","taskType":"$3","error":"$4"${5:+,"retryWebhook":"$5"}}
EOF
)
    curl -s -X POST "${BASE_URL}/dlq" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  list)
    rate_limit
    status="${2:-}"
    page="${3:-1}"
    limit="${4:-20}"
    qs=""
    [ -n "$status" ] && qs="status=${status}&"
    qs="${qs}page=${page}&limit=${limit}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/dlq?${qs}"
    ;;

  inspect)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-dlq.sh inspect <id>"
      exit 1
    fi
    rate_limit
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/dlq/${2}"
    ;;

  retry)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-dlq.sh retry <id>"
      exit 1
    fi
    rate_limit
    curl -s -X POST "${BASE_URL}/dlq/${2}/retry" \
      -H "x-api-key: ${API_KEY}"
    ;;

  dismiss)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-dlq.sh dismiss <id>"
      exit 1
    fi
    rate_limit
    curl -s -X DELETE "${BASE_URL}/dlq/${2}" \
      -H "x-api-key: ${API_KEY}"
    ;;

  *)
    echo "AgentUtils Dead Letter Queue"
    echo ""
    echo "Usage: agentutils-dlq.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  capture <agent> <type> <error> [webhook]  Capture a failure"
    echo "  list [status] [page] [limit]               List failures"
    echo "  inspect <id>                                Inspect failure details"
    echo "  retry <id>                                  Retry a failure"
    echo "  dismiss <id>                                Dismiss a failure"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
