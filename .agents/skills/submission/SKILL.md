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
  --deployed-url https://... --github-url https://... --youtube-url https://... \
  --demo-video submissions/final-demo.webm \
  --demo-manifest submissions/final-demo.json
```

Verify the public deployment in a clean browser without login, payment, or
judge-supplied keys; public repository setup/run/technology documentation; and
a video showing start screen, placement/configuration, core interaction, and
result. Record timestamp, commit, URLs, SHA-256, checks, and external confirmation
in `docs/submission-ledger.md`.

Final preflight must prove the public default-branch HEAD equals the local
evidence HEAD, every commit after the release commit is ledger-only and before
the deadline, and the preflight itself leaves tracked/nonignored bytes unchanged.

The first round advances only ten entries through weighted voting: submitters
`60%`, participants `20%`, and the public `20%`. Treat the gallery title, first
image, one-line promise, and the video's first five seconds as one top-ten entry
surface understandable to all three groups. Do not fabricate reach, coordinate
votes, spam, or claim preference evidence.

After every existing preflight passes, hand the first valid package to the owner
for submission without delaying it for noncritical polish. Preserve the observed
`plan-submitted` and `final-submitted` receipt timestamps: official tie-breaking
can favor greater vote use and earlier first upload. Speed never waives PDF,
license, public-access, browser, repository, video, hash, or freeze gates.
Do not upload an incomplete draft or placeholder to obtain an earlier timestamp;
only the earliest fully valid package is eligible for this speed advantage.

Freeze the final commit before 2026-08-03 10:00 KST. Do not commit afterward;
the official rule says post-deadline commits can cause disqualification.
