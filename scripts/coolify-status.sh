#!/bin/bash
# coolify-status — one-shot deployment status for Gibson's Coolify instance (read-only).
# For agents + humans. Sources: Coolify REST API /applications /services /databases (+ /deployments).
#
# Usage:
#   coolify-status                 # colored table: apps + services + databases
#   coolify-status --json          # merged machine-readable JSON (implies quiet)
#   coolify-status --down          # only resources NOT in a running state
#   coolify-status --deployments   # include in-progress/queued deployments (JSON + table)
#   coolify-status --fail-on-down  # exit 1 when any resource is down/degraded (for cron/gates)
#   coolify-status --silent        # no sound/voice
#
# Config:
#   COOLIFY_URL    default https://coolify.feedcode.dev
#   COOLIFY_TOKEN  env token; falls back to ~/.config/coolify-status/token
#
# Exit codes: 0 ok · 1 down/degraded (only with --fail-on-down) · 2 operational error (API/auth/jq)
set -euo pipefail

START_EPOCH=$(date +%s)
START_TS=$(date '+%Y-%m-%d %H:%M:%S')

COOLIFY_URL="${COOLIFY_URL:-https://coolify.feedcode.dev}"
TOKEN_FILE="$HOME/.config/coolify-status/token"
if [[ -z "${COOLIFY_TOKEN:-}" && -f "$TOKEN_FILE" ]]; then
  COOLIFY_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
fi

SILENT=0; JSON=0; ONLY_DOWN=0; FAIL_ON_DOWN=0; WITH_DEPLOYS=0
for arg in "$@"; do
  case "$arg" in
    --silent) SILENT=1 ;;
    --json) JSON=1; SILENT=1 ;;
    --down) ONLY_DOWN=1 ;;
    --fail-on-down) FAIL_ON_DOWN=1 ;;
    --deployments) WITH_DEPLOYS=1 ;;
    -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $arg (see --help)" >&2; exit 2 ;;
  esac
done

