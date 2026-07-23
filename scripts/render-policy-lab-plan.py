from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/corner-policy-lab-planning.pdf"
MANIFEST_OUT = ROOT / "output/pdf/corner-policy-lab-planning.manifest.json"
SOURCE = ROOT / "docs/planning-outline.md"
CAPTURE_MANIFEST = ROOT / "docs/assets/policy-lab-planning/manifest.json"
RELEASE_MANIFEST = ROOT / "dist/release-manifest.json"
ASSETS = ROOT / "docs/assets/policy-lab-planning"
FONT_DIR = ROOT / "docs/assets/fonts"
W, H = landscape(A4)

INK = HexColor("#08110D")
PANEL = HexColor("#102019")
PANEL_2 = HexColor("#193126")
PAPER = HexColor("#F5F3E8")
MUTED = HexColor("#B6C1BA")
YELLOW = HexColor("#F1C84B")
GREEN = HexColor("#79D5A5")
ORANGE = HexColor("#F0A56A")
RED = HexColor("#FF8A80")
BLUE = HexColor("#8AB8FF")

FONTS = {
    "PlanRegular": (
        FONT_DIR / "D2Coding-Ver1.3.2-20180524.ttf",
        "8b1b23e5de4dff652fb0b938528150d2f531edfda281d3944618b655711aba84",
    ),
    "PlanBold": (
        FONT_DIR / "D2CodingBold-Ver1.3.2-20180524.ttf",
        "dde75df435f061eaa0f6db84b1c30866aaa442d7038aaa62ea3c2be92f15d87d",
    ),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def artifact_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def register_fonts() -> None:
    for name, (path, expected) in FONTS.items():
        if sha(path) != expected:
            raise RuntimeError(f"font SHA-256 mismatch: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))


def wrap(value: str, width: float, font: str, size: float) -> list[str]:
    lines: list[str] = []
    for paragraph in value.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            candidate = f"{current} {word}".strip()
            if not current or pdfmetrics.stringWidth(candidate, font, size) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def text(c: canvas.Canvas, value: str, x: float, y: float, width: float,
         size: float = 9, color=PAPER, font: str = "PlanRegular",
         leading: float | None = None) -> float:
    leading = leading or size * 1.4
    c.setFont(font, size)
    c.setFillColor(color)
    cursor = y
    for line in wrap(value, width, font, size):
        c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def box(c: canvas.Canvas, x: float, y: float, w: float, h: float,
        fill=PANEL, stroke=None, radius: float = 12) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)


def pill(c: canvas.Canvas, label: str, x: float, y: float, fill=YELLOW,
         color=INK, width: float | None = None) -> None:
    width = width or pdfmetrics.stringWidth(label, "PlanBold", 7) + 18
    c.setFillColor(fill)
    c.roundRect(x, y, width, 18, 9, fill=1, stroke=0)
    c.setFont("PlanBold", 7)
    c.setFillColor(color)
    c.drawCentredString(x + width / 2, y + 5.4, label)


def image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    box(c, x, y, w, h, PANEL)
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    c.setStrokeColor(HexColor("#456254"))
    c.roundRect(x, y, w, h, 10, fill=0, stroke=1)


def image_crop(c: canvas.Canvas, path: Path, crop: tuple[int, int, int, int],
               x: float, y: float, w: float, h: float) -> None:
    with Image.open(path) as source:
        cropped = source.crop(crop)
        iw, ih = cropped.size
        target_ratio = w / h
        source_ratio = iw / ih
        if source_ratio > target_ratio:
            keep_w = int(ih * target_ratio)
            left = (iw - keep_w) // 2
            cropped = cropped.crop((left, 0, left + keep_w, ih))
        else:
            keep_h = int(iw / target_ratio)
            top = (ih - keep_h) // 2
            cropped = cropped.crop((0, top, iw, top + keep_h))
        box(c, x, y, w, h, PANEL)
        c.drawImage(ImageReader(cropped), x, y, w, h, mask="auto")
    c.setStrokeColor(HexColor("#456254"))
    c.roundRect(x, y, w, h, 10, fill=0, stroke=1)


def header(c: canvas.Canvas, page: int, title: str, criterion: str,
           source_sha: str, capture_sha: str, release_sha: str) -> None:
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    pill(c, "DAKER · 기획서", 34, H - 35, YELLOW, INK, 118)
    c.setFillColor(MUTED)
    c.setFont("PlanBold", 8)
    c.drawRightString(W - 34, H - 29, f"CORNER POLICY LAB · {page}/8")
    c.setFillColor(PAPER)
    c.setFont("PlanBold", 22)
    c.drawString(34, H - 72, title)
    pill(c, criterion, 34, H - 103, PANEL_2, YELLOW)
    c.setStrokeColor(PANEL_2)
    c.line(34, H - 115, W - 34, H - 115)
    c.setFillColor(MUTED)
    c.setFont("PlanRegular", 5.2)
    c.drawString(34, 18, f"2018 월드컵 64경기 · 코너 603개 · CC BY 4.0 · 기획 {source_sha[:12]} · 캡처 {capture_sha[:12]}")
    c.drawRightString(W - 34, 18, "인과 추천 REJECT · 경험적 캠페인 REVISE · 인간 연구 없음")


def campaign(c: canvas.Canvas, y: float) -> None:
    items = [("48경기", "조별리그 참고"), ("8경기", "16강 중간 평가"), ("8경기", "8강 이후 봉인 검증")]
    x = 36
    for index, (value, label) in enumerate(items):
        box(c, x, y, 150, 62, PANEL_2, YELLOW if index == 2 else None, 10)
        text(c, value, x + 14, y + 38, 120, 15, YELLOW, "PlanBold")
        text(c, label, x + 14, y + 17, 120, 7.3, MUTED)
        if index < 2:
            c.setStrokeColor(YELLOW)
            c.setLineWidth(2)
            c.line(x + 150, y + 31, x + 173, y + 31)
        x += 173


def page_one(c, s, cap, rel):
    header(c, 1, "조별리그에서 세우고, 토너먼트에서 검증하세요.", "심사 배점 · 독창성 30 · 감독 경험 25", s, cap, rel)
    text(c, "두 구역과 통과 기준을 먼저 잠그면, 숨겨 둔 16경기가 감독의 가설을 시험합니다.", 34, H - 150, 340, 13, PAPER, "PlanBold", 19)
    text(c, "정답을 대신 말하는 추천기가 아닙니다. 감독이 세트피스 미팅의 우선순위를 직접 정하고, 실제 기록이 그 선택에 반박할 기회를 주는 전술 실험실입니다.", 34, H - 218, 340, 8.5, MUTED, leading=13)
    campaign(c, 175)
    box(c, 34, 72, 496, 78, HexColor("#241D12"), ORANGE, 10)
    text(c, "경계", 50, 125, 70, 7, ORANGE, "PlanBold")
    text(c, "전달 위치 겹침만 계산합니다. 수비 성공, 슈팅 방지, 최적 정책, 경기 결과 변화는 판정하지 않습니다.", 50, 103, 450, 8, PAPER, "PlanBold", 12)
    image_contain(c, ASSETS / "01-initial.png", 555, 77, 249, 340)
    c.showPage()


def page_two(c, s, cap, rel):
    header(c, 2, "감독이 정책을 먼저 확정합니다.", "심사 배점 · 감독 경험 25", s, cap, rel)
    image_contain(c, ASSETS / "02-policy-selected.png", 34, 72, 454, 337)
    steps = [
        ("1", "두 우선과제", "네 구역 중 두 곳만 선택"),
        ("2", "직접 배치", "피치 버튼 또는 접근 가능한 카드"),
        ("3", "사전 기준", "위치 겹침 40%·50%·60% 중 선택"),
        ("4", "한 번만 잠금", "구역과 기준을 두 시험 전에 확정"),
    ]
    y = 334
    for number, title, detail in steps:
        box(c, 515, y, 289, 64, PANEL_2)
        pill(c, number, 529, y + 35, YELLOW, INK, 24)
        text(c, title, 565, y + 42, 215, 9, PAPER, "PlanBold")
        text(c, detail, 565, y + 20, 215, 7.2, MUTED)
        y -= 78
    c.showPage()


def page_three(c, s, cap, rel):
    header(c, 3, "숨겨 둔 기록이 사전 기준을 판정합니다.", "심사 배점 · 독창성 30 · 완성도 25", s, cap, rel)
    image_crop(c, ASSETS / "03-heldout-result.png", (145, 390, 1295, 1320), 34, 164, 368, 245)
    image_crop(c, ASSETS / "04-contradiction.png", (150, 3970, 1290, 4970), 428, 164, 376, 245)
    pill(c, "1 · 16강 결과 공개", 48, 139, GREEN, INK, 132)
    pill(c, "2 · 선택 밖 실제 반례", 442, 139, ORANGE, INK, 148)
    box(c, 34, 68, 770, 53, PANEL_2)
    text(c, "사전 기준 50%", 50, 100, 130, 7, GREEN, "PlanBold")
    text(c, "16강 위치 겹침 48%는 기준 미달, 봉인 검증 51%는 기준 충족입니다. 이 기준은 수비 성공률이 아닙니다. 대표 반례는 같은 결정론적 순서로 고릅니다.", 174, 100, 600, 7.5, PAPER, leading=11)
    c.showPage()


def page_four(c, s, cap, rel):
    header(c, 4, "603개 코너, 누락도 숨기지 않습니다.", "심사 배점 · 완성도 25 · 일관성 20", s, cap, rel)
    text(c, "2018 월드컵 64경기를 경기 단위로 완전히 분리합니다.", 34, H - 150, 760, 16, PAPER, "PlanBold")
    campaign(c, 315)
    metrics = [("603", "원본 코너"), ("557", "분류 가능"), ("46", "끝점 미분류"), ("64", "서로 다른 경기")]
    x = 34
    for value, label in metrics:
        box(c, x, 207, 181, 82, PANEL)
        text(c, value, x + 16, 260, 145, 18, YELLOW, "PlanBold")
        text(c, label, x + 16, 229, 145, 7.5, MUTED)
        x += 197
    box(c, 34, 74, 770, 105, PANEL_2)
    text(c, "분류 가능률", 50, 150, 120, 7, GREEN, "PlanBold")
    text(c, "조별리그 397/436 (91.1%) · 16강 84/89 (94.4%) · 8강 이후 76/78 (97.4%)", 50, 124, 720, 10, PAPER, "PlanBold")
    text(c, "조별리그 누락 39개가 각 구역에 모두 속하는 경우와 하나도 속하지 않는 경우를 가정한 하한·상한을 함께 표시합니다. 숨은 대체값으로 범위를 좁히지 않습니다.", 50, 96, 720, 7.5, MUTED, leading=11)
    c.showPage()


def page_five(c, s, cap, rel):
    header(c, 5, "온톨로지는 근거 경로와 금지 추론 안전장치입니다.", "심사 배점 · 독창성 30 · 일관성 20", s, cap, rel)
    nodes = [
        ("경기 맥락", "MatchContext", 42, 320),
        ("감독 정책", "ScoutingPolicy", 225, 320),
        ("코너 재개", "CornerRestart", 408, 320),
        ("전달 행동", "DeliveryAction", 591, 320),
        ("관측 사건", "ObservedEvent", 225, 190),
        ("결과 대리값", "OutcomeProxy", 408, 190),
        ("출처", "Source", 591, 190),
    ]
    for label, detail, x, y in nodes:
        box(c, x, y, 155, 58, PANEL_2, GREEN if detail not in {"ObservedEvent", "OutcomeProxy", "Source"} else BLUE, 10)
        text(c, label, x + 12, y + 36, 130, 8.5, PAPER, "PlanBold")
        text(c, detail, x + 12, y + 18, 130, 6.2, MUTED)
    edges = [
        (197, 349, 225, 349, "검증 경기", 199, 336),
        (380, 349, 408, 349, "우선 구역", 383, 336),
        (563, 349, 591, 349, "기록된 전달", 548, 336),
        (485, 320, 302, 248, "다음 관측", 325, 274),
        (380, 219, 408, 219, "관측 결과", 365, 206),
    ]
    for x1, y1, x2, y2, label, label_x, label_y in edges:
        c.setStrokeColor(YELLOW)
        c.line(x1, y1, x2, y2)
        text(c, label, label_x, label_y, 150, 6.2, MUTED)
    c.setStrokeColor(YELLOW)
    provenance = c.beginPath()
    provenance.moveTo(302, 190)
    provenance.lineTo(302, 166)
    provenance.lineTo(668, 166)
    provenance.lineTo(668, 190)
    c.drawPath(provenance, stroke=1, fill=0)
    text(c, "출처에서 파생", 475, 157, 120, 6.2, MUTED)
    box(c, 34, 68, 770, 86, HexColor("#281914"), RED, 10)
    text(c, "금지 추론", 50, 126, 100, 7, RED, "PlanBold")
    text(c, "\"막았을 것이다\"(WOULD_PREVENT) · \"최적 정책이다\" · \"이 배치가 원인이다\"", 162, 126, 600, 9, PAPER, "PlanBold")
    text(c, "관측된 행동·결과·출처만 연결합니다. 데이터가 말하지 않은 효과를 추천 문장으로 바꾸지 않습니다.", 162, 96, 600, 7.5, MUTED)
    c.showPage()


def page_six(c, s, cap, rel):
    header(c, 6, "60초 안에 선택·검증·다음 결정까지 끝냅니다.", "심사 배점 · 감독 경험 25 · 완성도 25", s, cap, rel)
    image_crop(c, ASSETS / "05-final-verification.png", (150, 1020, 1290, 2020), 430, 72, 374, 337)
    timeline = [
        ("0-12초", "참고 범위·두 구역·사전 기준 선택"),
        ("12-16초", "한 정책을 두 시험에 잠금"),
        ("16-27초", "16강 8경기·대표 반례"),
        ("27-34초", "최종 8경기 봉인 확인"),
        ("34-45초", "같은 정책으로 검증·최종 영수증"),
        ("45-60초", "다음 미팅 결정·메모·불변 영수증"),
    ]
    y = 380
    for time_label, action in timeline:
        pill(c, time_label, 34, y, ORANGE, INK, 76)
        text(c, action, 126, y + 5, 270, 8.5, PAPER, "PlanBold")
        y -= 45
    box(c, 34, 69, 362, 58, PANEL_2)
    text(c, "최종 메모는 다음 미팅을 위한 별도 기록입니다. 정책 변경 0회이며 봉인 정책 ID·사전 기준 판정·위치 겹침 결과·평가 영수증은 바뀌지 않습니다.", 50, 104, 330, 7.2, MUTED, leading=11)
    c.showPage()


def page_seven(c, s, cap, rel):
    header(c, 7, "기획서의 약속이 공개 화면에서 그대로 작동합니다.", "심사 배점 · 완성도 25 · 일관성 20", s, cap, rel)
    proofs = [
        ("0개", "설치·로그인·API 키", "공개 URL에서 바로 실행"),
        ("4개 환경", "주요 브라우저 검증", "Chromium·Firefox·WebKit·모바일"),
        ("12/12", "핵심 흐름 통과", "정책 잠금부터 봉인 검증까지"),
    ]
    x = 34
    for value, title, detail in proofs:
        box(c, x, 278, 244, 118, PANEL_2, GREEN, 12)
        text(c, value, x + 16, 356, 210, 22, YELLOW, "PlanBold")
        text(c, title, x + 16, 326, 210, 8, PAPER, "PlanBold")
        text(c, detail, x + 16, 301, 210, 7, MUTED)
        x += 263
    box(c, 34, 150, 770, 96, PANEL)
    mappings = [
        ("두 구역 선택", "피치와 접근 가능한 카드가 같은 상태를 공유"),
        ("사전 기준 선언", "40%·50%·60% 중 하나를 결과 공개 전에 지문에 포함"),
        ("정책 한 번 잠금", "검증 전 선택을 비활성화하고 같은 정책 ID 유지"),
    ]
    y = 218
    for promise, implementation in mappings:
        text(c, promise, 50, y, 140, 7.5, GREEN, "PlanBold")
        text(c, implementation, 190, y, 580, 7.5, PAPER)
        y -= 24
    box(c, 34, 70, 770, 62, HexColor("#241D12"), ORANGE, 10)
    text(c, "현재 공개 상태", 50, 108, 120, 7, ORANGE, "PlanBold")
    text(c, "GitHub Pages 후보는 공개되어 있습니다. 최종 스탬프·YouTube·DAKER 최종 접수는 마감 전에 같은 버전으로 고정하며, 인간 연구 결과는 주장하지 않습니다.", 170, 108, 600, 7.6, PAPER)
    c.showPage()


def page_eight(c, s, cap, rel):
    header(c, 8, "AI가 답을 대신하지 않습니다. 기록이 감독의 선택을 시험합니다.", "한 문장 차별점", s, cap, rel)
    rows = [
        ("독창성", "추천 점수가 아니라 48→8→8 반증 캠페인", "기록이 반박"),
        ("감독 경험", "두 구역·사전 기준 → 잠금 → 판정 → 다음 결정", "선택에 책임"),
        ("완성도", "603개 코너·누락 공개·4개 환경 검증", "숨기지 않음"),
        ("기획·구현", "같은 선택·정책 ID·출처가 화면에 유지", "약속 그대로"),
    ]
    y = 344
    for criterion, proof, gap in rows:
        box(c, 34, y, 770, 64, PANEL_2)
        text(c, criterion, 50, y + 39, 132, 8.5, YELLOW, "PlanBold")
        text(c, proof, 190, y + 39, 400, 8, PAPER, "PlanBold")
        text(c, gap, 618, y + 39, 165, 7.2, ORANGE, "PlanBold")
        y -= 78
    box(c, 34, 30, 770, 64, HexColor("#17251E"), GREEN, 10)
    text(c, "심사자가 기억할 장면", 50, 77, 130, 7, GREEN, "PlanBold")
    text(c, "\"결과를 보기 전에 50%를 정했고, 같은 정책이 한 번은 미달·한 번은 충족했다.\" 감독의 기준과 반례가 한 화면에 남습니다.", 180, 77, 590, 8.4, PAPER, "PlanBold", 11)
    text(c, "공개 서비스: junhyungkang.github.io/world-cup-tactics-2026/ · GitHub: JunHyungKang/world-cup-tactics-2026", 180, 48, 590, 6.2, MUTED)
    text(c, "1차 투표 제출팀 60%·참가팀 20%·대중 20% · 기획서 2026-07-27 10:00 KST · 최종 2026-08-03 10:00 KST", 180, 36, 590, 5.8, MUTED)
    c.showPage()


def main() -> None:
    global OUT, MANIFEST_OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(OUT.relative_to(ROOT)))
    args = parser.parse_args()
    OUT = ROOT / args.output
    MANIFEST_OUT = OUT.with_suffix(".manifest.json")
    register_fonts()
    for path in [SOURCE, CAPTURE_MANIFEST, RELEASE_MANIFEST]:
        if not path.exists():
            raise RuntimeError(f"missing bound artifact: {path}")
    capture = json.loads(CAPTURE_MANIFEST.read_text())
    release = json.loads(RELEASE_MANIFEST.read_text())
    if capture["release_manifest_sha256"] != sha(RELEASE_MANIFEST):
        raise RuntimeError("capture is not bound to the current release manifest")
    for artifact in capture["artifacts"]:
        path = ROOT / artifact["path"]
        if sha(path) != artifact["sha256"]:
            raise RuntimeError(f"capture SHA-256 mismatch: {path}")
    if release["causal_recommendation_status"] != "REJECT" or release["empirical_campaign_status"] != "REVISE":
        raise RuntimeError("release claim boundary mismatch")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    source_sha, capture_sha, release_sha = sha(SOURCE), sha(CAPTURE_MANIFEST), sha(RELEASE_MANIFEST)
    c = canvas.Canvas(str(OUT), pagesize=landscape(A4), pageCompression=1)
    c.setTitle("Corner Policy Lab - Planning PDF")
    c.setAuthor("Corner Policy Lab")
    for page in [page_one, page_two, page_three, page_four, page_five, page_six, page_seven, page_eight]:
        page(c, source_sha, capture_sha, release_sha)
    c.save()
    manifest = {
        "schema_version": 1,
        "status": "promoted-not-submitted",
        "pdf": {"path": artifact_path(OUT), "bytes": OUT.stat().st_size, "sha256": sha(OUT), "pages": 8},
        "bindings": {
            str(SOURCE.relative_to(ROOT)): source_sha,
            str(CAPTURE_MANIFEST.relative_to(ROOT)): capture_sha,
            str(RELEASE_MANIFEST.relative_to(ROOT)): release_sha,
        },
        "verified_claims": {"policy_contract_tests": "7/7", "prototype_browser_tests": "7/7", "static_release_browser_tests": "12/12"},
        "claim_boundary": {"causal_recommendation": "REJECT", "empirical_campaign": "REVISE", "human_evidence": "unavailable-no-claim"},
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"[PASS] {artifact_path(OUT)} pages=8 sha256={manifest['pdf']['sha256']}")


if __name__ == "__main__":
    main()
