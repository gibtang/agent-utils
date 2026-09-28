# AgentUtils public analytics events

These browser events are consent-gated by `AnalyticsConsent` and contain only
route/tool labels or coarse action sources. They must never include API keys,
request bodies, emails, Firebase UIDs, or arbitrary query-string values.

The active bootstrap is `components/AnalyticsConsent.tsx`: it loads the GA4
script only after an explicit accept decision and mirrors that decision into a
same-origin cookie for consent-aware server instrumentation.

| Event | When it fires | Safe parameters |
| --- | --- | --- |
| `tool_viewed` | A public tool page mounts | `tool_slug` |
| `tool_api_example_viewed` | A public tool page mounts and exposes its examples | `tool_slug` |
| `api_call_succeeded` | A v1 handler returns a successful response to a consented browser request | `api_resource`, `http_method`, `response_status` |
| `docs_cta_clicked` | A tool page links to its documentation | `tool_slug`, optional `location` |
| `onboarding_started` | A visitor opens login/dashboard from a public CTA | `destination` |
| `api_key_activated` | The server provisions the first usable key for the signed-in user | `source` (`auth_sync` or `dashboard_key`) |

`api_key_activated` is the activation event. Client analytics are directional;
API usage and billing remain server-side sources of truth.

`api_call_succeeded` is emitted server-side only when a same-origin browser
request carries the explicit `agent_utils_analytics_consent=accepted` cookie,
the GA4 `_ga` client cookie, and the optional Measurement Protocol configuration
(`NEXT_PUBLIC_GA_MEASUREMENT_ID` plus `GA4_MP_API_SECRET`). API-key clients,
requests without consent, and requests without a browser client identifier are
not measured. The event contains only a coarse API resource, HTTP method, and
response status; it never includes keys, request bodies, user IDs, or dynamic
path segments.