if [[ $JSON -eq 0 && -t 1 ]]; then
  G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[34m'; DIM=$'\e[2m'; N=$'\e[0m'
else
  G=""; R=""; Y=""; B=""; DIM=""; N=""
fi

notify() { # $1 = ok | fail  (success: 3 beeps + voice · failure: 1 beep + voice)
  [[ $SILENT -eq 1 ]] && return 0
  if [[ "$1" == ok ]]; then
    for _ in 1 2 3; do printf '\a'; sleep 0.25; done
    say -v Samantha "Coolify status check complete"
  else
    printf '\a'
    say -v Samantha -r 170 "Coolify status check failed"
  fi
}

die() { # operational error path: message, red, fail audio, timing, exit 2
  echo "${R}✗ $1${N}" >&2
  notify fail
  echo "⏱️  Start: $START_TS | End: $(date '+%Y-%m-%d %H:%M:%S') | Duration: $(($(date +%s) - START_EPOCH))s" >&2
  exit 2
}

step() { [[ $JSON -eq 1 ]] || echo "${B}▶ $1${N}"; }

command -v jq >/dev/null 2>&1 || die "jq is required (brew install jq)"
[[ -n "${COOLIFY_TOKEN:-}" ]] || die "no COOLIFY_TOKEN (set env or create $TOKEN_FILE)"

api() { curl -fsS --retry 2 --retry-delay 1 -m 25 -H "Authorization: Bearer ${COOLIFY_TOKEN}" "${COOLIFY_URL}/api/v1$1"; }

step "[1/4] Fetching applications"
APPS="$(api /applications)" || die "applications fetch failed"
step "[2/4] Fetching services"
SERVICES="$(api /services)" || die "services fetch failed"
step "[3/4] Fetching databases"
DATABASES="$(api /databases)" || die "databases fetch failed"
DEPLOYS="[]"
if [[ $WITH_DEPLOYS -eq 1 ]]; then
  step "[3/4] Fetching in-progress deployments"
  DEPLOYS="$(api /deployments)" || die "deployments fetch failed"
fi
step "[4/4] Building report"

MERGED="$(jq -n \
  --arg url "$COOLIFY_URL" \
  --argjson apps "$APPS" --argjson svcs "$SERVICES" --argjson dbs "$DATABASES" --argjson deps "$DEPLOYS" '
  {
    fetched_at: (now | todateiso8601),
    coolify_url: $url,
    applications: [ $apps[] | { kind: "application", uuid, name, status,
        fqdn: (if (.fqdn | type) == "string" then (.fqdn | split(",")[0]) else null end), updated_at } ],
    services:   [ $svcs[] | { kind: "service",   uuid, name, status,
        fqdn: (if (.fqdn | type) == "string" then (.fqdn | split(",")[0]) else null end), updated_at } ],
    databases:  [ $dbs[] | { kind: "database",   uuid, name, status, fqdn: null, updated_at } ],
    deployments_in_progress: [ $deps[] | { kind: "deployment", uuid,
        deployment_uuid: (.deployment_uuid // .uuid), application_name: (.application_name // null),
        status, created_at: (.created_at // null) } ]
  }')" || die "response parse failed (check token/instance)"

ALL="$(echo "$MERGED" | jq '[ .applications[], .services[], .databases[] ]')"
DOWN="$(echo "$ALL" | jq '[ .[] | select((.status | startswith("running")) | not) ]')"
DOWN_COUNT="$(echo "$DOWN" | jq 'length')"
RUN_COUNT="$(echo "$ALL" | jq '[ .[] | select(.status | startswith("running")) ] | length')"
ALL_COUNT="$(echo "$ALL" | jq 'length')"

if [[ $JSON -eq 1 ]]; then
  echo "$MERGED"
else
  if [[ $ONLY_DOWN -eq 1 ]]; then VIEW="$DOWN"; else VIEW="$ALL"; fi
  echo "${B}Coolify deployment status — ${COOLIFY_URL}${N}"
  printf "${DIM}%-11s %-38s %-22s %-46s %-10s${N}\n" "KIND" "NAME" "STATUS" "URL" "UPDATED"
  echo "$VIEW" | jq -r '.[] | [.kind, .name, .status, (.fqdn // "-"), (.updated_at // "-")] | @tsv' |
  while IFS=$'\t' read -r kind name status fqdn updated; do
    case "$status" in
      running:*) C="$G" ;;
      exited*|degraded*|stopped*) C="$R" ;;
      *) C="$Y" ;;
    esac
    printf '%-11s %-38s %s%-22s%s %-46s %-10s\n' "$kind" "${name:0:38}" "$C" "${status:0:22}" "$N" "${fqdn:0:46}" "${updated:0:10}"
  done
  if [[ $WITH_DEPLOYS -eq 1 ]]; then
    echo
    echo "${B}In-progress / queued deployments${N}"
    echo "$MERGED" | jq -r '.deployments_in_progress[] | [.deployment_uuid, (.application_name // "-"), .status] | @tsv' |
    while IFS=$'\t' read -r duuid app dstatus; do
      printf '%-32s %-38s %s%s%s\n' "${duuid:0:32}" "${app:0:38}" "$Y" "$dstatus" "$N"
    done
    [[ "$(echo "$MERGED" | jq '.deployments_in_progress | length')" -gt 0 ]] || echo "  (none)"
  fi
  echo
  echo "${G}✓ running: ${RUN_COUNT}${N} / ${ALL_COUNT}   ${R}✗ not running: ${DOWN_COUNT}${N}"
fi

notify ok
if [[ $JSON -eq 1 ]]; then
  echo "⏱️  Start: $START_TS | End: $(date '+%Y-%m-%d %H:%M:%S') | Duration: $(($(date +%s) - START_EPOCH))s" >&2
else
  echo "⏱️  Start: $START_TS | End: $(date '+%Y-%m-%d %H:%M:%S') | Duration: $(($(date +%s) - START_EPOCH))s"
fi

if [[ $FAIL_ON_DOWN -eq 1 && $DOWN_COUNT -gt 0 ]]; then
  echo "${R}--fail-on-down: ${DOWN_COUNT} resource(s) not running${N}" >&2
  exit 1
fi
exit 0
