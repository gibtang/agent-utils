# Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write integration tests that verify real connectivity to MongoDB (via memory server), Stripe (test mode), and SDK-verified mocks for B2/S3 and Resend.

**Architecture:** Use `mongodb-memory-server` to spin up an ephemeral MongoDB instance per test suite. Stripe tests use `sk_test_*` keys against Stripe's test mode. B2/S3 and Resend use SDK-verified mocks that match the actual SDK interface.

**Tech Stack:** vitest, mongodb-memory-server, mongoose, stripe (test mode)

---

### Task 1: MongoDB Integration Test Setup

**Files:**
- Create: `__tests__/helpers/mongodb.ts` (shared setup/teardown for in-memory MongoDB)
- Create: `__tests__/helpers/setup.ts` (test bootstrap)

**Step 1:** Create shared MongoDB test helper that starts `mongodb-memory-server`, connects mongoose, and cleans collections between tests.

**Step 2:** Run `npx vitest run __tests__/integration/kv-model.test.ts` to verify setup works.

**Step 3:** Commit.

---

### Task 2: KV Model Integration Tests (MongoDB)

**Files:**
- Create: `__tests__/integration/kv-model.test.ts`

**Test cases:**
- Create KvEntry, read it back
- Unique compound index (apiKeyId + key) rejects duplicates
- findOneAndUpdate upsert creates new entry
- findOneAndUpdate upsert updates existing entry
- findOneAndDelete removes entry
- countDocuments with filter
- Expired entries filtered by expiresAt

---

### Task 3: Auth + Usage Integration Tests (MongoDB)

**Files:**
- Create: `__tests__/integration/auth-usage.test.ts`

**Test cases:**
- validateApiKey with real ApiKey + User documents
- Quota tracking via Usage model (atomic upsert with $inc)
- Overage detection when callsIncluded >= callsPerMonth
- Usage compound unique index (apiKeyId + periodStart + periodEnd)

---

### Task 4: Stripe Integration Tests (test mode)

**Files:**
- Create: `__tests__/integration/stripe.test.ts`

**Test cases:**
- `createCheckoutSession` creates a real Stripe checkout session (test mode)
- `createPortalSession` fails gracefully for user without stripeCustomerId
- `handleWebhook` processes `checkout.session.completed` event
- `handleWebhook` processes `customer.subscription.deleted` event (downgrade to free)
- Invalid tier throws error

**Key:** Set `STRIPE_SECRET_KEY` from mj-admin test key, `STRIPE_BUILDER_PRICE_ID` and `STRIPE_PRO_PRICE_ID` need real test price IDs.

---

### Task 5: B2/S3 SDK-Verified Mock Tests

**Files:**
- Create: `__tests__/integration/storage.test.ts`

**Test cases:**
- `uploadFile` calls S3Client.send with correct PutObjectCommand
- `getFile` calls S3Client.send with GetObjectCommand, returns parsed response
- `getFile` returns null for expired files
- `deleteFile` calls S3Client.send with DeleteObjectCommand
- `deleteFile` returns false on S3 error

---

### Task 6: Resend SDK-Verified Mock Tests

**Files:**
- Create: `__tests__/integration/resend.test.ts`

**Test cases:**
- Notify route sends correct payload to Resend SDK
- HTML escaping applied correctly (XSS prevention)
- Fallback to user email when `to` not provided
- Priority color mapping
- Resend failure returns 502 with logged notification
