# Builds every app icon / logo / favicon from the single brand source image (no redrawing).
# Usage: python scripts/build-app-icons.py   (needs Pillow: python -m pip install Pillow)
# Source: assets/brand/icon-source.webp (user-provided 사잇 icon: rounded white square + gradient wordmark on white canvas)
# Output:
#   assets/brand/console-icon-600.png   앱인토스 콘솔 업로드용 정사각(600×600, 모서리까지 꽉 참)
#   app/public/brand/logo.png           앱 안 브랜드 마크(512, 둥근 사각 밖은 투명)
#   app/public/brand/og-image.png       공유 미리보기 이미지(1200×630, 흰 배경 중앙에 아이콘)
#   app/public/favicon.png              브라우저 탭(64)
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'brand' / 'icon-source.webp'


def main() -> None:
    src = Image.open(SRC).convert('RGB')

    # 1. Shape mask: the canvas and the icon are both near-white, so find the icon by its soft drop edge —
    #    flood-fill the canvas from the corners with a tight threshold; everything not reached is the icon.
    probe = src.copy()
    for corner in [(0, 0), (src.width - 1, 0), (0, src.height - 1), (src.width - 1, src.height - 1)]:
        ImageDraw.floodfill(probe, corner, (255, 0, 255), thresh=6)
    outside = Image.eval(ImageChops.difference(probe, Image.new('RGB', src.size, (255, 0, 255))).convert('L'), lambda v: 255 if v < 8 else 0)
    inside = ImageChops.invert(outside).filter(ImageFilter.MedianFilter(9))
    box = inside.getbbox()
    side = max(box[2] - box[0], box[3] - box[1])
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    crop = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    art = src.crop(crop).resize((1024, 1024), Image.LANCZOS)
    shape = inside.crop(crop).resize((1024, 1024), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))

    out_brand = ROOT / 'app' / 'public' / 'brand'
    out_brand.mkdir(parents=True, exist_ok=True)

    # 2. Console icon: full-bleed square (the platform applies its own rounding). The icon background is white,
    #    so filling the cut corners with white keeps the original look.
    full = Image.composite(art, Image.new('RGB', art.size, (255, 255, 255)), shape)
    full.resize((600, 600), Image.LANCZOS).save(ROOT / 'assets' / 'brand' / 'console-icon-600.png', optimize=True)

    # 3. In-app logo: keep the rounded square, transparent outside.
    logo = art.convert('RGBA')
    logo.putalpha(shape)
    logo.resize((512, 512), Image.LANCZOS).save(out_brand / 'logo.png', optimize=True)

    # 4. Favicon.
    logo.resize((64, 64), Image.LANCZOS).save(ROOT / 'app' / 'public' / 'favicon.png', optimize=True)

    # 5. OG image: icon centered on a white card (no extra text — the platform shows the app name itself).
    og = Image.new('RGB', (1200, 630), (255, 255, 255))
    icon = full.resize((420, 420), Image.LANCZOS)
    og.paste(icon, ((1200 - 420) // 2, (630 - 420) // 2))
    og.save(out_brand / 'og-image.png', optimize=True)

    # 6. Wordmark: only the gradient letters, transparent elsewhere (home hero like the UI reference).
    #    Letter pixels are saturated; the icon background is near-white/pastel, so alpha = channel spread.
    rgb = art.copy()
    r, g, b = rgb.split()
    spread = ImageChops.subtract(ImageChops.lighter(ImageChops.lighter(r, g), b), ImageChops.darker(ImageChops.darker(r, g), b))
    alpha = spread.point(lambda v: 0 if v < 40 else min(255, (v - 40) * 6))
    letters_box = alpha.point(lambda v: 255 if v > 200 else 0).getbbox()
    pad = 12
    lb = (letters_box[0] - pad, letters_box[1] - pad, letters_box[2] + pad, letters_box[3] + pad)
    word = rgb.convert('RGBA')
    word.putalpha(alpha)
    word = word.crop(lb)
    word.thumbnail((640, 640), Image.LANCZOS)
    word.save(out_brand / 'wordmark.png', optimize=True)

    print('icon box', box, '→', crop, 'letters', lb)


if __name__ == '__main__':
    main()
