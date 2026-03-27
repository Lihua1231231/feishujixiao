# Calibration Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the final review workspace easier for human operators to understand by renaming the first tab, adding plain-language guidance to each tab, and ensuring configured reviewers render as human names instead of raw IDs.

**Architecture:** Keep the change focused on the existing final review data helper and calibration page. Resolve final review config users against full user records, then update the UI copy to explain each page and each top progress card in business language.

**Tech Stack:** Next.js App Router, React, Prisma, node:test

---

### Task 1: Lock the new copy and name-rendering behavior with tests

**Files:**
- Modify: `scripts/test-final-review-backend.mjs`
- Modify: `scripts/test-final-review-ui.mjs`

- [ ] Add a failing backend test that asserts final review config/data helpers are not limited to non-admin users, so configured admin reviewers can render with names.
- [ ] Run: `node --test scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`
Expected: FAIL because the UI still says `原则与战情` and the helper/config route still filter out admins.

### Task 2: Implement the plain-language guidance and human-readable names

**Files:**
- Modify: `src/lib/final-review.ts`
- Modify: `src/app/api/admin/final-review-config/route.ts`
- Modify: `src/app/(main)/calibration/page.tsx`

- [ ] Update final review data loading so configured users are resolved from all users, including admins.
- [ ] Rename the first tab from `原则与战情` to `原则`.
- [ ] Add direct, always-visible guidance blocks to all three tabs.
- [ ] Rewrite the progress card labels/descriptions into simple operator-facing language.
- [ ] Ensure the leader submission card renders evaluator names, never raw IDs.

### Task 3: Verify the change end-to-end and publish

**Files:**
- Verify only

- [ ] Run: `node --test scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs`
Expected: PASS
- [ ] Run: `npx eslint --no-warn-ignored scripts/test-final-review-backend.mjs scripts/test-final-review-ui.mjs 'src/app/(main)/calibration/page.tsx' src/app/api/admin/final-review-config/route.ts src/lib/final-review.ts`
Expected: PASS
- [ ] Run: `npm run build`
Expected: PASS
- [ ] Commit and push the change to `origin/main`.
