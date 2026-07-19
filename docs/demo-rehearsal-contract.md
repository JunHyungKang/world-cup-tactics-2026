# Timed Demo Rehearsal Contract

Status: `LOCAL PROOF ONLY — NOT YOUTUBE OR FINAL ARTIFACT EVIDENCE`

The rehearsal must record one continuous production-build interaction take at
`1440×900`. It follows `docs/submission-story.json` for 60 seconds and ends on
the unexplained-shot non-contact verdict plus a source event ID.
The local rehearsal is intentionally silent; the final public recording uses the
bound narration in `docs/demo-script.md`.

## Pass conditions

- narrated upload-candidate duration is between `59.8` and `60.0` seconds;
- the SHA-bound Korean SRT is burned into the narrated video so the judging
  surface does not depend on a player-side caption toggle;
- the exact current submission-story SHA-256 is recorded;
- the interaction events complete no later than 1.5 seconds after their
  scheduled timecodes: second-ball commit at 5s, replay at 12s, near/reset at
  32s, and counterexample replay at 38s;
- the continuous take shows the pitch during the primary replay from 13–22s and
  the counterexample replay from 39–48s, then returns to the receipt at 22s and
  48s; all four view transitions are recorded in the action ledger;
- reset exposes the visible immutable-evidence status before the final choice;
- the final state contains `이 선택으로 설명되지 않는 슈팅 기록`, `이 선택이
  슈팅을 막았을지는 알 수 없습니다`, `선택 구역과 겹치지 않음`, and an
  `이벤트 #` source ID;
- WebM bytes, duration, codec, resolution, action timings, and final semantic
snapshot and eleven interaction/view timings are SHA-bound in
`output/demo/rehearsal-manifest.json`.

This does not authorize the final `youtube-public` ledger row. The final video
must be recorded from the frozen public URL, published to YouTube, pass oEmbed,
receive a SHA-bound independent-agent artifact review, and carry the owner's
exact-candidate upload confirmation. No human usability or accessibility claim follows.
