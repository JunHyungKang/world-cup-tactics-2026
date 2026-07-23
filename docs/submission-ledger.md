# Submission Ledger

| Timestamp (KST) | Phase | Artifact/URL | SHA/commit | Checks | External status | Notes |
|---|---|---|---|---|---|---|
| 2026-07-24T03:10:16+09:00 | plan-visual-qa | output/pdf/corner-policy-lab-planning.pdf | pdf=b9e050a13ff31e4decf9791131607d12613b56a9c2e428b1330f4f19352cba3b source=48df4d062b5e1a5fdbeb29af964d5a2db1b279bd79bdf687171d3f284ebb7048 | visual 8/8 PASS | local | reviewer=/root/pdf_criterion_judge role=independent-agent renderer=pdftoppm/26.05.0 packet=cbff0ff83a149f52caae8ee38efeb7da3da9f0ed1a1a818bf51b9fc1d9876de9 review=6038e217b4c9392f6518a0db9da6a3883facb67a76fdcd5973577fa54f4128da |

For the planning PDF, add a row only after inspecting every rendered page. The
machine-readable fields are:

- timestamp: RFC3339 KST, for example `2026-07-26T21:00:00+09:00`; it must not
  be in the future or after the plan deadline, and must be at or after the final
  PDF file's modification time;
- phase: exactly `plan-visual-qa`;
- Artifact/URL: exactly the final PDF path supplied to plan preflight;
- SHA/commit cell: both `pdf=<64-char SHA-256>` and
  `source=<64-char SHA-256>`;
- Checks cell: exactly `visual 8/8 PASS` after checking clipping, overlap, broken
  glyphs, table legibility, page numbers, headers/footers, and citations;
- External status: exactly `local`;
- Notes use one of two exact evidence routes. A named independent human uses
  `reviewer=<real-name> role=independent-human renderer=<tool/version>
  packet=<review-manifest-sha256>`. A distinct non-creator subagent uses
  `reviewer=/root/<task> role=independent-agent renderer=<tool/version>
  packet=<review-manifest-sha256> review=<agent-review-sha256>`. The agent route
  additionally binds a canonical JSON review whose eight page hashes, sizes,
  dimensions, criteria, zero findings, PDF/source, renderer, and packet hash are
  revalidated. Neither route is participant, usability, preference, or
  memorability evidence. Automated rendering alone is not a visual PASS.

Exactly one `plan-visual-qa` row is allowed. A row with extra cells or any
`FAIL`, `PENDING`, `SKIP`, or `N/A` token is rejected.

To make an independent review fast and exact, run `pnpm planning:review` after
the final planning package is rendered. Open the printed `review.html`, inspect all
eight page renders. A human may copy its row only after the independent-human
attestation becomes available. Alternatively, a separately spawned non-creator
agent must inspect all eight original-detail pages and produce the canonical
SHA-bound review JSON before its distinct agent row is accepted. The packet is
SHA-bound and starts unapproved; generating it or checking boxes by the creator
does not satisfy either route. An agent review must never be recorded as human
evidence.

Run `pnpm planning:handoff` for the owner sequence. The generated page stays
locked while neither valid independent-human nor independent-agent route exists:
it does not expose an upload link or receipt generator. After the valid review row is recorded,
rerun plan preflight and then regenerate the handoff; only that green state
exposes the exact PDF link and an owner-attested `plan-submitted` receipt helper.
The helper never uploads, submits, approves, or observes DAKER state.

After the owner completes the external planning upload/final save, append a
separate receipt row. It does not replace plan preflight:

- phase: exactly `plan-submitted`;
- Artifact/URL: exactly the submitted planning PDF path;
- SHA/commit: exactly `pdf=<the submitted PDF SHA-256>`;
- Checks: exactly `owner-confirmation PASS`;
- External status: exactly `submitted`;
- Notes: exactly `owner=<real-name>
  confirmation=<official-id-or-url-or-screenshot-sha256>`.

Its RFC3339 KST timestamp is the time the owner observed the official
confirmation, not the upload start time, and must be before the planning
deadline. A later plan preflight does not require this row before upload, but if
the row is present it validates its exact cells, PDF binding, uniqueness, time,
owner identity, confirmation token, and forbidden non-pass tokens.

