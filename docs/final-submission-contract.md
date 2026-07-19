# Final Submission Evidence Contract

This contract prevents a reachable URL from being mistaken for a judge-ready
submission. Each evidence layer proves only the claim named below.

## Automated HTTP checks

- Deployment readiness proves an HTTPS request returns nonempty HTML without an
  obvious password, login redirect, or API-key input. It does **not** prove that
  JavaScript runs or that the manager loop works.
- GitHub readiness proves the canonical repository is public, enabled, and not
  archived according to the GitHub API. It also requires the public default
  branch HEAD to equal the exact local evidence HEAD after ledger commits; a
  merely addressable side-branch SHA is insufficient.
- YouTube readiness proves the canonical video has public oEmbed metadata. It
  does **not** prove that the demo shows the required interaction loop.

## Browser and independent-agent artifact evidence

The `final-browser-qa` ledger row is allowed only after running the production
deployment through the browser-acceptance matrix. It must cover Chromium,
WebKit, Firefox, the mobile project, keyboard-only operation, and a clean-profile
refresh without login, payment, or a judge-supplied key. Record failures instead
of adding a PASS row.

Run the final matrix with `pnpm test:e2e:final -- --deployed-url <URL>
--release-commit <SHA> --build-sha256 <SHA-256>`. The runner hashes the checked-in
config and `tests/final-e2e/final-manager-loop.spec.ts` before executing the real
public URL plus a test-only invalid-artifact build of the same app. Final
preflight reads the raw JSON report, verifies that source hash, report start and
completion times, test path, public base URL, four projects, all `BG-01` through
`BG-15` acceptance IDs, and zero failed or skipped results, then
binds the report SHA-256 to the ledger. A distinct non-creator subagent then
reviews the exact report and deployed artifact; physical VoiceOver remains
`UNAVAILABLE-NO-CLAIM` and is not represented as tested evidence.

The `youtube-public` row requires an independent-agent artifact review: the video visibly
shows evidence inspection, the outlet move, the matchup trial, and the changed
tradeoff. It also binds the exact uploaded video SHA-256, release commit, build
digest, and frozen deployment source URL. oEmbed success alone is insufficient.
The owner must separately attest that the exact local candidate was uploaded,
because YouTube transcodes published bytes.

The exact uploaded video also requires `--demo-manifest`. That manifest must be
created from a frozen-public visual recording, bind the final deployment URL,
release commit, build digest, deployed marker SHA, current story/cold-open
hashes, capture timestamps, visual source, and exact narrated upload bytes. This
machine chain is reviewed by the SHA-bound independent agent for the demo
contract, audio/captions, visual replay windows, and claim boundaries. This is
artifact QA, not human accessibility, usability, preference, or memorability evidence.

Final preflight requires `--artifact-review <path>`. The canonical JSON must bind
the deployed URL, YouTube URL, release/build, Playwright report and test-source
hashes, demo video and manifest hashes, evidence completion times, exact review
criteria, a distinct `/root/<task>` non-creator reviewer, and zero findings. It
also binds twelve PNG screenshots recomputed from the four-project BG-14 report
attachments, seven RGB frame fingerprints decoded from the exact video at
2/8/18/29/35/45/58 seconds, and the recomputed visual+narration audit and caption
hash. A minimal self-declared PASS JSON cannot satisfy this contract.
The `/root/<task>` identity is a procedural independence boundary because the
current agent runtime exposes no signed spawn receipt. Do not present it as
cryptographic reviewer identity; if signed task receipts become available, bind
one before freeze.

Generate the inspection packet only after the public browser report and exact
YouTube candidate exist:

```bash
node scripts/prepare-final-artifact-review.mjs \
  --browser-report artifacts/final-playwright-report.json \
  --demo-video <EXACT_UPLOADED_VIDEO_FILE> \
  --demo-manifest <EXACT_UPLOAD_CANDIDATE_MANIFEST> \
  --youtube-url <PUBLIC_YOUTUBE_WATCH_URL>
```

