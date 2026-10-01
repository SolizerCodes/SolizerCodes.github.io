#!/usr/bin/env python3
"""Convert a PDF export of the card slides (front, back, front, back, ...) into tile files.

Usage:   python3 tools/pdf_to_tiles.py path/to/cards.pdf
Needs:   pip install pymupdf fonttools brotli pillow

Every slide becomes absolutely positioned HTML: text stays real (selectable) text, set in the free
font Cabin as a stand-in for Gill Sans Nova, widths matched to the original line by line. Lines and
shapes become an SVG overlay and pictures are extracted as WebP. Output goes to _tiles/ and
assets/img/. Existing files with the same names are overwritten.
"""
import hashlib, io, re, sys
from pathlib import Path

import pymupdf
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FONT_FILES = {"normal": ROOT / "assets/fonts/cabin-normal.woff2",
              "italic": ROOT / "assets/fonts/cabin-italic.woff2"}
# Gill Sans Nova style -> (Cabin file, Cabin weight). Cabin has no Light, so Light uses Regular.
STYLES = {"light": ("normal", 400), "regular": ("normal", 400),
          "bold": ("normal", 700), "italic": ("italic", 400)}


# ---------- font measuring (Cabin) ----------
_fonts, _instances = {}, {}

def instance(kind, wght, wdth):
    key = (kind, wght, wdth)
    if key not in _instances:
        if kind not in _fonts:
            _fonts[kind] = TTFont(FONT_FILES[kind])
        _instances[key] = instancer.instantiateVariableFont(
            _fonts[kind], {"wght": wght, "wdth": wdth}, inplace=False)
    return _instances[key]

def natural_width(text, style, wdth):
    """Width of `text` in em at the given Cabin width (kerning off, as in the page CSS)."""
    kind, wght = STYLES[style]
    f = instance(kind, wght, wdth)
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    total = 0
    for ch in text:
        g = cmap.get(ord(ch)) or cmap.get(ord("n"))
        total += hmtx[g][0]
    return total / upm

def vmetrics():
    f = instance("normal", 400, 100)
    upm = f["head"].unitsPerEm
    return f["hhea"].ascent / upm, -f["hhea"].descent / upm


# ---------- helpers ----------
def hexcol(c):
    if c is None:
        return None
    if isinstance(c, int):
        return "#%06x" % c
    return "#%02x%02x%02x" % tuple(round(v * 255) for v in c)

def style_of(fontname):
    n = fontname.lower()
    if "light" in n: return "light"
    if "bold" in n: return "bold"
    if "italic" in n: return "italic"
    return "regular"

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def num(v, d=3):
    return ("%." + str(d) + "f") % v if abs(v) > 1e-9 else "0"


