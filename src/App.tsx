import { useMemo, useState } from "react";
import { evaluatePrototypeTactic, type Formation } from "./domain/tactics";

export function App() {
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [press, setPress] = useState(62);
  const [width, setWidth] = useState(55);
  const readout = useMemo(
    () => evaluatePrototypeTactic({ formation, press, width }),
    [formation, press, width],
  );

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">2026 WORLD CUP · MANAGER PROTOTYPE</p>
        <h1>Touchline Lab</h1>
        <p className="lede">
          포메이션을 고르고 압박과 폭을 조정해 보세요. 선택이 경기 통제와 전환 위험을 어떻게
          바꾸는지 즉시 확인할 수 있습니다.
        </p>
        <span className="prototype-badge">프로토타입 로직 · 공식 데이터 연결 전</span>
      </header>

      <section className="workspace" aria-label="전술 실험실">
        <div className="controls">
          <div>
            <p className="label">포메이션</p>
            <div className="segmented">
              {(["4-3-3", "3-4-3"] as Formation[]).map((option) => (
                <button
                  aria-pressed={formation === option}
                  className={formation === option ? "active" : ""}
                  key={option}
                  onClick={() => setFormation(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="range-heading"><span>압박 강도</span><strong>{press}</strong></span>
            <input
              aria-label="압박 강도"
              max="100"
              min="0"
              onChange={(event) => setPress(Number(event.target.value))}
              type="range"
              value={press}
            />
          </label>

          <label>
            <span className="range-heading"><span>공격 폭</span><strong>{width}</strong></span>
            <input
              aria-label="공격 폭"
              max="100"
              min="0"
              onChange={(event) => setWidth(Number(event.target.value))}
              type="range"
              value={width}
            />
          </label>
        </div>

        <div className="pitch" aria-label={`${formation} 전술 보드`}>
          <div className="halfway" />
          <div className="center-circle" />
          <p>{formation}</p>
          <div className={`shape formation-${formation.replaceAll("-", "")}`} aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 2}</span>)}
          </div>
        </div>

        <aside className="readout" aria-live="polite">
          <p className="label">선택의 결과</p>
          <div className="metric">
            <span>경기 통제</span>
            <strong>{readout.control}</strong>
          </div>
          <div className="bar"><i style={{ width: `${readout.control}%` }} /></div>
          <div className="metric">
            <span>전환 위험</span>
            <strong>{readout.transitionRisk}</strong>
          </div>
          <div className="bar risk"><i style={{ width: `${readout.transitionRisk}%` }} /></div>
          <p className="summary">{readout.summary}</p>
          <p className="caveat">현재 수치는 UX 검증용입니다. 데이터 감사 전에는 성능 예측으로 사용하지 않습니다.</p>
        </aside>
      </section>
    </main>
  );
}
