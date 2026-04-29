# OTP Tool — Limitations & Required Code Updates

## Context

Virtual/VoIP numbers (Twilio, Vonage, Telnyx, etc.) are actively detected and blocked by major platforms. This affects what the OTP tool can realistically deliver.

## What Works
- Niche / lesser-known platforms with no VoIP blocklist
- Internal or enterprise SMS verification systems
- Third-party APIs that use SMS but don't maintain number blocklists
- Agent test environments

## What Doesn't Work
- WhatsApp
- Google / Gmail
- Meta (Instagram, Facebook)
- Coinbase, Binance, most crypto platforms
- Any major platform that has been targeted by SMS fraud at scale

---

## Required Code Changes

### 1. API response — add `limitations` field
In `app/api/otp/route.ts`, include a `limitations` field in the provisioning response so agents know upfront:

```typescript
return successResponse({
  sessionId: session.id,
  phoneNumber: session.phoneNumber,
  status: 'waiting',
  expiresAt: session.expiresAt,
  limitations: {
    note: 'Virtual numbers are blocked by some major platforms.',
    blockedBy: ['WhatsApp', 'Google', 'Meta', 'most crypto exchanges'],
    worksFor: ['niche platforms', 'internal systems', 'third-party APIs without VoIP blocklists'],
  },
}, 201);
```

### 2. Docs page — add limitations callout
In `app/docs/otp/page.tsx`, add a visible warning callout before the usage examples:

```
⚠️ Platform Compatibility
Virtual numbers are blocked by WhatsApp, Google, Meta, and major crypto
exchanges. This tool works for niche platforms, internal systems, and
third-party APIs that do not maintain VoIP blocklists.
```

### 3. OpenAPI spec — update description
In `app/api/docs/route.ts`, update the `/api/otp` description:

```typescript
description: 'Provision a temporary phone number to receive SMS verification codes. Note: virtual numbers are blocked by WhatsApp, Google, Meta, and major crypto exchanges. Works for niche platforms and internal systems.'
```

### 4. llms.txt — update tool description
After running `generate-llms-txt.mjs`, verify the OTP section reflects the limitation so LLM agents consuming the tool discovery file don't attempt to use it against incompatible platforms.

### 5. Decision matrix — update moat assessment
In `docs/product/tool-decision-matrix.md`, add a note to the OTP row:

```
Caveat: virtual numbers are blocked by major platforms (WhatsApp, Google, Meta).
Addressable use case is ~40% of real-world SMS verification targets.
```

---

## Twilio ToS Risk
Twilio explicitly prohibits using their numbers to bypass another platform's verification at scale. Accounts doing this get terminated. Frame the tool docs around legitimate use cases (internal systems, niche APIs) to protect account standing.

## Number Degradation
Number ranges associated with virtual providers get added to blocklists over time. Even if a number works today against a given platform, it may stop working in weeks/months. No code fix for this — it's a structural limitation of the approach.

---

## Priority
- **P2** — Tool works for its legitimate use cases today. Add the limitations disclosure before next public launch to avoid user frustration and support load.
