# AgentUtils SEO and activation monitoring checkpoint

This is the saved query specification for the 2026-09-28 action-item review.
It records the filters and decision thresholds without fabricating GSC or GA4
results that are not available in the local checkout.

## Review schedule

- Next review: **2026-10-05**
- GSC property: `sc-domain:agent-utils.com`
- GA4 property: `536822025`

## GSC query

Run a 28-day Search Console query report grouped by query and page, filtered to
these existing surfaces:

- `/tools/audit-log`
- `/tools/image-upload`
- `/tools/scheduler`
- `/docs/audit-log`
- `/docs/image-upload`
- `/docs/scheduler`

Include query terms containing `audit log`, `audit trail`, `scheduler api`, or
`image upload api`. Escalate content work only when a query reaches **50 or
more impressions and average position 30 or better**, or when an activation
event proves product demand.

## GA4 event report

Use event name and landing-page/path dimensions for:

- `tool_viewed`
- `tool_api_example_viewed`
- `docs_cta_clicked`
- `api_call_succeeded`
- `onboarding_started`
- `api_key_activated`

Reconcile `api_call_succeeded` against server logs where possible. The event
is intentionally limited to consented browser calls and coarse resource/method
labels; API keys, request bodies, email addresses, user IDs, and dynamic path
segments must not appear in the report or payload.

## Decision record

At the review, record the date, query window, event totals, the strongest
query/page pair, and one of `continue`, `rework`, or `monitor`. Do not create a
new tool page solely because a low-volume query appears.

## 2026-09-28 Search Console checkpoint

Read-only URL Inspection confirmed both canonical audit-log surfaces are on
Google:

- `https://www.agent-utils.com/tools/audit-log` — **URL is on Google; Page is indexed**.
- `https://www.agent-utils.com/docs/audit-log` — **URL is on Google; Page is indexed**.

The property overview reported 23 total web-search clicks, 15 indexed pages,
and 16 not-indexed pages at the time of review. This is an indexing snapshot,
not a query-level performance claim. The next scheduled review remains
2026-10-05, when the saved query and event report should be rerun.
