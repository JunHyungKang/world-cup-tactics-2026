---
name: submission
description: Preflight and freeze the planning PDF, public app, GitHub repository, and YouTube demo.
---

# Submission

Planning phase:

```bash
pnpm verify
pnpm submission:preflight -- --phase plan --planning-pdf submissions/<plan>.pdf
```

Confirm the PDF covers service overview, manager-experience intent, pages,
interactions, data use, and primary flow. Visually inspect every page.

Final phase:

```bash
pnpm verify
pnpm test:e2e
pnpm submission:preflight -- --phase final \
  --deployed-url https://... --github-url https://... --youtube-url https://...
```

Verify the public deployment in a clean browser without login, payment, or
judge-supplied keys; public repository setup/run/technology documentation; and
a video showing start screen, placement/configuration, core interaction, and
result. Record timestamp, commit, URLs, SHA-256, checks, and external confirmation
in `docs/submission-ledger.md`.

Freeze the final commit before 2026-08-03 10:00 KST. Do not commit afterward;
the official rule says post-deadline commits can cause disqualification.
