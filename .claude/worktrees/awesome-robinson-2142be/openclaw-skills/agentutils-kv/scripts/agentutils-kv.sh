#!/usr/bin/env bash
# AgentUtils KV Store - Persistent key-value storage for agents
# Usage:
#   agentutils-kv.sh set <key> <value> [ttl_seconds]
#   agentutils-kv.sh get <key>
#   agentutils-kv.sh list [limit] [offset]
#   agentutils-kv.sh increment <key> [amount]

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
  set)
    if [ -z "${3:-}" ]; then
      echo "Usage: agentutils-kv.sh set <key> <value> [ttl_seconds]"
      exit 1
    fi
    rate_limit
    payload="{\"key\":\"$2\",\"value\":$3"
    if [ -n "${4:-}" ]; then
      payload="${payload},\"ttl\":${4}"
    fi
    payload="${payload}}"
    curl -s -X PUT "${BASE_URL}/kv" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  get)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-kv.sh get <key>"
      exit 1
    fi
    rate_limit
    encoded_key=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$2'))")
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/kv/${encoded_key}"
    ;;

  list)
    rate_limit
    limit="${2:-50}"
    offset="${3:-0}"
    curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/kv?limit=${limit}&offset=${offset}"
    ;;

  increment)
    if [ -z "${2:-}" ]; then
      echo "Usage: agentutils-kv.sh increment <key> [amount]"
      exit 1
    fi
    rate_limit
    amount="${3:-1}"
    encoded_key=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$2'))")
    curl -s -X POST "${BASE_URL}/kv/${encoded_key}/increment" \
      -H "x-api-key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"amount\":${amount}}"
    ;;

  *)
    echo "AgentUtils KV Store - Persistent key-value storage"
    echo ""
    echo "Usage: agentutils-kv.sh <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  set <key> <value> [ttl]      Set a key-value pair"
    echo "  get <key>                     Get value by key"
    echo "  list [limit] [offset]         List all keys"
    echo "  increment <key> [amount]      Increment a numeric value"
    echo ""
    echo "Set AGENTUTILS_API_KEY=au_... for authentication."
    ;;
esac
