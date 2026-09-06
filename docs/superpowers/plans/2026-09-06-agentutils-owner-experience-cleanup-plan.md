# AgentUtils Owner Experience and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild onboarding, dashboard, public website, documentation, and deployment material around the approved Inbox-first product, then remove every superseded utility and unsupported claim.

**Architecture:** The browser experience is for non-developer and semi-technical Agent Owners. Google sign-in leads to one short connection flow: name the Agent, copy a ten-minute Pairing Code into the Agent conversation, complete the runtime's one required reload/restart, and see confirmation. The dashboard organizes oversight around Agents, Inboxes, Data, Usage & Billing, and Settings. Marketing and generated technical docs use the same product facts and contract registry.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Firebase Auth, Playwright, generated contract data, Stripe-hosted Checkout/portal, Docker/Coolify.

**Additional implementation skill:** Use `frontend-design` when creating the new visual system and `web-design-guidelines` before the accessibility/UX gate. Preserve the product decisions and plain-language information architecture in this plan.

---

## Task 1: Replace login and API-key onboarding with Google plus Pairing Code

**Files:**

- Modify: `app/login/page.tsx`
- Modify: `app/login/layout.tsx`
- Create: `app/onboarding/page.tsx`
- Create: `components/onboarding/ConnectAgentFlow.tsx`
- Create: `components/onboarding/PairingCode.tsx`
- Create: `lib/connections/runtime-instructions.ts`
- Modify: `middleware.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `__tests__/connections/runtime-instructions.test.ts`
- Test: `e2e/onboarding.spec.ts`

- [ ] Replace login with one `Continue with Google` action, a short privacy sentence, and a link to Terms/Privacy. Remove email/password fields and every link to `/signup`.

- [ ] Build a three-screen owner flow:

```text
1. Name your Agent and choose Codex, Hermes, or Another Agent.
2. Copy this ten-minute Pairing Code and tell the Agent to connect to AgentUtils.
3. Complete the runtime-specific reload/restart only when needed; show Connected after server confirmation.
```

- [ ] Verify that the owner UI does not expose an API key, Connection credential, raw MCP configuration, webhook signature explanation, or terminal command by default.

- [ ] Generate a pasteable Agent instruction containing `APP_URL`, runtime, and Pairing Code. The instruction tells the Agent to redeem `POST /v1/connections/pair`, store the returned credential in its own MCP configuration, connect to `${APP_URL}/mcp`, verify `connection_status`, and report success. Never put the Pairing Code in a URL, analytics event, server log, or browser persistence.

- [ ] For Codex, generate Agent-facing configuration using the currently supported Streamable HTTP `url` and `http_headers` mechanism, never unsupported `bearer_token`. The Agent writes `Authorization: Bearer <credential>` and ensures the local config is owner-readable only; the owner is then asked to restart/reload Codex once.

- [ ] For Hermes, generate Agent-facing configuration under `~/.hermes/config.yaml` with remote `url` and `headers`, then use Hermes' MCP reload behavior. Keep this text behind the pasteable Agent instruction, not as owner-facing setup jargon.

- [ ] Unit-test runtime templates for exact MCP URL, no credential placeholders shown to owner, and no Pairing Code in resulting config after redemption. Recheck templates against official Codex and Hermes documentation at implementation time.

- [ ] Poll the Firebase-owner Agent/Connection route for confirmation with exponential backoff capped at five seconds and stop at code expiry. Provide `Create a new code` after expiry and a plain-language retry for connection failure.

- [ ] Update middleware to protect `/onboarding` and `/dashboard`, redirect signed-in owners with no active Connection to onboarding, and remove signup from public/bounce logic. Data authorization remains server-side.

- [ ] Add `playwright.config.ts` with a production-like `webServer`, trace on first retry, screenshots on failure, desktop Chromium, and a 390px mobile project. Add `"test:e2e": "playwright test"` to `package.json`; do not download or add extra browsers unless a cross-browser issue is in scope.

- [ ] Install the test runner and automated accessibility helper, then install only Chromium locally:

```bash
npm install -D @playwright/test@^1.63.0 @axe-core/playwright@^4.13.0
npx playwright install chromium
```

- [ ] Run `npm test -- __tests__/connections/runtime-instructions.test.ts && npx playwright test e2e/onboarding.spec.ts`; expect Google-auth fixture, code expiry, successful confirmation, and retry states to pass.

- [ ] Commit:

```bash
git add app/login app/onboarding components/onboarding lib/connections/runtime-instructions.ts middleware.ts playwright.config.ts package.json package-lock.json __tests__/connections/runtime-instructions.test.ts e2e/onboarding.spec.ts
git commit -m "feat: add plain language agent onboarding"
```

## Task 2: Build the dashboard shell and Overview

**Files:**

- Modify: `app/dashboard/layout.tsx`
- Modify: `app/dashboard/page.tsx`
- Create: `components/dashboard/DashboardShell.tsx`
- Create: `components/dashboard/DashboardNav.tsx`
- Create: `components/dashboard/StatusBadge.tsx`
- Create: `components/dashboard/UsageMeter.tsx`
- Create: `app/api/dashboard/overview/route.ts`
- Test: `e2e/dashboard-overview.spec.ts`

- [ ] Build responsive navigation with exactly Overview, Agents, Inboxes, Data, Usage & Billing, and Settings. Use labels and icons together; keep active location visible and keyboard accessible.

- [ ] Make Overview answer four owner questions in this order: Is my Agent connected? Is anything waiting or needing attention? Am I near a limit? What happened recently?

- [ ] Aggregate only safe metadata from Connection status, Event counts/status, usage counters, and Activity Records. Never send Event bodies, State values, filenames, receiving addresses, credentials, or signed URLs in the Overview payload.

- [ ] Use owner-facing state labels: Connected, Needs attention, Received, Processing, Completed, Unverified, Expiring, and Suspended. Put request IDs and technical codes under an `Advanced details` disclosure.

- [ ] Include meaningful empty, loading, error, and partial-outage states. An unavailable billing panel must not hide working Inboxes.

- [ ] Run `npx playwright test e2e/dashboard-overview.spec.ts`; expect desktop/mobile navigation, empty state, attention state, 80/100 usage, and keyboard flow to pass.

- [ ] Commit:

```bash
git add app/dashboard components/dashboard app/api/dashboard/overview e2e/dashboard-overview.spec.ts
git commit -m "feat: add agent owner dashboard overview"
```

## Task 3: Build Agents and Inboxes owner views

**Files:**

- Create: `app/dashboard/agents/page.tsx`
- Create: `app/dashboard/agents/[agentId]/page.tsx`
- Create: `app/dashboard/inboxes/page.tsx`
- Create: `app/dashboard/inboxes/[inboxId]/page.tsx`
- Create: `components/dashboard/AgentCard.tsx`
- Create: `components/dashboard/InboxTable.tsx`
- Create: `components/dashboard/InboxSetupGuide.tsx`
- Create: `components/dashboard/EventDetail.tsx`
- Test: `e2e/dashboard-agents.spec.ts`
- Test: `e2e/dashboard-inboxes.spec.ts`

- [ ] Agents lists logical Agent name, runtime, active/needs-attention/revoked Connection state, last activity, and actions to connect another runtime or revoke. Never list or recover a credential.

- [ ] Inboxes lists name, assigned Agent, source, setup state, Verified/Unverified label, health, Received/Processing/Completed counts, next expiry, and Trash actions.

- [ ] Build guided setup for Stripe, GitHub, Coolify, Generic HMAC, and Universal. Stripe uses create-address-first then endpoint-secret entry. GitHub and Generic HMAC display the generated setup secret once with a copy acknowledgement. Coolify remains visibly Unverified with a concise explanation that its outgoing notification currently has no signature/header.

- [ ] Show the stable receiving address only after an explicit `Show address` owner action. Copying it is not an analytics event. Do not render it into the initial page HTML.

- [ ] Event detail uses deterministic source fields from `event-presenter`, not generated summaries. Raw body and headers require an Advanced disclosure and remain access controlled.

- [ ] Reassign/share actions list only Agents in the same Account. Deletion explains immediate receipt stoppage and seven-day restoration.

- [ ] Run `npx playwright test e2e/dashboard-agents.spec.ts e2e/dashboard-inboxes.spec.ts`; expect pairing/revocation, every setup mode, Event states, grants, reassignment, delete/restore, and mobile behavior to pass.

- [ ] Commit:

```bash
git add app/dashboard/agents app/dashboard/inboxes components/dashboard app/api/inboxes e2e/dashboard-agents.spec.ts e2e/dashboard-inboxes.spec.ts
git commit -m "feat: add agent and inbox oversight"
```

## Task 4: Build the Data view for State and Files

**Files:**

- Create: `app/dashboard/data/page.tsx`
- Create: `app/dashboard/data/state/[stateId]/page.tsx`
- Create: `app/dashboard/data/files/[fileId]/page.tsx`
- Create: `components/dashboard/StateTable.tsx`
- Create: `components/dashboard/StateDetail.tsx`
- Create: `components/dashboard/FileTable.tsx`
- Create: `components/dashboard/FileDetail.tsx`
- Test: `e2e/dashboard-data.spec.ts`

- [ ] Use State and Files tabs under one Data page. Default tables show safe metadata; content requires opening a specific authorised record.

- [ ] State detail shows exact JSON, owner Agent, version, size, expiry, and explicit Agent access. The normal owner path supports inspect, grant override, revoke, delete, and restore; it does not present a raw database editor.

- [ ] File detail shows safe filename, type, size, owner/source, expiry, grants, and active Sharing Links. Generate download URLs only on click. Show the sixty-second revocation boundary near link revocation.

- [ ] Never preload File bytes or signed URLs. Avoid putting State values or filenames into client analytics, page titles, URL paths, browser storage, or error monitoring breadcrumbs.

- [ ] Run `npx playwright test e2e/dashboard-data.spec.ts`; expect access management, on-demand content, version conflict display, download, link revoke, Trash restore, and inaccessible states to pass.

- [ ] Commit:

```bash
git add app/dashboard/data components/dashboard e2e/dashboard-data.spec.ts
git commit -m "feat: add state and files owner views"
```

## Task 5: Build Usage & Billing, Settings, Trash, and account deletion

**Files:**

- Create: `app/dashboard/billing/page.tsx`
- Create: `app/dashboard/settings/page.tsx`
- Create: `components/dashboard/PlanCard.tsx`
- Create: `components/dashboard/DowngradeSelection.tsx`
- Create: `components/dashboard/Trash.tsx`
- Create: `components/dashboard/AccountDeletion.tsx`
- Test: `e2e/dashboard-billing.spec.ts`
- Test: `e2e/dashboard-settings.spec.ts`

- [ ] Show current plan, monthly price, exact Connection/Inbox/Event/File/State usage and limits, reset period, Event retention, File lifetime, and 80/100 state from the shared plan catalogue.

- [ ] Free owners see Plus and Pro upgrade actions. Paid owners use Stripe's portal for payment methods, invoices, plan change, and cancellation. Clearly state that entitlement updates after secure billing confirmation.

- [ ] Show the seven-day downgrade grace deadline and require valid Connection/Inbox selection when over the target plan. Explain the earliest-created fallback in plain language.

- [ ] Settings contains owner profile, actionable email preferences, security/Connection activity, Trash, and Account deletion. It does not contain API keys or webhook developer settings.

- [ ] Permanent resource deletion and Account deletion use explicit confirmation, exact resource/account name, and irreversible consequence text. Account deletion shows the seven-day cancellation deadline.

- [ ] Run `npx playwright test e2e/dashboard-billing.spec.ts e2e/dashboard-settings.spec.ts`; expect Checkout redirect, portal redirect, downgrade selection, Trash, deletion request, cancellation, and keyboard tests to pass.

- [ ] Commit:

```bash
git add app/dashboard/billing app/dashboard/settings components/dashboard e2e/dashboard-billing.spec.ts e2e/dashboard-settings.spec.ts
git commit -m "feat: add billing settings and lifecycle controls"
```

## Task 6: Rebuild the public website around Inbox first

**Files:**

- Modify: `app/page.tsx`
- Create: `app/how-it-works/page.tsx`
- Create: `app/integrations/page.tsx`
- Create: `app/state/page.tsx`
- Create: `app/files/page.tsx`
- Create: `app/pricing/page.tsx`
- Create: `components/marketing/Header.tsx`
- Create: `components/marketing/Hero.tsx`
- Create: `components/marketing/Workflow.tsx`
- Create: `components/marketing/Capability.tsx`
- Create: `components/marketing/PricingTable.tsx`
- Modify: `components/Footer.tsx`
- Modify: `components/MobileNav.tsx`
- Modify: `app/not-found.tsx`
- Modify: `app/globals.css`
- Test: `e2e/marketing.spec.ts`

- [ ] Use this exact homepage hero:

```text
Give your AI agent an inbox for the outside world.

