import { describe, expect, it } from "vitest";
import { auditFiles, auditText, copyFiles } from "../.agents/skills/korean-copy-qa/scripts/audit-copy.mjs";

describe("Korean copy audit", () => {
  it("keeps every canonical copy surface free of high-confidence findings", async () => {
    expect(await auditFiles()).toEqual([]);
    expect(copyFiles).toHaveLength(16);
  });

  it("rejects legacy, mixed-language, and translationese copy", () => {
    const findings = auditText([
      "세컨드볼 우선 · 역습 역할 회수",
      "이 선택이 설명하지 못한 슈팅 기록",
      "출처 event #42와 outlet band 접촉",
      "운영에 있어서 주목할 만하다.",
      "다음 기록",
    ].join("\n"), "fixture.txt");
    expect(findings.map(({ id }) => id)).toEqual([
      "LEGACY-01", "LEGACY-02", "MIXED-01", "MIXED-01", "UI-01", "A-03", "D-02",
    ]);
  });

  it("does not flag current evidence-bound Korean", () => {
    expect(auditText("이 선택으로 설명되지 않는 슈팅 기록입니다. 출처 이벤트 #42를 표시합니다.")).toEqual([]);
  });

  it("rejects superseded Policy Lab translationese and football labels", () => {
    const findings = auditText([
      "짧게 연결과 박스 밖 변형을 고릅니다.",
      "같은 정책으로 봉인 감사 8경기를 엽니다.",
      "10초 내 슈팅을 확인합니다.",
      "감독이 먼저 커밋하고 P1 후보 레인으로 둡니다.",
    ].join("\n"), "policy-fixture.txt");
    expect(findings.map(({ id }) => id)).toEqual([
      "POLICY-COPY-01", "POLICY-COPY-02", "POLICY-COPY-03", "POLICY-COPY-04",
      "POLICY-COPY-05", "POLICY-COPY-05",
    ]);
  });

  it("rejects untranslated source taxonomy in dynamic UI copy", () => {
    expect(auditText("<span>{current.sub_event_name || current.event_name}</span>").map(({ id }) => id)).toEqual(["DYNAMIC-01"]);
  });
});
