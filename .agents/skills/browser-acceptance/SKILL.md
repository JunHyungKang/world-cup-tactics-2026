---
name: browser-acceptance
description: Verify the manager loop, accessibility, responsive behavior, and keyless judging path in real browsers.
---

# Browser Acceptance

Before planning screenshots and before final submission:

1. Build production assets and run `pnpm test:e2e`.
2. Test the first-screen loop at desktop and mobile widths: inspect evidence,
   change formation/roles/instructions, run the matchup, and understand the
   tradeoff without instructions from the author.
3. Verify keyboard access, visible focus, readable contrast, non-color-only
   feedback, Korean text wrapping, and useful empty/error/loading states.
4. Test direct page load and refresh with no login, payment, browser extension,
   private API key, or warm local storage.
5. Record browser/version, public URL, timestamp, result, screenshot/video path,
   failure, and next action in `docs/submission-ledger.md`.

Do not accept a click animation as a functioning interaction. The manipulated
state must change a deterministic domain result or a clearly labeled simulation.