Connect Codex, Hermes or another AI agent so it can receive updates from apps, keep exact shared information and exchange files—even when you are elsewhere.
```

- [ ] Use primary CTA `Connect my agent` to Google sign-in/onboarding and secondary CTA `See how it works`. Navigation is How it works, Integrations, Pricing, Docs, Sign in, plus the primary CTA.

- [ ] Explain the product through one concrete flow: connect Agent, create Inbox, connect an outside source, receive Event, process it later. Present State and Files as supporting capabilities after Inbox.

- [ ] State the at-least-once behavior and no disconnected-runtime wake guarantee in plain language where reliability is discussed. Do not lead with an infrastructure/control-plane abstraction.

- [ ] Pricing must render all exact values from `PLANS`; do not duplicate them as page constants. Show monthly-only US$0/US$19/US$49, hard limits, retention, no overages, and no annual/enterprise claims.

- [ ] Use a distinctive, calm product design appropriate for professional non-developers. Keep readable type, strong hierarchy, real product-state examples, responsive layouts, 44px controls, visible focus, reduced-motion support, and adequate contrast. Avoid fake terminal demos as the main explanation.

- [ ] Rebuild the not-found page with the public Header/Footer and clear links to Home, Integrations, Pricing, and Docs. Do not expose private route names or legacy utility links.

- [ ] Run `npx playwright test e2e/marketing.spec.ts`; expect navigation, CTAs, pricing values, mobile layout, metadata, and forbidden-copy assertions to pass.

- [ ] Commit:

```bash
git add app/page.tsx app/how-it-works app/integrations/page.tsx app/state app/files app/pricing app/not-found.tsx components/marketing components/Footer.tsx components/MobileNav.tsx app/globals.css e2e/marketing.spec.ts
git commit -m "feat: rebuild the Inbox first public website"
```

## Task 7: Publish integration pages and one generated documentation system

**Files:**

- Create: `app/integrations/stripe/page.tsx`
- Create: `app/integrations/github/page.tsx`
- Create: `app/integrations/coolify/page.tsx`
- Create: `app/integrations/codex/page.tsx`
- Create: `app/integrations/hermes/page.tsx`
- Modify: `app/docs/layout.tsx`
- Modify: `app/docs/page.tsx`
- Create: `app/docs/api/page.tsx`
- Create: `app/docs/mcp/page.tsx`
- Create: `components/docs/GeneratedOperation.tsx`
- Create: `components/docs/CodeExample.tsx`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Test: `__tests__/contracts/docs-content.test.ts`
- Test: `e2e/docs.spec.ts`

- [ ] Integration pages describe only implemented inbound reception or Agent connection. Stripe/GitHub explain Verified. Coolify displays Unverified in the heading and setup steps. Codex/Hermes explain Agent connection, not external-event sources.

- [ ] Do not claim OAuth access, account syncing, remote source actions, immediate runtime wake-up, exactly-once behavior, or vendor endorsement.

- [ ] Render MCP tools, HTTP operations, examples, errors, limits, and retention from generated contract/plan data. Keep one product version: public HTTP paths are `/v1`, but headings do not brand the product as v2.

- [ ] Include a non-technical first page and separate advanced MCP/HTTP references. Every example must be imported from `lib/contracts/examples.ts` and validated by contract tests.

- [ ] Rewrite README for local setup, test/build, private B2, Stripe, Docker/Coolify, maintenance, MCP endpoint, and security boundaries. Remove Vercel instructions and old utility catalogue.

- [ ] Rewrite CONTRIBUTING for the new module boundaries, generated-contract workflow, test layers, secret rules, conventional commits, and Coolify handoff. Remove Twilio, old API-key, and legacy tool examples.

- [ ] Run `npm run generate:contracts && npm test -- __tests__/contracts/docs-content.test.ts && npx playwright test e2e/docs.spec.ts`; expect generated examples, links, responsive code blocks, and forbidden-claim tests to pass.

- [ ] Commit:

```bash
git add app/integrations app/docs components/docs README.md CONTRIBUTING.md public/openapi.json public/llms.txt __tests__/contracts e2e/docs.spec.ts
git commit -m "docs: publish generated AgentUtils guidance"
```

## Task 8: Rewrite metadata, legal pages, sitemap, robots, health, and deployment surface

**Files:**

- Modify: `app/layout.tsx`
- Modify: `app/opengraph-image.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `app/terms/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/robots.ts`
- Modify: `app/api/health/route.ts`
- Modify: `next.config.ts`
- Modify: `Dockerfile`
- Modify: `.dockerignore`
- Modify: `.github/workflows/deploy.yml`
- Test: `e2e/seo-legal.spec.ts`

