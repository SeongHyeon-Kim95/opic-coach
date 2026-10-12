"""앱 아이콘 생성 (PIL). 말풍선 + 음성 파형."""
from PIL import Image, ImageDraw
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'icons'
GREEN, CREAM, ORANGE = (31, 92, 75), (250, 247, 240), (242, 104, 60)


def draw(size, *, rounded, scale):
    S = size * 4  # 슈퍼샘플링 후 축소
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.23), fill=GREEN)
    else:
        d.rectangle([0, 0, S, S], fill=GREEN)
    c, w = S / 2, S * scale
    # 말풍선
    x0, y0, x1, y1 = c - w / 2, c - w * 0.40, c + w / 2, c + w * 0.30
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(w * 0.2), fill=CREAM)
    d.polygon([(c - w * 0.22, y1 - 2), (c - w * 0.30, y1 + w * 0.2), (c - w * 0.02, y1 - 2)], fill=CREAM)
    # 파형
    heights = [0.16, 0.32, 0.46, 0.28, 0.40, 0.20]
    bw = w * 0.075
    gap = w * 0.045
    total = len(heights) * bw + (len(heights) - 1) * gap
    cy = (y0 + y1) / 2
    for i, h in enumerate(heights):
        bx = c - total / 2 + i * (bw + gap)
        hh = w * h / 2
        d.rounded_rectangle([bx, cy - hh, bx + bw, cy + hh], radius=int(bw * 0.42), fill=ORANGE)
    return im.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
draw(192, rounded=True, scale=0.62).save(OUT / 'icon-192.png')
draw(512, rounded=True, scale=0.62).save(OUT / 'icon-512.png')
draw(512, rounded=False, scale=0.48).save(OUT / 'maskable-512.png')
draw(180, rounded=False, scale=0.6).convert('RGB').save(OUT / 'apple-touch-icon.png')
print(sorted(p.name for p in OUT.iterdir()))
