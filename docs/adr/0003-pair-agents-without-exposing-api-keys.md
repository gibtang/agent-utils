---
status: accepted
---

# Pair agents without exposing API keys

The standard onboarding journey will pair any supported agent through the same AgentUtils MCP service using a short-lived, single-use Pairing Code generated after the Agent Owner signs in. Creating the code authorises one Connection with ordinary Inbox, State and Files access, while owner-level administration and later requests for unusually sensitive access remain separately protected. This replaces runtime selection, visible OAuth consent screens and manual API-key handling in the normal journey; raw HTTP credentials remain an advanced interface rather than the product's default onboarding model.