- [ ] Update title/description/Open Graph around Inbox, State, and Files. Remove DLQ, Human-in-the-Loop, Audit, Scheduler, KV, one-key, and unsupported production-ready claims.

- [ ] Keep the root layout limited to fonts, global styles, metadata, analytics, and AuthProvider. Remove the global marketing Footer so dashboard, login, onboarding, MCP, and private share flows do not inherit public-site chrome; public pages render Header/Footer through the marketing components.

- [ ] Rewrite Privacy and Terms to accurately identify Firebase, MongoDB, Backblaze B2, Stripe, Resend, and the Coolify-hosted application; approved content retention; seven-day Trash/account cancellation; backup deletion within thirty days; billing-record legal retention; and security limits. Do not claim certifications, encryption guarantees, residency, uptime, or compliance not actually established.

- [ ] Sitemap only the approved public information architecture. Robots disallows `/api`, `/v1`, `/mcp`, `/hooks`, `/share`, `/dashboard`, `/onboarding`, and login from indexing while allowing public product/docs pages.

- [ ] Add permanent redirects:

```text
/tools and retired utility/Human pages -> /how-it-works
/tools/kv-store and /docs/kv-store -> /state
/tools/image-upload and /docs/image-upload -> /files
/docs/v2 -> /docs
```

