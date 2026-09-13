---
status: accepted
---

# Amend the Reset With the Credential Handoff Capability

The reset defers Human Workflows (ADR-0012) because runtime-native interaction covers ordinary questions and approvals. Credential handoff does not qualify as an ordinary runtime interaction: a runtime cannot hold credentials a human has not yet supplied, and the agent's own runtime is the threat it must not expose secrets to. Demand is now demonstrated — the owner requires credential handoff in the launch boundary — so the rebuilt launch adds a purpose-built **Credential Handoff** capability on the reset foundations.

## What the capability is

A Connection-authenticated agent declares a credential request (agent-declared field schema; types `email | text | password | textarea`, no OTP type); a human fills a public possession-only link; values are AES-256-GCM encrypted at rest under a per-account DEK; the creating agent decrypts on demand until closure (agent-done, 24h session TTL, or revoke); every decryption is activity-logged; closure crypto-erases ciphertext and tokens. The agent is notified of submission by a signed HMAC webhook when a callback URL was provided, with polling as the universal fallback. Owner tools are list, revoke, and audit — the owner can never decrypt.

## Deliberate deviations from the reset defaults

1. **Webhook notify (deviation from Inbox-only notify).** Submission notices go to a signed HMAC webhook (verify by rebuilding `v1=<hex>` over `timestamp.body` with the per-connection callback secret; fresh-timestamp window; SSRF-guarded private-range resolution) plus polling. This is an explicit, contained exception to the reset's Inbox Event notification stance (ADR-0019); Inbox Event notify remains the revisitable alternative if webhook burden proves high.
2. **Connection credentials as the key hierarchy.** The v2 key roles (admin/agent/approval-proxy) do not return. The Connection IS the agent key (create/decrypt/own, D8 mapping), the Account Owner replaces admin (list/revoke/audit, never decrypt), the approval-proxy role is dropped (owner covers revoke). Legacy plaintext-key vocabulary stays out of product language.

## What stays decided from the original grill (D1–D10)

Field schema (D6), two-scope magic link (D4), decrypt-on-demand session model (D5), crypto-erasure on closure, masked-only surfaces, no CAPTCHA with defense-in-depth abuse controls (D9), webhook+long-poll notify (D7), zero-secret dashboard section (D10). Pricing rides the reset plan catalogue (Free/Plus/Pro, ADR-0022) rather than standalone D1 pricing. Public naming uses "Credential Handoff"; internal resource id prefix stays `cv_` for continuity with the parked implementation.

## Parked sub-decisions with revisit triggers

Passcode factor on the human link, email-OTP type, submit-echo masking policy, white-label form theming, proxy-injection mode. Proxy-injection (agent sends third-party requests through AgentUtils which injects the credential) remains a different product with different liability and is consciously excluded.

## Consequences

- The design doc and master plan gain a Credential Handoff section; a child plan slots into the suite after foundation (plan 1.5) since webhook notify does not require Inbox.
- The reset's "no arbitrary outbound webhooks" position gains a documented, SSRF-guarded exception; any future notify capability should reuse this machinery or move to Inbox Events.
- Legacy v2 surfaces remain deleted; the capability is rebuilt fresh on Account/Connection primitives, reusing the parked crypto-core design (branch `handoff/model-crypto-core`) where the layer is surface-agnostic.
