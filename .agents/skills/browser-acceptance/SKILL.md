---
name: browser-acceptance
description: Verify the manager loop, accessibility, responsive behavior, and keyless judging path in real browsers.
---

# Browser Acceptance

Before planning screenshots and before final submission:

1. Build production assets and run `pnpm test:e2e`.
2. Before claiming implementation/browser PASS, run
   `pnpm test:e2e:pre-release`. This must execute BG-01–11 and BG-13–15 across
   every configured Playwright project. A missing browser executable is a blocker;
   install the exact declared Playwright runtime and rerun. Only BG-12 may remain
   deferred because it requires a stamped release and deployed URL.
3. Test the first-screen loop at desktop and mobile widths: inspect evidence,
   change formation/roles/instructions, run the matchup, and understand the
   tradeoff without instructions from the author.
4. Verify keyboard access, visible focus, readable contrast, non-color-only
   feedback, Korean text wrapping, and useful empty/error/loading states.
5. Test direct page load and refresh with no login, payment, browser extension,
   private API key, or warm local storage.
6. Record browser/version, public URL, timestamp, result, screenshot/video path,
   failure, and next action in `docs/submission-ledger.md`.

Do not accept a click animation as a functioning interaction. The manipulated
state must change a deterministic domain result or a clearly labeled simulation.
Do not report the pre-release run as deployment evidence. BG-12 and the public
ledger remain mandatory after the exact release is deployed.