- [ ] Do not redirect API mutation routes to replacement APIs.

- [ ] Health reports only process/database/storage dependency status and build identifier. It must not expose environment values, object bucket names, Stripe IDs, account counts, or stack traces.

- [ ] Add production security headers in `next.config.ts`: HSTS on HTTPS, `X-Content-Type-Options: nosniff`, a restrictive Referrer Policy, Permissions Policy, frame protection through CSP `frame-ancestors`, and a CSP that permits only the actual Firebase, Stripe, analytics, and B2 flows. Test that MCP, presigned B2 redirects, Google sign-in, and Stripe Checkout still work before tightening sources further.

- [ ] Verify Docker final stage contains production runtime plus `tsx` for maintenance, runs as non-root, exposes only the application port, and includes no secret build arguments.

- [ ] Keep the existing GHCR-to-Coolify deployment workflow, but add install, test, contract-drift, lint, typecheck, and production-build gates before image push/deploy. Remove unused PostHog and legacy environment inputs after `rg` confirms they are absent. Keep only necessary `NEXT_PUBLIC_*` build values as Docker build arguments; runtime secrets remain Coolify environment variables and never enter image layers or workflow output.

- [ ] Run `npx playwright test e2e/seo-legal.spec.ts && npm run build && docker build -t agentutils:site .`; expect valid metadata, redirects, legal links, health response, and image build.

