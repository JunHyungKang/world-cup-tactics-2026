import json
import sys

from pypdf import PdfReader


def main() -> None:
    reader = PdfReader(sys.argv[1])
    if reader.is_encrypted:
        raise ValueError("planning PDF must not be encrypted")
    pages = []
    for page in reader.pages:
        box = page.mediabox
        resources = page.get("/Resources", {}).get_object()
        font_dictionary = resources.get("/Font", {}).get_object()
        fonts = sorted(
            str(font.get_object().get("/BaseFont", ""))
            for font in font_dictionary.values()
        )
        pages.append(
            {
                "text": page.extract_text() or "",
                "width": float(box.width),
                "height": float(box.height),
                "fonts": fonts,
            }
        )
    print(json.dumps({"pages": pages}, ensure_ascii=False))


if __name__ == "__main__":
    main()