This first validates the complete BG-01–BG-15 report and frozen demo context,
then writes a deliberately failing `PENDING-INDEPENDENT-REVIEW` template plus
12 browser and seven demo inspection PNGs under an input-tuple-hashed `output/`
directory. Re-running identical inputs is idempotent; drift or unexpected files
are refused. After a distinct
non-creator subagent inspects every PNG and records PASS/zero findings, run
`node scripts/finalize-final-artifact-review.mjs --review <REVIEW_JSON>
--inspection-manifest <INSPECTION_MANIFEST> ...` with the same browser/demo/YouTube
inputs. It revalidates all 19 inspection files, re-decodes, and
re-hashes everything before creating the content-addressed tracked review file.

The review must be committed at the content-addressed path
`docs/reviews/final-artifact-review-<first-16-review-sha>.json`. YouTube upload
identity uses a second tracked, content-addressed owner attestation supplied with
`--youtube-upload-confirmation`; it binds owner, public URL, exact local video
SHA, upload time, and the limited external-action scope. It is not byte
equivalence after YouTube transcoding and is not human-outcome evidence.
The owner records it only after observing the exact upload in YouTube Studio:
`node scripts/record-youtube-upload-attestation.mjs --owner <NAME> --youtube-url <URL>
--demo-video <FILE> --demo-manifest <MANIFEST> --uploaded-at <RFC3339_KST>
--confirmed owner-observed`.

## Freeze binding

Every final evidence row is bound to the full release Git commit used to build
and deploy the app. Browser and freeze
rows are also bound to a deterministic SHA-256 over every file and path in
`dist/`. The freeze row may be
written only while the working tree is clean and both the latest commit and
ledger timestamp are no later than `2026-08-03T10:00:00+09:00`.

The evidence rows are committed after the release commit. Final preflight
requires that the release commit is an ancestor of HEAD and that every individual
post-release commit changes only `docs/submission-ledger.md`, the exact
content-addressed final review, or the exact content-addressed YouTube owner
attestation; checking only the
net diff is insufficient because an app change followed by a revert is still a
forbidden post-release history. Every such commit must also precede the deadline.
This preserves an immutable app
artifact without asking a commit to contain its own hash.

Preflight fingerprints the bytes of every tracked and nonignored file before
and after its checks. Any source/evidence mutation or new nonignored file makes
the run fail; ignored caches and temporary render output remain outside this
evidence surface.

Create the deployable directory at the clean release commit with
`pnpm submission:build -- --release-commit <full SHA>`. This command rebuilds
from scratch, first runs the complete raw-free `pnpm verify` contract on that
exact clean commit, and emits `dist/submission-build.json` with each relative path,
byte length, and SHA-256. Final preflight compares the deployed marker with the
local complete-dist digest, release commit, and source tree, then downloads and
hashes every deployed file. A copied marker beside stale or unrelated assets
therefore cannot pass. The deployment and final redirect hosts must also resolve
only to public DNS addresses.

The release builder rejects every Git-tracked path below `data/raw/` except the
empty `.gitkeep` sentinel. A future `git add -f` cannot silently publish licensed
raw archives. A clean public clone runs `pnpm verify` against the committed,
SHA-bound derivative; exact raw reproduction remains the explicit
`pnpm data:reproduce` evidence lane and fails when its ignored pinned inputs are
absent.

Before P0 freeze, `pnpm submission:drill` may exercise this clean-tree release
path without committing the real worktree or creating an external surface. It
copies every tracked/nonignored byte into an isolated temporary Git repository,
creates a synthetic local commit, runs the raw-free public `pnpm verify` contract
and the real release builder, revalidates the marker/source-tree/file manifest,
deletes the temporary repository, and proves
the real worktree fingerprint is unchanged. The drill performs a fresh
`pnpm install --frozen-lockfile --ignore-scripts` inside that snapshot before
the public verification and release build. Its PASS therefore covers the
lockfile install plus isolated source-tree/build reproduction, but it is not
BG-12, deployment evidence, a public GitHub commit, or a submission receipt.

The post-submit preflight must add `--require-final-submitted true`. This mode is
separate from the pre-submit check so the owner can verify a green package before
submitting, while the last evidence run cannot pass without the observed
`final-submitted` receipt.
