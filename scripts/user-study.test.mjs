import { describe, expect, it } from "vitest";
import { computePrimarySummary, validatePrimaryStudy } from "./lib/user-study.mjs";

const participant = (id, device_path, familiarity, overrides = {}) => ({
  id, familiarity, device_path, browser_viewport: "Safari 18 / 390x844", reduced_motion: false,
  five_second_answer: "코너 수비 한 명을 늘리면 역습 한 명을 포기한다.", tradeoff_pass: true,
  first_valid_move_seconds: 8, neutral_prompt_used: false, opened_evidence_at_seconds: 18,
  played_counterexample_at_seconds: 31, evidence_distinction_pass: true,
  evidence_distinction_verbatim: "선택 강조만 바뀌고 과거 기록은 그대로다.",
  misconception_present: false, misconception_verbatim: null, spontaneous_loop_pass: true,
  guided_path_pass: true, guided_defect: null, ...overrides,
});

function completeStudy(overrides = {}) {
  const participants = [
    participant("P1", "mobile-touch", "low"), participant("P2", "mobile-touch", "medium"),
    participant("P3", "desktop-pointer", "medium"), participant("P4", "desktop-keyboard", "high"),
    participant("P5", "desktop-pointer", "medium"),
  ];
  return {
    schema_version: 1, study_id: "primary-wave-1", status: "complete",
    build: { source_commit: "a".repeat(40), app_url: "https://example.test", evidence_fingerprint: "877e015b716ffdee", started_at: "2026-07-20T10:00:00+09:00", completed_at: "2026-07-20T11:00:00+09:00", moderator: "owner-jhkang" },
    participants, summary: computePrimarySummary(participants), ...overrides,
  };
}

describe("primary user-study gate", () => {
  it("accepts a complete threshold-passing anonymous cohort", () => {
    expect(validatePrimaryStudy(completeStudy())).toEqual([]);
  });

  it("rejects averaged-away misconceptions and summary drift", () => {
    const study = completeStudy();
    study.participants[0].misconception_present = true;
    study.participants[0].misconception_verbatim = "이 역할이 슈팅을 막았다.";
    study.participants[1].misconception_present = true;
    study.participants[1].misconception_verbatim = "선수가 구역 전체에 닿는다.";
    expect(validatePrimaryStudy(study)).toEqual(expect.arrayContaining([
      "study summary must exactly equal computed participant counts",
      "primary gate hard stop: misconception_count exceeds 1/5",
    ]));
  });

  it("rejects missing device diversity, weak positive thresholds, and PII fields", () => {
    const study = completeStudy();
    study.participants = study.participants.map((record, index) => ({ ...record, device_path: "desktop-pointer", tradeoff_pass: index !== 0 && index !== 1 }));
    study.summary = computePrimarySummary(study.participants);
    study.participants[0].email = "forbidden@example.test";
    const errors = validatePrimaryStudy(study);
    expect(errors).toContain("primary cohort requires at least two mobile-touch sessions");
    expect(errors).toContain("primary cohort requires at least one desktop-keyboard session");
    expect(errors).toContain("primary gate failed: tradeoff_pass is below 4/5");
    expect(errors.some((error) => error.includes("forbidden personal-data field"))).toBe(true);
  });
});
