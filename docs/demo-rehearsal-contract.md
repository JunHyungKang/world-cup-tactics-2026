# Timed Corner Policy Lab Demo Contract

Status: `LOCAL PROOF ONLY — FROZEN-PUBLIC RECORDING PENDING`

The current demo records one continuous `1440×900` take of Corner Policy Lab.
Local mode serves `dist-policy-lab`; final mode records only after the public
deployment marker, release commit, build digest, and every deployed file match
the clean local stamped release.

## Visual path

- `0–5`: gallery cold open with a restrained `1.04×` slow zoom;
- `5–12`: show Portugal's 14-corner sample and 47/53 pooling weights, then
  select short plus central/far and the predeclared 60% criterion;
- `12`: lock one policy before either held-out result;
- `16–27`: reveal Portugal's fixed `9/10` result first, while stating that one
  match cannot establish a universally correct choice;
- `27–34`: show the `63% ≥ 60%` round-of-16 stress test and keep the same policy
  sealed for the next eight;
- `30`: reveal the sealed final eight with the same policy;
- `34–40`: show the `55% < 60%` final receipt and the failed-generalization
  boundary;
- `42–48`: record and save the separate next-meeting decision;
- `53–59.5`: hold the immutable receipt and next-meeting note together.

The action ledger contains twelve scheduled interaction/view events. Each must
complete within 1.5 seconds of its target. The final frame must preserve the 60%
criterion, `사전 기준 미달`, `선택 변경 0회`, the policy fingerprint, and
`확인 결과는 그대로입니다`.

`docs/demo-editorial-treatment.json` controls eleven top-right editorial
summaries. Every summary is visibly labeled `[편집 요약]`: it is post-production
guidance, not product UI, observed user evidence, or a result-prediction layer.
The overlay may clarify the current decision, receipt, counterexample, seal, and
claim boundary, but it may not fabricate a product state or hide the underlying
interaction.

## Narration and captions

`docs/policy-lab-demo-narration.json`,
`docs/policy-lab-demo-captions.ko.srt`, and `docs/demo-script.md` must match the
same eight story beats. Captions are burned into the VP8/Opus upload candidate
at size 9 with a 32-pixel vertical safe margin and remain byte-bound as a
sidecar. The narration mix targets `-16 LUFS`, `-1.5 dBFS` true peak, an
80 Hz high-pass, and light `3:1` compression. Local TTS is still a timing
placeholder, not a human voice-quality or accessibility claim.

## External evidence boundary

A local rehearsal does not authorize a YouTube or DAKER ledger row. The final
candidate must be recorded from the stamped public URL, independently reviewed,
published to YouTube, checked through oEmbed, and bound to the owner's exact
upload attestation. Physical VoiceOver and human usability remain
unavailable/no-claim.
