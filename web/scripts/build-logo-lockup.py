#!/usr/bin/env python3
"""Ink-only C + a baked-in 'by Typeface' subscript. No white square."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/brand/logo-source.png"
OUT_C = ROOT / "public/brand/logo-c.png"
OUT_MARK = ROOT / "public/brand/logo-mark.png"
FONTS = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Calibri.ttf",
]


def knock_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red >= 248 and green >= 248 and blue >= 248:
                pixels[x, y] = (red, green, blue, 0)
                continue
            distance = (255 - red + 255 - green + 255 - blue) / 3
            if distance < 12:
                pixels[x, y] = (red, green, blue, int(distance / 12 * 255))
    return image


def trim(image: Image.Image, padding: int = 4) -> Image.Image:
    alpha = image.split()[-1]
    box = alpha.getbbox()
    if not box:
        return image
    left, top, right, bottom = box
    cropped = image.crop((left, top, right, bottom))
    canvas = Image.new("RGBA", (cropped.width + padding * 2, cropped.height + padding * 2), (0, 0, 0, 0))
    canvas.paste(cropped, (padding, padding), cropped)
    return canvas


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONTS:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    ink = trim(knock_white(Image.open(SRC)))
    ink.save(OUT_C)

    font = load_font(max(15, ink.height // 16))
    text = "by Typeface"
    probe = ImageDraw.Draw(ink)
    text_box = probe.textbbox((0, 0), text, font=font)
    text_w = text_box[2] - text_box[0]
    text_h = text_box[3] - text_box[1]

    alpha = ink.split()[-1]
    rightmost = 0
    band_top = int(ink.height * 0.62)
    band_bottom = int(ink.height * 0.92)
    for y in range(band_top, band_bottom):
        for x in range(ink.width - 1, -1, -1):
            if alpha.getpixel((x, y)) > 40:
                rightmost = max(rightmost, x)
                break

    # Just past the red tip, vertically in the lower third — a TM on the letter.
    x = rightmost + 8
    y = int(ink.height * 0.74)
    lockup = Image.new("RGBA", (max(ink.width, x + text_w + 10), ink.height), (0, 0, 0, 0))
    lockup.paste(ink, (0, 0), ink)
    ImageDraw.Draw(lockup).text((x, y), text, font=font, fill=(62, 62, 62, 255))
    trim(lockup, padding=8).save(OUT_MARK)
    print(f"wrote {OUT_C.name} {ink.size} and {OUT_MARK.name} text@({x},{y})")


if __name__ == "__main__":
    main()
