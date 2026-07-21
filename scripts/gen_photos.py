"""
Derive the web-ready office photos from a full-resolution source.

The source (assets/img/office-source.jpg) is committed once and never served;
everything the site loads is generated here, so the page never ships a 3 MB
camera JPEG. Re-run after replacing the source:

    python tools/gen_photos.py

Outputs:
    office-hero.jpg          1200x900 facade crop, masked into the right edge of
                             the home page hero. CSS fades it out before it
                             reaches the copy — see the contrast note on
                             .hero-bg in site.css before changing its width.
    office-og.jpg            1200x630 landscape crop for Teams/Slack previews
    drafting-corner-web.jpg  1400x933 interior, on the About page

Both are progressive JPEGs at quality 82, which is the point on this kind of
architectural subject where further compression starts to show on the sky
gradient and the facade's fine mullion lines.
"""

import io
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required: python -m pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")

# (source, output, width, height, vertical bias)
# Vertical bias picks which part of a too-tall crop to keep: 0.0 is the top,
# 0.5 dead centre, 1.0 the bottom.
DERIVATIVES = [
    # Exterior. The hero crop is masked to near-nothing on its left in CSS, so
    # it wants the facade weighted right; the social crop sits lower so the
    # entrance and street level still read at preview size.
    ("office-source.jpg", "office-hero.jpg", 1200, 900, 0.42),
    ("office-source.jpg", "office-og.jpg", 1200, 630, 0.62),
    # Interior, for the About page. Already 3:2, so this is a straight
    # downscale and recompress rather than a crop.
    ("drafting-corner.jpg", "drafting-corner-web.jpg", 1400, 933, 0.50),
]

QUALITY = 82


def derive(src, name, width, height, bias):
    out = os.path.join(IMG, name)
    im = ImageOps.exif_transpose(src)          # honour camera rotation
    im = im.convert("RGB")

    # Cover-fit: scale to fill, then crop the overflow using the bias.
    target = width / height
    actual = im.width / im.height
    if actual > target:                        # too wide — trim the sides
        new_w = int(im.height * target)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:                                      # too tall — trim top/bottom
        new_h = int(im.width / target)
        top = int((im.height - new_h) * bias)
        im = im.crop((0, top, im.width, top + new_h))

    im = im.resize((width, height), Image.LANCZOS)
    im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return out, os.path.getsize(out)


def main():
    cache, seen = {}, None
    for source, name, w, h, bias in DERIVATIVES:
        path = os.path.join(IMG, source)
        if not os.path.exists(path):
            sys.exit("Source photo not found: %s\nSave it there, then re-run." % path)

        if source not in cache:
            cache[source] = Image.open(path)
        if source != seen:
            seen = source
            print("%s — %d x %d, %.0f KB" % (
                source, cache[source].width, cache[source].height,
                os.path.getsize(path) / 1e3))

        out, size = derive(cache[source], name, w, h, bias)
        print("  %-26s %4d x %-4d  %6.0f KB" % (name, w, h, size / 1e3))


if __name__ == "__main__":
    main()
