export type Formation = "4-3-3" | "3-4-3";

export interface Tactic {
  formation: Formation;
  press: number;
  width: number;
}

export interface TacticalReadout {
  control: number;
  transitionRisk: number;
  summary: string;
}

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Transparent prototype logic only. Replace coefficients with a documented,
 * tested data model before presenting the output as evidence-backed advice.
 */
export function evaluatePrototypeTactic(tactic: Tactic): TacticalReadout {
  const midfieldBonus = tactic.formation === "4-3-3" ? 8 : 3;
  const backLineRisk = tactic.formation === "3-4-3" ? 9 : 4;
  const control = clamp(38 + midfieldBonus + tactic.press * 0.3 + tactic.width * 0.08);
  const transitionRisk = clamp(12 + backLineRisk + tactic.press * 0.45 - tactic.width * 0.08);
  const summary =
    transitionRisk >= 55
      ? "압박 이득은 크지만, 공을 잃은 직후 뒷공간 보호가 핵심입니다."
      : "중원 통제와 전환 안정성의 균형을 유지하는 설정입니다.";

  return { control, transitionRisk, summary };
}