For the final submission, follow `docs/final-submission-contract.md` and add all
four rows. Use the exact phase names and check tokens below; every timestamp must
be RFC3339 KST and no later than `2026-08-03T10:00:00+09:00`.

- `final-browser-qa`: Artifact/URL is the deployed URL; SHA/commit contains
  `commit=<40-char release Git SHA> build=<complete dist content SHA-256> report=<Playwright JSON SHA-256>`;
  Checks is exactly `browser-report PASS artifact-visual PASS voiceover UNAVAILABLE-NO-CLAIM`;
  Notes is exactly `reviewer=/root/<task> role=independent-agent review=<artifact-review SHA-256> Playwright=1.61.1`.
- `github-public`: Artifact/URL is the canonical repository URL; SHA/commit
  contains `commit=<full SHA>`; Checks is exactly
  `public-API PASS release-commit PASS repo-docs PASS`.
- `youtube-public`: Artifact/URL is the canonical watch URL; SHA/commit contains
  `commit=<full SHA> build=<complete dist content SHA-256> video=<exact uploaded
  video SHA-256>`; Checks is exactly `oEmbed PASS demo-contract PASS artifact-audio-visual PASS`;
  Notes is exactly `reviewer=/root/<task> role=independent-agent review=<artifact-review SHA-256>
  source-url=<exact deployed URL> uploader=<real-owner-name>
  confirmation=<content-addressed-owner-attestation-sha256>`.
- `final-freeze`: Artifact/URL is exactly `release`; SHA/commit contains the same
  commit and build values; Checks is exactly `clean PASS deadline PASS`; Notes is
  exactly `preflight=PASS`.

Final preflight also requires `--demo-manifest <path>`, `--artifact-review <path>`,
and `--youtube-upload-confirmation <path>`. The upload-candidate
manifest must bind the exact `--demo-video` bytes to the frozen deployment URL,
release/build marker, capture times, current story and cold-open, and the
frozen-public visual take. The independent-agent review binds those exact bytes
and zero findings; the owner upload confirmation and public oEmbed remain separate.

The build digest covers every file and path under `dist/` except the generated
`submission-build.json` marker, whose contents carry that digest. Do not add
browser or demo PASS tokens from automated HTTP checks. Record the distinct
reviewer task as `reviewer=/root/<task>`. External status must be
`public` for the first three final rows and `frozen` for `final-freeze`. A Checks
cell containing `FAIL`, `PENDING`, `SKIP`, or `N/A` is rejected even if it also
contains PASS tokens.

Every final row contains exactly seven cells. Structured Notes use exactly the documented key order; duplicate or additional
keys are rejected. The artifact review must explicitly disclaim human evidence;
do not relabel agent inspection as VoiceOver or participant testing.

The release commit is the commit used to build and deploy the app. Commit the
four evidence rows afterward; from the release commit to final HEAD, only this
ledger file may change in every individual commit, and the final evidence HEAD
must be the public repository's default-branch HEAD. Run final preflight with
`--release-commit <full SHA>`.
This avoids the impossible requirement for a tracked ledger row to contain the
hash of the commit that adds that same row.

After the owner completes the official final submission/final save, append one
more receipt row:

- phase: exactly `final-submitted`;
- Artifact/URL: exactly `DAKER-final-entry`;
- SHA/commit: exactly `commit=<40-char release Git SHA>
  build=<complete dist content SHA-256>`;
- Checks: exactly `owner-confirmation PASS`;
- External status: exactly `submitted`;
- Notes: exactly `owner=<real-name>
  confirmation=<official-id-or-HTTPS-url-or-screenshot-sha256>`.

The timestamp is the observed official confirmation time and must be no later
than `2026-08-03T10:00:00+09:00`. Commit and push this ledger-only receipt, then
rerun final preflight on clean HEAD. Final preflight does not require this row
before submission, but if present it validates its exact cells, release/build
binding, uniqueness, evidence order, deadline, owner identity, confirmation
token, and forbidden non-pass tokens. The receipt records the external action;
its human observation cannot be fabricated by a successful preflight command.
