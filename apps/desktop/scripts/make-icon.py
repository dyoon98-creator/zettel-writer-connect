#!/usr/bin/env python3
"""Generate the AI 원고실 app icon (1024x1024 PNG).

A simple, recognizable mark: a serif-feel "원" character on a warm
manuscript-paper background with a subtle pen-stroke underline. Generated
deterministically so the icon is reproducible.

Usage:
    python3 scripts/make-icon.py [output_path]

Default output: src-tauri/icons/icon.png
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
BG = (243, 235, 222, 255)  # warm paper
INK = (33, 27, 22, 255)  # near-black ink
ACCENT = (180, 80, 50, 255)  # pen tip stroke


def find_font() -> str:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return ""


def main(out: Path) -> None:
    img = Image.new("RGBA", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)

    # Soft rounded square mask for the iOS-friendly look.
    mask = Image.new("L", (SIZE, SIZE), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = SIZE // 5
    mdraw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=radius, fill=255)

    rounded = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)

    # Drop "원" character centered.
    font_path = find_font()
    if font_path:
        try:
            font = ImageFont.truetype(font_path, size=int(SIZE * 0.62))
        except OSError:
            font = ImageFont.load_default()
    else:
        font = ImageFont.load_default()

    text = "원"
    rdraw = ImageDraw.Draw(rounded)

    # Center the glyph
    bbox = rdraw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (SIZE - tw) // 2 - bbox[0]
    y = (SIZE - th) // 2 - bbox[1] - int(SIZE * 0.04)
    rdraw.text((x, y), text, fill=INK, font=font)

    # Pen-stroke underline near the bottom.
    underline_y = int(SIZE * 0.78)
    rdraw.rounded_rectangle(
        (int(SIZE * 0.22), underline_y, int(SIZE * 0.78), underline_y + 26),
        radius=13,
        fill=ACCENT,
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    rounded.save(out, format="PNG")
    print(f"wrote {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    out_arg = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(__file__).resolve().parents[1] / "src-tauri" / "icons" / "icon.png"
    )
    main(out_arg)