# ---------- extraction ----------
def line_items(ln):
    """Spans of one text line. Letter-spaced text (PATTERN #01) comes out of the PDF with spaces
    between all letters, so it is rebuilt: spaces dropped, real word gaps kept."""
    chars = [(c, sp) for sp in ln["spans"] for c in sp["chars"]]
    vis = [(c, sp) for c, sp in chars if c["c"].strip()]
    if not vis:
        return []
    n_space = len(chars) - len(vis)
    if len(vis) >= 4 and n_space >= 0.4 * len(vis):
        xs = [c["origin"][0] for c, _ in vis]
        gaps = [b - a for a, b in zip(xs, xs[1:])]
        med = sorted(gaps)[len(gaps) // 2]
        txt = vis[0][0]["c"]
        for g, (c, _) in zip(gaps, vis[1:]):
            txt += (" " if g > 1.6 * med else "") + c["c"]
        c0, sp0 = vis[0]
        return [dict(text=txt, size=sp0["size"], style=style_of(sp0["font"]), color=hexcol(sp0["color"]),
                     x0=c0["bbox"][0], x1=vis[-1][0]["bbox"][2], base=c0["origin"][1])]
    out = []
    for sp in ln["spans"]:
        text = "".join(c["c"] for c in sp["chars"])
        if text.strip():
            out.append(dict(text=text, size=sp["size"], style=style_of(sp["font"]), color=hexcol(sp["color"]),
                            x0=sp["bbox"][0], x1=sp["bbox"][2], base=sp["origin"][1]))
    return out

def page_texts(page):
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        if b.get("type") != 0:
            continue
        block = []
        for ln in b["lines"]:
            if ln["dir"] == (1.0, 0.0):
                block += line_items(ln)
        if block:
            out.append(block)
    return out

def page_vectors(page):
    W, H = page.rect.width, page.rect.height
    paths = []
    for d in page.get_drawings():
        r = d["rect"]
        if r.x1 < 0 or r.x0 > W or r.y1 < 0 or r.y0 > H:
            continue                                  # leftovers of the template outside the card
        if d.get("fill") and abs(r.width - W) < 1 and abs(r.height - H) < 1 and tuple(d["fill"]) == (1, 1, 1):
            continue                                  # plain white page background
        seg = []
        for it in d["items"]:
            k = it[0]
            if k == "l":
                seg.append("M%s %sL%s %s" % (num(it[1].x, 2), num(it[1].y, 2), num(it[2].x, 2), num(it[2].y, 2)))
            elif k == "re":
                q = it[1]
                seg.append("M%s %sH%sV%sH%sz" % (num(q.x0, 2), num(q.y0, 2), num(q.x1, 2), num(q.y1, 2), num(q.x0, 2)))
            elif k == "qu":
                q = it[1]
                seg.append("M%s %sL%s %sL%s %sL%s %sz" % tuple(num(v, 2) for p in (q.ul, q.ur, q.lr, q.ll) for v in (p.x, p.y)))
            elif k == "c":
                seg.append("M%s %sC%s %s %s %s %s %s" % tuple(num(v, 2) for p in it[1:5] for v in (p.x, p.y)))
        if not seg:
            continue
        a = ['d="%s"' % "".join(seg)]
        fill, stroke = hexcol(d.get("fill")), hexcol(d.get("color"))
        a.append('fill="%s"' % (fill or "none"))
        if d.get("fill_opacity") not in (None, 1):
            a.append('fill-opacity="%s"' % num(d["fill_opacity"], 2))
        if stroke:
            a.append('stroke="%s" stroke-width="%s"' % (stroke, num(d.get("width") or 1, 2)))
            cap = d.get("lineCap")
            cap = cap[0] if isinstance(cap, (tuple, list)) else cap
            a.append('stroke-linecap="%s"' % {1: "round", 2: "square"}.get(cap, "butt"))
        paths.append("<path %s/>" % " ".join(a))
    return paths

_img_cache = {}
def save_image(doc, xref, name, img_dir):
    info = doc.extract_image(xref)
    data = info["image"]
    h = hashlib.md5(data + str(info.get("smask")).encode()).hexdigest()
    if h in _img_cache:
        return _img_cache[h]
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    if info.get("smask"):                              # transparency is stored as a separate image in PDFs
        mask = Image.open(io.BytesIO(doc.extract_image(info["smask"])["image"])).convert("L")
        im.putalpha(mask.resize(im.size))
    if name == "hsg-logo":                             # a logo can exist in several colour versions
        name += "-" + h[:6]
    path = img_dir / (name + ".webp")
    im.save(path, "WEBP", quality=88, method=6)
    _img_cache[h] = path.name
    return path.name


# ---------- HTML ----------
def build_face(doc, page, name, img_dir, wdths, asc, desc):
    W, H = page.rect.width, page.rect.height
    html = []
    vec = page_vectors(page)
    if vec:
        html.append('<svg viewBox="0 0 %s %s" preserveAspectRatio="none" aria-hidden="true">%s</svg>'
                    % (num(W, 2), num(H, 2), "".join(vec)))
    for n, im in enumerate(page.get_image_info(xrefs=True)):
        fn = save_image(doc, im["xref"], "%s-%d" % (name, n + 1) if im["width"] > 400 or im["height"] > 400 else "hsg-logo", img_dir)
        x0, y0, x1, y1 = im["bbox"]
        alt = "University of St.Gallen, Institute of Information Systems and Digital Business" if fn.startswith("hsg-logo") else ""
        html.append('<img src="/assets/img/%s" alt="%s" style="left:%s%%;top:%s%%;width:%s%%;height:%s%%" draggable="false">'
                    % (fn, alt, num(x0 / W * 100), num(y0 / H * 100), num((x1 - x0) / W * 100), num((y1 - y0) / H * 100)))
    k = (1 + asc - desc) / 2          # baseline distance from top of a line box with line-height 1
    for block in page_texts(page):
        spans = []
        for s in block:
            em = natural_width(s["text"], s["style"], wdths[s["style"]]) * s["size"]
            ls = (s["x1"] - s["x0"] - em) / len(s["text"]) / s["size"]
            kind, wght = STYLES[s["style"]]
            st = ["left:%s%%" % num(s["x0"] / W * 100), "top:%s%%" % num((s["base"] - k * s["size"]) / H * 100),
                  "font-size:%scqw" % num(s["size"] / W * 100)]
            if s["color"] != "#000000": st.append("color:%s" % s["color"])
            if s["style"] == "bold": st.append("font-weight:700")
            if s["style"] == "italic": st.append("font-style:italic")
            st.append("font-stretch:%s%%" % wdths[s["style"]])
            if abs(ls) > 0.0005: st.append("letter-spacing:%sem" % num(ls, 4))
            txt = s["text"].replace("&", "&amp;").replace("<", "&lt;")
            spans.append('<span style="%s">%s</span>' % (";".join(st), txt))
        html.append("<p>%s</p>" % "".join(spans))
    return "\n".join(html)


def main(pdf):
    doc = pymupdf.open(pdf)
    assert len(doc) % 2 == 0, "expected front/back pairs"
    img_dir = ROOT / "assets/img"; img_dir.mkdir(parents=True, exist_ok=True)
    tile_dir = ROOT / "_tiles"; tile_dir.mkdir(exist_ok=True)
    asc, desc = vmetrics()

    # pick, per style, the Cabin width that best matches Gill Sans Nova over the whole deck
    target, spans = {}, {}
    for page in doc:
        for block in page_texts(page):
            for s in block:
                spans.setdefault(s["style"], []).append(s)
    wdths = {}
    for style, lst in spans.items():
        want = sum(s["x1"] - s["x0"] for s in lst)
        best = min((abs(sum(natural_width(s["text"], style, w) * s["size"] for s in lst) - want), w)
                   for w in range(75, 101, 5))
        wdths[style] = best[1]
    print("Cabin width per style:", wdths)

    for old in list(tile_dir.glob("*")) + list(img_dir.glob("*")):
        if old.is_file() and not old.name.startswith("."):
            old.unlink()

    for i in range(0, len(doc), 2):
        front, back = doc[i], doc[i + 1]
        texts = [s for b in page_texts(front) for s in b]
        title = max(texts, key=lambda s: s["size"])["text"].strip()
        m = re.search(r"#\s*((?:\d\s*)+)", " ".join(s["text"] for s in texts))
        num_ = int(re.sub(r"\s", "", m.group(1))) if m else i // 2 + 1
        name = "%02d-%s" % (num_, slugify(title))
        f_html = build_face(doc, front, name + "-front", img_dir, wdths, asc, desc)
        b_html = build_face(doc, back, name + "-back", img_dir, wdths, asc, desc)
        (tile_dir / (name + ".html")).write_text(
            "---\ntitle: %s\nslide: true\n---\n%s\n<!--back-->\n%s\n" % (title, f_html, b_html), encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT.parent / "AI-Pattern-Cards-HSG.pdf"))