- [ ] Commit:

```bash
git add app/layout.tsx app/opengraph-image.tsx app/privacy app/terms app/sitemap.ts app/robots.ts app/api/health next.config.ts Dockerfile .dockerignore .github/workflows/deploy.yml e2e/seo-legal.spec.ts
git commit -m "chore: align public and deployment metadata"
```

## Task 9: Remove the superseded product and code paths

**Files:**

- Delete: every explicit path in the master plan's Legacy deletion manifest
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `public/vercel.svg`
- Delete: other unused starter assets confirmed by `rg`
- Test: replace legacy tests with the new suites already created

- [ ] Before deletion, run `rg` for every legacy import and confirm the new product no longer depends on it. Extract nothing during this step; reusable logic must already exist under new tested modules.

- [ ] Use `git rm` only on the exact manifest paths. This includes stale OpenClaw skills, v2 product plans, the old pricing proposal, obsolete login screenshots/manual browser scripts, the unrelated dogfood report, the superseded design export, and the manual plan-bypass script. Preserve `CONTEXT.md`, ADRs, the approved design/spec plans, `docs/research`, `.zcode/`, `agent-cards.json`, `anban-tree.json`, and unrelated user-owned untracked files.

- [ ] Remove unused dependencies only after confirming zero imports:

```bash
rg -n "@mozilla/readability|ajv|jsonrepair|twilio|playwright-extra|puppeteer-extra-plugin-stealth|turndown" --glob '!package-lock.json' .
npm uninstall @mozilla/readability ajv jsonrepair twilio playwright-extra puppeteer-extra-plugin-stealth turndown @types/turndown uuid @types/uuid
```

