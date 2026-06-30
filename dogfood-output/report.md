# ClaudeOrNot QA Report

## Executive Summary
- **Scope:** Main interaction flow on https://www.claudeornot.com/
- **Total issues found:** 1
- **Severity breakdown:** High: 1, Medium: 0, Low: 0

## Issue 1 — Recommendation flow fails with OpenRouter 401
**Severity:** High
**Category:** Functional

**URL:** https://www.claudeornot.com/

**Description:**
Submitting the main form triggers an error instead of returning a recommendation. The page displays:
`OpenRouter API error 401: {"error":{"message":"User not found.","code":401}}`

**Steps to reproduce:**
1. Open the homepage.
2. Click an example prompt or type any agent functionality description.
3. Click **Claude Or Not? 🤔**.

**Expected behavior:**
The app should return a recommendation (skill.md vs agents.md) and generated markdown content.

**Actual behavior:**
The app shows an OpenRouter 401 error and no recommendation is produced.

**Console errors:**
- No browser console errors were reported during testing.

**Evidence:**
- MEDIA:/home/gibson/.hermes/profiles/discovery/cache/screenshots/browser_screenshot_89169ed02ef64d75948572aa14a04937.png

## Summary Table
| # | Title | Severity | Category |
|---|---|---|---|
| 1 | Recommendation flow fails with OpenRouter 401 | High | Functional |

## Testing Notes
- Smoke-tested the homepage with curl: HTTP 200.
- Tested the primary flow using multiple example prompts.
- No JS console errors were observed.
- The issue appears to block the core product value proposition.
