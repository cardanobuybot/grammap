"""Draws the GramMap mark (a sheet with one plot staked out) as PNG icons."""
import sys
from PIL import Image, ImageDraw

SHEET = (14, 51, 113)
CHALK = (234, 242, 255)
FLAG = (255, 107, 44)


def mark(size: int) -> Image.Image:
    scale = 4  # supersample for clean edges
    s = size * scale
    img = Image.new("RGB", (s, s), SHEET)
    d = ImageDraw.Draw(img, "RGBA")
    inset = round(s * 0.16)
    frame = max(2, round(s * 0.035))
    cell = (s - 2 * inset) / 3
    grid = max(1, round(s * 0.014))
    for i in (1, 2):
        p = round(inset + cell * i)
        d.line([(p, inset), (p, s - inset)], fill=CHALK + (95,), width=grid)
        d.line([(inset, p), (s - inset, p)], fill=CHALK + (95,), width=grid)
    d.rectangle(
        [round(inset + cell), round(inset + cell), round(inset + 2 * cell), round(inset + 2 * cell)],
        fill=FLAG + (255,),
    )
    d.rectangle([inset, inset, s - inset, s - inset], outline=CHALK + (255,), width=frame)
    return img.resize((size, size), Image.LANCZOS)


out = sys.argv[1]
for size in (32, 180, 512):
    mark(size).save(f"{out}/icon-{size}.png", optimize=True)
mark(48).save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("icons written")
