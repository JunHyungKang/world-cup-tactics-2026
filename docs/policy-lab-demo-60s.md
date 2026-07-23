# Corner Policy Lab — 60-Second Judge Demo

Status: `LOCAL STATIC RELEASE REHEARSAL PASS — NOT YOUTUBE EVIDENCE`

Gallery title: `Corner Policy Lab — 한 정책, 두 번의 미공개 검증`

The demo locks one policy snapshot before exposure and reuses it unchanged across
two sequential held-out audits. The round-of-16 summary creates eight receipts
with the same fingerprint while the quarter-final-and-later data remain sealed.
The final reveal uses that identical fingerprint and records zero policy changes.
The manager then records a separate next-meeting decision and reason. That note
cannot mutate the sealed policy, overlap result, or evaluation receipts.

| Time | Screen action | Korean narration | Observable proof |
|---|---|---|---|
| 0–5s | Hold on the `48 → 8 → 8` campaign map | `조별리그에서 세우고, 토너먼트에서 검증합니다.` | Reference, rehearsal, and sealed final-audit partitions are visible |
| 5–12s | Select `숏 코너`, `니어포스트`, and a `50%` minimum location-overlap criterion | `조별리그 기록만 보고 우선 구역 두 개와 최소 겹침률 오십 퍼센트를 고릅니다.` | Two-token scarcity, predeclared criterion, `397/436` |
| 12–16s | Activate `이 정책을 잠가 두 시험에 적용` | `이 정책을 잠가 두 시험에 적용합니다.` | One fingerprint binds areas and criterion; both holdouts still hidden |
| 16–27s | Reveal the round-of-16 summary and inline contradiction | `16강 여덟 경기의 위치 겹침은 사전 기준에 못 미칩니다. 평가 영수증에는 모두 같은 정책이 기록됩니다.` | `48%`, predeclared `50%` criterion missed, same-fingerprint receipts |
| 27–34s | Hold on the still-sealed final-audit action | `8강 이후 기록은 아직 봉인됐고, 정책도 바꿀 수 없습니다.` | Disabled selections and unchanged policy fingerprint |
| 34–45s | Reveal the sealed final audit and contradiction | `같은 정책으로 봉인한 여덟 경기는 사전 기준을 충족합니다. 선택 밖 전달과 출처도 다시 확인합니다.` | `51%`, predeclared `50%` criterion met, deterministic evidence path |
| 45–53s | Choose `다음 미팅에서 우선 구역 수정`, enter one reason, and save | `이제 다음 미팅의 결정을 고르고 이유를 남깁니다.` | An actionable next-meeting note appears without changing the sealed receipt |
| 53–59.5s | Hold the receipt and next-meeting note together | `이 메모는 봉인 정책과 검증 결과를 바꾸지 않습니다.` | `정책 변경 0회`, same fingerprint, immutable result |

## First-five-second contract

The desktop and video first frame must contain, without scrolling:

- the product name;
- `조별리그에서 세우고, 토너먼트에서 검증하세요.`;
- the `48경기 참고 → 8경기 중간 평가 → 8경기 봉인 검증` map;
- the visible limitation `전달 위치 겹침만 계산`.
- the visible `40% / 50% / 60%` predeclared criterion control.

At `320×568`, the campaign map may collapse. The mini pitch, four 44-pixel
priority cards, criterion controls, lock button, abstention button, and
limitation remain operable without horizontal overflow. The stage labels
continue to expose the fixed split after interaction.

## Claim boundary

The narration may say `관찰 정책`, `위치 겹침`, `반례`, `분류 가능`, and
`봉인 검증`. It may not say `수비 성공`, `막았다`, `위험도`, `보상`,
`강화학습이 학습했다`, `최적`, or `경기 결과를 바꿨다`.

## Comparison gate

An independent reviewer must compare this exact 60-second path with the frozen
Corner War Room demo on originality `30`, manager-experience design `25`,
functional completeness `25`, and planning-to-implementation consistency `20`.
Do not promote Policy Lab on novelty alone.

## Local rehearsal evidence

- Narrated video: `output/policy-lab-demo/corner-policy-lab-60s-narrated.webm`
- Duration and streams: `59.520s`, `1440×900`, VP8 video, Opus audio
- Video SHA-256: `dbddebacaf3b74dd041bf00c303e9efdb47f20fec36312e9cda8b6ad918f3c13`
- Captions: Korean captions are burned into the rehearsal and retained as a byte-bound SRT sidecar
- Timed path: `12/12` timed events within 0.08 seconds, eight activations, one
  policy lock, two explicit scrolls, final receipt visible at `34.009s`, and the
  next-meeting note saved at `48.037s`
- Re-record requirement: regenerate the exact local artifact after every Quick
  Trial code or copy change
- Narration: 8/8 cues fit their allocated intervals
- Status boundary: local rehearsal only; not public YouTube or human evidence
