const pageContracts = [
  { title: "One policy, three tournament phases", markers: ["48 group-stage reference", "eight round-of-16", "eight sealed"] },
  { title: "A real manager commitment", markers: ["One immutable fingerprint", "delivery-location overlap", "never defensive effectiveness"] },
  { title: "Evidence argues back", markers: ["record table", "representative contradiction", "not statistically strongest"] },
  { title: "All 603 corners, missingness visible", markers: ["603 corners", "397/436", "must not imply that a 2018"] },
  { title: "Ontology as a safety mechanism", markers: ["MatchContext", "DEFENSIVE_DUTY_CAUSED", "does not generate missing actions"] },
  { title: "Actual 60-second proof", markers: ["`59.520` seconds", "five activations", "burned captions"] },
  { title: "Deployable and fail-closed", markers: ["7/7", "12/12", "causal recommendation is `REJECT`"] },
  { title: "Submission plan and risks", markers: ["98/100", "submitter `60%`", "2026-07-27 10:00 KST", "2026-08-03 10:00 KST"] },
];

export const requiredPlanningPages = [
  "조별리그에서 세우고, 토너먼트에서 깨뜨리세요.",
  "감독이 정책을 먼저 확정합니다.",
  "기록으로 정책을 반박합니다.",
  "603개 코너, 누락도 숨기지 않습니다.",
  "온톨로지는 추천 엔진이 아니라 안전장치입니다.",
  "59.52초, 다섯 번의 조작으로 봉인 검증까지 갑니다.",
  "주장과 빌드를 같은 해시에 묶었습니다.",
  "독립 비교를 통과해 공식 후보로 승격했습니다.",
];
export const requiredPdfPageMarkers = [
  "48경기",
  "한 번만 잠금",
  "대표 반례 규칙",
  "397/436",
  "WOULD_PREVENT",
  "정책 변경 0회",
  "12/12",
  "98 / 100",
];

const stalePatterns = [
  /DATA AUDIT PENDING/iu,
  /implementation pending/iu,
  /transform\/full audit pending/iu,
  /탐색 재현값\s*[—-]\s*product output 아님/iu,
  /remaining cross-browser/iu,
  /No official scoring weights have been published/iu,
  /Touchline Lab/iu,
  /memorable distinction/iu,
];

function splitPages(text) {
  const matches = [...text.matchAll(/^## (\d+)\. (.+)$/gmu)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    body: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }));
}

function parseVerifiedAt(officialState) {
  const match = officialState.match(/^Verified:\s*`([^`]+)`\s+against:/mu);
  return match ? Date.parse(match[1]) : Number.NaN;
}

export function validatePlanningContract({ source, officialState, manifest, now = new Date() }) {
  const errors = [];
  const pages = splitPages(source);
  if (pages.length !== pageContracts.length) errors.push(`editorial contract expects exactly 8 planning pages, found ${pages.length}`);
  pageContracts.forEach((contract, index) => {
    const page = pages[index];
    if (!page || page.number !== index + 1 || page.title !== contract.title) {
      errors.push(`page ${index + 1} must be '${contract.title}'`);
      return;
    }
    if (page.body.replace(/\s/gu, "").length < 300) errors.push(`page ${index + 1} body is too thin for its declared requirement`);
    for (const marker of contract.markers) if (!page.body.includes(marker)) errors.push(`page ${index + 1} missing scoped marker: ${marker}`);
  });

  if (!source.includes("Status: `PROMOTED OFFICIAL CANDIDATE — NOT SUBMITTED`")) {
    errors.push("planning source must identify the current implementation as an unsubmitted candidate");
  }
  for (const marker of [
    "first round selects ten teams by submitter `60%`, participant `20%`, and\npublic `20%` voting",
    "second round scores originality `30`, manager-experience\ndesign `25`, completeness `25`, and planning/implementation consistency `20`",
    "Human study is unavailable",
    "Synthetic novice, coach, and accessibility personas",
    "No human preference, usability, comprehension, or memorability result is claimed.",
    "PENDING — requires stamped public deployment",
  ]) if (!source.includes(marker)) errors.push(`missing current planning evidence boundary: ${marker}`);

  for (const pattern of stalePatterns) if (pattern.test(source)) errors.push(`planning source contains stale state: ${pattern.source}`);
  for (const marker of [
    "First-round voting weights are submitter 60%, participant 20%, and public 20%",
    "Second-round internal judging is originality 30",
    "2026-07-27 10:00 KST",
    "2026-08-03 10:00 KST",
  ]) if (!officialState.includes(marker)) errors.push(`official state missing planning contract marker: ${marker}`);

  const verifiedAt = parseVerifiedAt(officialState);
  if (!Number.isFinite(verifiedAt)) errors.push("official state requires an RFC3339 Verified timestamp");
  else {
    const ageHours = (now.getTime() - verifiedAt) / 3_600_000;
    if (ageHours < 0 || ageHours > 24) errors.push(`official state verification is stale: ${ageHours.toFixed(1)} hours`);
  }
  if (!officialState.includes("https://daker.ai/public/hackathons/world-cup-manager-tactics-web-challenge")) errors.push("official state missing canonical competition URL");

  const accepted = (manifest.sources ?? []).filter((record) => record.status === "accepted");
  const expectedIds = ["pappalardo-wyscout-events-wc-2018", "pappalardo-wyscout-matches-wc-2018"];
  if (accepted.length !== 2 || expectedIds.some((id) => !accepted.some((record) => record.id === id))) {
    errors.push("planning candidate requires the two selected accepted Figshare sources");
  }
  if (!source.includes("may be submitted only after `pnpm verify`")) errors.push("missing final-PDF submission guardrail");
  if (/users? (?:prefer|validated|found intuitive)|사용자.{0,12}(?:선호|직관).{0,12}(?:검증|통과)/iu.test(source)) {
    errors.push("planning candidate contains an unsupported human preference/usability claim");
  }
  const deadline = Date.parse("2026-07-27T10:00:00+09:00");
  if (now.getTime() >= deadline && source.includes("NOT SUBMITTED")) errors.push("planning deadline has passed while candidate is not submitted");
  return errors;
}
