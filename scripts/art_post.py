#!/usr/bin/env python3
"""Post-process generated art: art/gen/out/<kind>/<id>.png → public/art/<kind>/<id>.webp + contact sheets.

  ~/.hermes/hermes-agent/venv/bin/python scripts/art_post.py [kind ...] [--force] [--sheet-only]
  ~/.hermes/hermes-agent/venv/bin/python scripts/art_post.py --sheet-dir art/gen/test --name styletest

Cover-crops to the shipped size per kind, adds the house ink vignette (STYLE.md "Edges"), writes WebP
q80, then renders art/previews/gen_<kind>.png from the shipped files. Backdrop kinds (eras, key) take
`<id>.png` → 1600×900 and `<id>-portrait.png` → 900×1600. Unchanged outputs are skipped unless --force.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "gen" / "out"
PUBLIC = ROOT / "public" / "art"
PREVIEWS = ROOT / "art" / "previews"

KINDS = ["leaders", "doctrines", "edicts", "crises", "omens", "reforms", "eras", "key"]
CARD = (512, 512)
SIZE = {"leaders": (640, 800), "doctrines": CARD, "edicts": CARD, "crises": CARD, "omens": CARD,
        "reforms": CARD, "eras": (1600, 900), "key": (1600, 900)}
# vertical focal point for the cover crop (0 = keep top, 0.5 = centre): faces sit high in portraits
FOCUS_Y = {"leaders": 0.08}
# vignette strength at the corners (0..1) and where the falloff starts (normalised radius)
VIGNETTE = {"leaders": (0.55, 0.55), "eras": (0.5, 0.6), "key": (0.5, 0.6)}
VIGNETTE_CARD = (0.7, 0.5)
INK = np.array([11, 15, 26], dtype=np.float32)  # deep ink navy
PORTRAIT_SUFFIX = "-portrait"
QUALITY = 80
SHEET_PREFIX = "_sheet_"  # multi-vignette generations (art_jobs.ts SHEET_KINDS), split into per-id PNGs


def target_size(kind: str, stem: str) -> tuple[int, int]:
    w, h = SIZE[kind]
    return (h, w) if stem.endswith(PORTRAIT_SUFFIX) else (w, h)


def cover(img: Image.Image, size: tuple[int, int], focus_y: float) -> Image.Image:
    tw, th = size
    scale = max(tw / img.width, th / img.height)
    rw, rh = max(tw, round(img.width * scale)), max(th, round(img.height * scale))
    img = img.resize((rw, rh), Image.LANCZOS)
    left = (rw - tw) // 2
    top = round((rh - th) * focus_y)
    return img.crop((left, top, left + tw, top + th))


def vignette(img: Image.Image, strength: float, start: float) -> Image.Image:
    w, h = img.size
    y, x = np.ogrid[0:h, 0:w]
    # normalised elliptical radius: 0 centre, 1 at the edge midpoints, ~1.41 in the corners
    r = np.sqrt(((x - (w - 1) / 2) / (w / 2)) ** 2 + ((y - (h - 1) / 2) / (h / 2)) ** 2) / math.sqrt(2)
    t = np.clip((r - start / math.sqrt(2)) / (1 - start / math.sqrt(2)), 0, 1)
    a = (t * t * (3 - 2 * t) * strength)[..., None]  # smoothstep falloff
    px = np.asarray(img.convert("RGB"), dtype=np.float32)
    return Image.fromarray((px * (1 - a) + INK * a).round().astype(np.uint8))


def gutter(lum: np.ndarray, axis: int) -> int:
    """Index of the darkest line (the painted gap between sheet cells) within the middle 20 % of an axis."""
    profile = lum.mean(axis=axis)
    n = profile.shape[0]
    lo, hi = int(n * 0.4), int(n * 0.6)
    return lo + int(np.argmin(profile[lo:hi]))


def split_sheets(kind: str, force: bool) -> int:
    """Cut the multi-vignette sheet jobs (art_jobs.ts SHEET_KINDS) into one raw PNG per cell id."""
    jobs_file = ROOT / "art" / "gen" / f"{kind}.json"
    if not jobs_file.exists():
        return 0
    n = 0
    for job in json.loads(jobs_file.read_text()):
        sheet = ROOT / job["out"]
        if "cells" not in job or not sheet.exists():
            continue
        cells = job["cells"]
        outs = [RAW / kind / f"{cid}.png" for cid in cells]
        if not force and all(o.exists() and o.stat().st_mtime >= sheet.stat().st_mtime for o in outs):
            continue
        img = Image.open(sheet).convert("RGB")
        lum = np.asarray(img.convert("L"), dtype=np.float32)
        w, h = img.size
        x = gutter(lum, 0)
        if job["layout"] == "2x2":
            y = gutter(lum, 1)
            boxes = [(0, 0, x, y), (x, 0, w, y), (0, y, x, h), (x, y, w, h)]
        else:
            boxes = [(0, 0, x, h), (x, 0, w, h)]
        for cid, out, (l, t, r, b) in zip(cells, outs, boxes):
            inset = round(min(r - l, b - t) * 0.02)  # drop the gap line and any cell-edge bleed
            l, t, r, b = l + inset, t + inset, r - inset, b - inset
            side = min(r - l, b - t)
            cx, cy = (l + r) // 2, (t + b) // 2
            img.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)).save(out)
            n += 1
    return n


def process_kind(kind: str, force: bool) -> int:
    src_dir, dst_dir = RAW / kind, PUBLIC / kind
    if not src_dir.is_dir():
        return 0
    split_sheets(kind, force)
    dst_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for src in sorted(p for p in src_dir.glob("*.png") if not p.name.startswith(SHEET_PREFIX)):
        dst = dst_dir / f"{src.stem}.webp"
        if not force and dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        img = cover(Image.open(src).convert("RGB"), target_size(kind, src.stem), FOCUS_Y.get(kind, 0.5))
        img = vignette(img, *VIGNETTE.get(kind, VIGNETTE_CARD))
        img.save(dst, "WEBP", quality=QUALITY, method=6)
        n += 1
    return n


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for f in ("/System/Library/Fonts/Supplemental/Trebuchet MS.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size)


def contact_sheet(files: list[Path], out: Path, title: str) -> None:
    if not files:
        return
    first = Image.open(files[0])
    aspect = first.width / first.height
    cell_w = 360 if aspect > 1.2 else 200
    cell_h = round(cell_w / aspect)
    cols = max(1, min(len(files), 2400 // (cell_w + 12)))
    rows = math.ceil(len(files) / cols)
    label_h, pad, head = 22, 12, 48
    sheet = Image.new("RGB", (pad + cols * (cell_w + pad), head + rows * (cell_h + label_h + pad) + pad), (14, 18, 30))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 12), f"{title} — {len(files)} images", fill=(224, 184, 74), font=font(24))
    f = font(14)
    for i, p in enumerate(files):
        x = pad + (i % cols) * (cell_w + pad)
        y = head + (i // cols) * (cell_h + label_h + pad)
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell_w, cell_h), Image.LANCZOS)
        sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2))
        d.text((x, y + cell_h + 4), p.stem[:34], fill=(220, 214, 200), font=f)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"sheet {out.relative_to(ROOT)} ({len(files)})")


def kind_sheets(kind: str) -> None:
    files = sorted((PUBLIC / kind).glob("*.webp")) if (PUBLIC / kind).is_dir() else []
    land = [p for p in files if not p.stem.endswith(PORTRAIT_SUFFIX)]
    port = [p for p in files if p.stem.endswith(PORTRAIT_SUFFIX)]
    contact_sheet(land, PREVIEWS / f"gen_{kind}.png", kind)
    if port:
        contact_sheet(port, PREVIEWS / f"gen_{kind}_portrait.png", f"{kind} (portrait)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("kinds", nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sheet-only", action="store_true")
    ap.add_argument("--sheet-dir", help="make one contact sheet from every PNG/WebP in this folder")
    ap.add_argument("--name", default="adhoc")
    a = ap.parse_args()
    if a.sheet_dir:
        d = Path(a.sheet_dir)
        contact_sheet(sorted([*d.glob("*.png"), *d.glob("*.webp")]), PREVIEWS / f"gen_{a.name}.png", a.name)
        return
    kinds = a.kinds or KINDS
    unknown = [k for k in kinds if k not in SIZE]
    if unknown:
        sys.exit(f"unknown kind(s): {unknown}")
    for kind in kinds:
        if not a.sheet_only:
            print(f"{kind}: {process_kind(kind, a.force)} written")
        kind_sheets(kind)
    total = sum(p.stat().st_size for p in PUBLIC.rglob("*.webp")) if PUBLIC.is_dir() else 0
    print(f"public/art total {total / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