Expected before uninstall: no imports in retained application/test code. Remove direct `playwright` too if only the deleted manual scripts imported it; keep `@playwright/test`, `@axe-core/playwright`, `stripe`, `resend`, AWS SDK, Firebase, Mongoose, MCP, and Zod.

- [ ] Remove `/signup` from middleware and all links. Remove public plaintext API-key code, the Vercel relay, old tick endpoint, public file host, old OpenAPI generator/spec, and v2-labelled docs.

- [ ] Run:

```bash
rg -n "@/lib/v2|@/models/v2|dashboard/keys|file-host|vercel-ntfy" app components lib models __tests__
rg -n "Checkpoint|Confession|Dead Letter|DLQ|Scheduler|Audit Log|KV Store|Image Upload|Human-in-the-Loop|agentutils\\.dev|Vercel" app components lib public README.md next.config.ts package.json
```

Expected: no matches except migration redirects whose source paths must remain literal.

- [ ] Run the full test/build gate before committing deletion.

- [ ] Commit:

```bash
git add -u
git add package.json package-lock.json
git commit -m "chore: remove legacy AgentUtils utilities"
```

## Task 10: Accessibility, security, and complete launch-journey verification

**Files:**

- Create: `e2e/launch-journey.spec.ts`
- Create: `e2e/accessibility.spec.ts`
- Create: `docs/launch/acceptance.md`
- Modify: any new UI file with a verified defect

- [ ] Use a production build and isolated test Account to automate the master plan's full launch journey: Google fixture, Pairing Code, Connection, Inbox source, Event, Claim/complete, State, File, Stripe upgrade fixture, portal, Trash, and expiry.

- [ ] Test at desktop and 390px mobile width. Use `@axe-core/playwright` for automated WCAG checks, then verify keyboard-only completion, visible focus, heading order, labels, live status announcements, dialog focus containment, reduced motion, contrast, zoom to 200 percent, and error recovery manually where automation is insufficient.

- [ ] Run a manual test with one person matching the target audience who did not build the feature. Observe without coaching beyond the words shown in the product. Record date as `DD-Mmm-YYYY`, environment, outcome, confusion points, and linked defects in `docs/launch/acceptance.md`.

- [ ] Execute the final master gate:

```bash
npm test
npx playwright test
npm run check:contracts
npm run maintenance:dry-run
npm run lint
npx tsc --noEmit
npm run build
docker build -t agentutils:launch .
git diff --check
```

Expected: every command exits `0`.

- [ ] Run the master placeholder, legacy-language, secret-field, and generated-drift scans. Inspect every match; do not waive a product-surface match without documenting why it is intentionally retained.

- [ ] After explicit approval to change external staging systems, deploy to a non-production Coolify environment, configure the scheduled maintenance command, execute it manually, wait for one scheduled run, process signed Stripe test webhooks, and verify a private B2 upload/download. Without that approval, prepare the exact handoff checklist and mark these external gates unverified in `docs/launch/acceptance.md`. Never infer production-deployment permission from approval to implement the code.

- [ ] Commit:

```bash
git add e2e docs/launch/acceptance.md
git commit -m "test: verify the AgentUtils launch journey"
```
