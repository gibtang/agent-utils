# Plan: User Experience Gaps — Signup, Profile, Tool Docs

## Problem
Users can't complete the signup flow (MongoDB User doc never created), have no profile management, and have no per-tool integration documentation.

## Scope
3 work streams, 10 files total.

---

## Work Stream 1: Fix Signup Flow (Minimal Onboarding)

### 1a. Create User-upsert API route
**File**: `app/api/user/route.ts` (NEW)
- `POST /api/user` — called after Firebase signup/login
- Body: `{ firebaseUid, email }`
- Upserts User doc in MongoDB (create if not exists, return existing if found)
- Returns `{ user, isNew }`

### 1b. Add signup callback in AuthContext
**File**: `contexts/AuthContext.tsx` (EDIT)
- After `onAuthStateChanged` fires with a new user, call `POST /api/user`
- Store `isNew` flag so dashboard can show "Create your first API key" prompt

### 1c. Update dashboard new-user prompt
**File**: `app/dashboard/page.tsx` (EDIT)
- If user has zero API keys, show prominent CTA: "Create your first API key to start using the tools"
- Below CTA, show quick curl examples using a placeholder key

---

## Work Stream 2: Basic Profile Page

### 2a. Create profile page
**File**: `app/profile/page.tsx` (NEW)
- Displays: name (editable), email (read-only), tier badge, member since
- Password reset button → calls Firebase `sendPasswordResetEmail`
- Delete account button → confirmation modal → calls `DELETE /api/user`
- Usage summary cards (requests today, files hosted, active checkpoints) — same data as dashboard stubs

### 2b. Create user profile API routes
**File**: `app/api/user/route.ts` (EDIT — add to 1a)
- `GET /api/user` — returns profile data
- `PATCH /api/user` — updates name
- `DELETE /api/user` — deactivates account (sets active=false, revokes all keys)

### 2c. Add nav link to profile
**File**: `app/dashboard/page.tsx` (EDIT)
- Add "Profile" link in dashboard header next to email/logout

---

## Work Stream 3: Per-Tool Documentation Pages

### 3a. Create docs layout
**File**: `app/docs/layout.tsx` (NEW)
- Sidebar nav listing all 7 tools
- Content area for each tool's docs
- "Get API Key" CTA in sidebar header

### 3b. Create docs index
**File**: `app/docs/page.tsx` (NEW)
- Overview of all tools with links to individual docs
- Quick start guide (same curl flow from landing page)

### 3c. Create 7 tool doc pages
Each page: endpoint reference, params table, request/response examples, curl + JS + Python snippets.

**Files** (ALL NEW):
- `app/docs/file-host/page.tsx`
- `app/docs/json/page.tsx`
- `app/docs/dlq/page.tsx`
- `app/docs/checkpoint/page.tsx`
- `app/docs/reader/page.tsx`
- `app/docs/shield/page.tsx`
- `app/docs/otp/page.tsx`

### 3d. Update landing page tool cards
**File**: `app/page.tsx` (EDIT)
- Each tool card links to its `/docs/[tool]` page
- Add "View Docs →" link to each card

---

## File Summary

| Action | File | Stream |
|--------|------|--------|
| NEW | `app/api/user/route.ts` | 1+2 |
| EDIT | `contexts/AuthContext.tsx` | 1 |
| EDIT | `app/dashboard/page.tsx` | 1+2 |
| NEW | `app/profile/page.tsx` | 2 |
| NEW | `app/docs/layout.tsx` | 3 |
| NEW | `app/docs/page.tsx` | 3 |
| NEW | `app/docs/file-host/page.tsx` | 3 |
| NEW | `app/docs/json/page.tsx` | 3 |
| NEW | `app/docs/dlq/page.tsx` | 3 |
| NEW | `app/docs/checkpoint/page.tsx` | 3 |
| NEW | `app/docs/reader/page.tsx` | 3 |
| NEW | `app/docs/shield/page.tsx` | 3 |
| NEW | `app/docs/otp/page.tsx` | 3 |
| EDIT | `app/page.tsx` | 3 |

**Total: 10 new files, 3 edited files**

## Execution Order
1. Stream 1 first (signup fix is blocking — users literally can't use the app)
2. Stream 2 second (profile is quick, 2 files)
3. Stream 3 last (docs are most files but not blocking)

## Estimated Effort
- Stream 1: 3 small changes
- Stream 2: 2 files
- Stream 3: 9 files (template-driven, each doc page follows same structure)
