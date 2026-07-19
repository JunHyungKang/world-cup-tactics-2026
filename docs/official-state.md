# Official State

Verified: `2026-07-19T22:03:56+09:00` against:

- https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge
- https://daker.ai/api/hackathons/world-cup-manager-tactics-web-challenge

Confirmed requirements:

- The headline scope says `2026 FIFA 월드컵 데이터를 활용`; the body theme also
  says `실제 월드컵 데이터`.
- The first-party competition record's `dataDescription`, updated at
  `2026-07-13T04:47:47.898Z`, provides the specific governing data rule:
  `특정 연도·대회·선수 구성에 대한 제한은 없으며, 참가자가 자유롭게 설정할
  수 있습니다.` It also recommends directly constructed dummy player/team/match
  data and requires commercially usable licensing for external APIs. This
  specific rule resolves the former year-scope ambiguity; a separate board
  answer is not required for clearly labeled 2018 evidence.
- Planning PDF due 2026-07-27 10:00 KST, covering service overview, manager
  experience intent, page structure, key interactions, data use, and main flow.
- Final deployed URL, GitHub URL, and YouTube demo due 2026-08-03 10:00 KST.
- Browser-playable without installation, signup, payment, or judge-supplied key.
- Major-browser support and public availability throughout judging.
- Direct manipulation must genuinely work; non-working dynamic features may be
  excluded from evaluation.
- Code, assets, images, fonts, and icons must respect copyright/licenses.
- No commits after 2026-08-03 10:00 KST; post-deadline commits may disqualify.
- Official answers to questions are provided through the competition board;
  other channels may be delayed or unanswered. The prepared year-scope question
  is no longer needed because the official Data-tab rule answers it directly.
- First-round voting weights are submitter 60%, participant 20%, and public 20%.
  The top ten advance. Tie-breaking favors greater vote use, then earlier first
  upload time. Second-round internal judging is originality 30,
  manager-experience design 25, completeness 25, and planning/implementation
  consistency 20.

Canonical stable fields from the live API (`id`, `slug`, `tagline`,
`dataDescription`, `updatedAt`) have SHA-256
`7d56d0d02e620caa81f00a67a7933190512570cb13689ee14a8e07d136765adc`.
Volatile counters such as views are deliberately excluded.
