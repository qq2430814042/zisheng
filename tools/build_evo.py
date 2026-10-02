# -*- coding: utf-8 -*-
"""build_evo.py — 从 character-evolution-dataset-1bit（MIT）生成扩展演变字库数据。

用法:
  python tools/build_evo.py --dataset <dataset.bin> [--sheet out.png] [--limit N]

输出:
  js/evo-data.js   (EVO_EXTRA: 每个字的甲骨/金文/简帛/小篆/隶书骨架笔画，方向数字编码)

依赖: pip install zstandard pillow numpy fonttools
"""
import sys, os, math, json, argparse, collections, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ced_reader import CEDReader  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import numpy as np  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
DIRS = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
SIZE = 192
STAGE_ORDER = ["O", "J", "W", "Z", "L"]
STAGE_KEYS = {"O": "oracle", "J": "bronze", "W": "bamboo-silk", "Z": "seal", "L": "clerical"}


def load_font_chars():
    from fontTools.ttLib import TTFont
    font = TTFont(os.path.join(ROOT, "fonts", "zisheng-kai.woff2"))
    return set(chr(c) for c in font.getBestCmap().keys() if 0x4E00 <= c <= 0x9FFF)


def load_app_chars():
    import re
    s = open(os.path.join(ROOT, "js", "glyphs.js"), encoding="utf-8").read()
    chars = set()
    m = re.search(r"const LIB = \[(.*?)\];", s, re.S)
    if m:
        chars |= set(re.findall(r'"([^"]+)"', m.group(1)))
    m = re.search(r'RECOG_EXTRA = "([^"]+)"', s)
    if m:
        chars |= set(m.group(1))
    m = re.search(r"const STROKES = \{(.*?)\n\};", s, re.S)
    if m:
        chars |= set(re.findall(r"^\s*(\S):\s*\{", m.group(1), re.M))
    return chars


class GlyphSkel:
    def __init__(self, reader):
        self.r = reader
        self.by_id = collections.defaultdict(list)
        for k in reader.order:
            self.by_id[k.split("/", 1)[0]].append(k)
        self.rev = {c: i for i, c in reader.chars.items()}

    def candidates(self, ch, prefix):
        cid = self.rev.get(ch)
        if not cid:
            return []
        return [k for k in self.by_id.get(cid, []) if k.split("/")[-1][:1] == prefix]

    def mask(self, key):
        w, h, c, px = self.r.raw(key)
        arr = np.frombuffer(bytes(px), dtype=np.uint8)
        onebit = int(arr.max()) <= 1
        if c == 3:
            rgb = arr.reshape(h, w, 3)
            if onebit:
                rgb = rgb * 255
            im = Image.fromarray(rgb, "RGB").convert("L")
        else:
            g = arr.reshape(h, w)
            if onebit:
                g = g * 255
            im = Image.fromarray(g).convert("L")
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        m = np.asarray(im).astype(np.float32) < 128
        ys, xs = np.where(m)
        if len(xs) == 0:
            return None
        box = (xs.min(), ys.min(), xs.max(), ys.max())
        cropped = im.crop((box[0], box[1], box[2] + 1, box[3] + 1))
        bw, bh = cropped.size
        s = 170.0 / max(bw, bh)
        cropped = cropped.resize((max(1, round(bw * s)), max(1, round(bh * s))), Image.LANCZOS)
        canvas = Image.new("L", (SIZE, SIZE), 255)
        canvas.paste(cropped, ((SIZE - cropped.width) // 2, (SIZE - cropped.height) // 2))
        return (np.asarray(canvas) < 128)


def dilate(m):
    p = np.pad(m, 1)
    out = np.zeros_like(m)
    for dx, dy in NB:
        out |= p[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]]
    return out


def erode(m):
    p = np.pad(m, 1)
    out = np.ones_like(m)
    for dx, dy in NB:
        out &= p[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]]
    return out


def close(m, r=1):
    out = m
    for _ in range(r):
        out = dilate(out)
    for _ in range(r):
        out = erode(out)
    return out


def zhang_suen(img):
    im = img.copy().astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            p = np.pad(im, 1)
            P2 = p[:-2, 1:-1]; P3 = p[:-2, 2:]; P4 = p[1:-1, 2:]; P5 = p[2:, 2:]
            P6 = p[2:, 1:-1]; P7 = p[2:, :-2]; P8 = p[1:-1, :-2]; P9 = p[:-2, :-2]
            B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9
            seq = [P2, P3, P4, P5, P6, P7, P8, P9, P2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                rem = (im == 1) & (B >= 2) & (B <= 6) & (A == 1) & ((P2 * P4 * P6) == 0) & ((P4 * P6 * P8) == 0)
            else:
                rem = (im == 1) & (B >= 2) & (B <= 6) & (A == 1) & ((P2 * P4 * P8) == 0) & ((P2 * P6 * P8) == 0)
            if rem.any():
                im[rem] = 0
                changed = True
    return im


def prune_spurs(im, max_len=6, rounds=3):
    im = im.copy()
    for _ in range(rounds):
        pts = set(map(tuple, np.argwhere(im == 1)))
        ends = [p for p in pts if sum(1 for dx, dy in NB if (p[0] + dx, p[1] + dy) in pts) == 1]
        removed = False
        for e in ends:
            if e not in pts:
                continue
            branch = [e]
            prev, cur = None, e
            while True:
                nxt = [q for q in ((cur[0] + dx, cur[1] + dy) for dx, dy in NB) if q in pts and q != prev]
                if len(nxt) != 1 or len(branch) >= max_len:
                    break
                q = nxt[0]
                deg_q = sum(1 for dx, dy in NB if (q[0] + dx, q[1] + dy) in pts)
                if deg_q != 2:
                    break
                branch.append(q)
                prev, cur = cur, q
            if len(branch) < max_len:
                for p in branch:
                    im[p] = 0
                    pts.discard(p)
                removed = True
        if not removed:
            break
    return im


def trace(im):
    pts = set(map(tuple, np.argwhere(im == 1)))
    if not pts:
        return []
    deg = {p: sum(1 for dx, dy in NB if (p[0] + dx, p[1] + dy) in pts) for p in pts}
    nodes = {p for p in pts if deg[p] != 2}
    used = set()
    paths = []

    def neighbors(p):
        return [q for q in ((p[0] + dx, p[1] + dy) for dx, dy in NB) if q in pts]

    def walk_simple(start, first):
        path = [start, first]
        used.add((start, first)); used.add((first, start))
        prev, cur = start, first
        while cur not in nodes:
            nxt = [q for q in neighbors(cur) if q != prev and (cur, q) not in used]
            if not nxt:
                break
            q = nxt[0]
            used.add((cur, q)); used.add((q, cur))
            path.append(q)
            prev, cur = cur, q
        return path

    def angle(a, b, c):
        v1 = (b[0] - a[0], b[1] - a[1]); v2 = (c[0] - b[0], c[1] - b[1])
        n1 = math.hypot(*v1) or 1e-9; n2 = math.hypot(*v2) or 1e-9
        return (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)

    for node in list(nodes):
        while True:
            outs = [q for q in neighbors(node) if (node, q) not in used]
            if not outs:
                break
            paths.append(walk_simple(node, outs[0]))

    segs = paths
    consumed = [False] * len(segs)
    endpoint_segs = collections.defaultdict(list)
    for i, s in enumerate(segs):
        if len(s) >= 2:
            endpoint_segs[s[0]].append(i)
            endpoint_segs[s[-1]].append(i)
    merged = []
    for i, s in enumerate(segs):
        if consumed[i]:
            continue
        consumed[i] = True
        chain = list(s)
        while True:
            tip = chain[-1]
            cand = [j for j in endpoint_segs.get(tip, []) if not consumed[j]]
            if not cand:
                break
            if len(cand) == 1:
                j = cand[0]
            else:
                a = chain[-2] if len(chain) >= 2 else tip
                j = max(cand, key=lambda jj: angle(a, tip, segs[jj][-1] if segs[jj][0] == tip else segs[jj][0]))
            consumed[j] = True
            o = segs[j]
            oo = o if o[0] == tip else o[::-1]
            chain += oo[1:]
        merged.append(chain)
    loop_pts = pts - {p for s in segs for p in s}
    while loop_pts:
        start = next(iter(loop_pts))
        ring = [start]
        prev, cur = None, start
        guard = 0
        while True:
            nxt = [q for q in neighbors(cur) if q != prev]
            if not nxt:
                break
            q = nxt[0]
            if q == start:
                break
            ring.append(q)
            prev, cur = cur, q
            guard += 1
            if guard > 4000:
                break
        ring.append(ring[0])
        merged.append(ring)
        loop_pts -= set(ring)
    return merged


def encode_path(path):
    start = (path[0][1], path[0][0])  # (x, y)
    out = [str(start[0]), ",", str(start[1]), ":"]
    for i in range(1, len(path)):
        py, pxx = path[i - 1]
        cy, cxx = path[i]
        dx, dy = cxx - pxx, cy - py
        try:
            d = DIRS.index((dx, dy))
        except ValueError:
            d = 0
        out.append(str(d))
    return "".join(out)


def skeleton_paths(mask):
    m = close(mask, 1)
    sk = zhang_suen(m)
    sk = prune_spurs(sk, max_len=6)
    chains = trace(sk)
    paths = [c for c in chains if len(c) >= 5]
    return paths


def raw_ink_stats(gs, key):
    w, h, c, px = gs.r.raw(key)
    arr = np.frombuffer(bytes(px), dtype=np.uint8)
    if c == 3:
        arr = arr.reshape(h, w, 3).mean(axis=2).astype(np.uint8)
    else:
        arr = arr.reshape(h, w)
    if int(arr.max()) <= 1:
        m = arr > 0
    else:
        m = arr < 128
    ink = int(m.sum())
    if ink == 0:
        return None
    ys, xs = np.where(m)
    bw = int(xs.max() - xs.min()) + 1
    bh = int(ys.max() - ys.min()) + 1
    aspect = max(bw, bh) / max(1, min(bw, bh))
    return ink, aspect


def pick_glyph(gs, ch, prefix):
    cands = gs.candidates(ch, prefix)
    if not cands:
        return None, None
    infos = []
    for k in cands[:40]:
        st = raw_ink_stats(gs, k)
        if st is None:
            continue
        ink, aspect = st
        if ink < 6 or aspect > 3.4:
            continue
        infos.append((k, ink, aspect))
    if not infos:
        return None, None
    inks = sorted(i[1] for i in infos)
    med = inks[len(inks) // 2]
    best = min(infos, key=lambda t: (abs(t[1] - med), abs(t[2] - 1.0)))
    return best[0], best


def build_char(gs, ch):
    stages = {}
    picks = {}
    for pre in STAGE_ORDER:
        key, info = pick_glyph(gs, ch, pre)
        if not key:
            continue
        paths = skeleton_paths(gs.mask(key))
        if not paths:
            continue
        stages[STAGE_KEYS[pre]] = "|".join(encode_path(p) for p in paths)
        picks[STAGE_KEYS[pre]] = key
    return stages, picks


def render_sheet(gs, chars, out):
    cell = 120
    stages = ["oracle", "bronze", "bamboo-silk", "seal", "clerical"]
    cols = 6
    rows = (len(chars) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cell + 16) + 16, rows * (cell + 24) + 16), (12, 12, 18))
    dr = ImageDraw.Draw(sheet)
    for i, ch in enumerate(chars):
        cx = 16 + (i % cols) * (cell + 16)
        cy = 16 + (i // cols) * (cell + 24)
        stages_data, picks = build_char(gs, ch)
        tile = Image.new("RGB", (cell * 5, cell), (0, 0, 0))
        td = ImageDraw.Draw(tile)
        for si, st in enumerate(stages):
            if st not in stages_data:
                continue
            pts_paths = []
            for enc in stages_data[st].split("|"):
                head, dirs = enc.split(":")
                x, y = head.split(",")
                x, y = int(x), int(y)
                pts = [(x, y)]
                for d in dirs:
                    dx, dy = DIRS[int(d)]
                    x += dx; y += dy
                    pts.append((x, y))
                pts_paths.append(pts)
            sub = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
            sd = ImageDraw.Draw(sub)
            for pts in pts_paths:
                sd.line(pts, fill=(224, 190, 130), width=5, joint="curve")
            sub = sub.resize((cell, cell), Image.LANCZOS)
            tile.paste(sub, (si * cell, 0))
        sheet.paste(tile.resize((cell * 5 // 2, cell // 2), Image.LANCZOS), (cx, cy))
        dr.text((cx + 2, cy + cell // 2 + 2), ch + " " + " ".join(k.split("/")[-1][:1] for k in picks.values()), fill=(255, 255, 0))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.save(out)
    print("sheet:", out, sheet.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default=r"C:\Users\roman\AppData\Local\Temp\opencode\ced\package\dataset.bin")
    ap.add_argument("--out", default=os.path.join(ROOT, "js", "evo-data.js"))
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sheet-chars", default="")
    args = ap.parse_args()

    reader = CEDReader(args.dataset)
    gs = GlyphSkel(reader)
    target = sorted(load_font_chars() | load_app_chars())
    if args.limit:
        target = target[:args.limit]

    if args.sheet:
        if args.sheet_chars:
            chars = list(args.sheet_chars)
        else:
            chars = ["日", "月", "山", "水", "人", "我", "好", "明", "爱", "学", "生", "中", "马", "鱼", "鸟", "门", "车", "龟", "字", "书", "写", "读", "妈", "爸", "家", "国", "春", "秋", "风", "雨"]
        render_sheet(gs, chars, args.sheet)
        return

    data = {}
    stats = collections.Counter()
    picked_log = {}
    for n, ch in enumerate(target):
        stages, picks = build_char(gs, ch)
        if not stages:
            stats["none"] += 1
            continue
        data[ch] = stages
        picked_log[ch] = picks
        for st in stages:
            stats[st] += 1
        stats["chars"] += 1
        if n % 100 == 0:
            print(n, "/", len(target), ch, flush=True)

    lines = []
    lines.append("// 扩展演变字库数据（由 tools/build_evo.py 生成，勿手改）")
    lines.append("// 数据来源：character-evolution-dataset-1bit (MIT, © Leon Si) —— 甲骨/金文/简帛/小篆/隶书字形")
    lines.append("// 编码：每阶段为若干路径，'|' 分隔；路径格式 x,y:0123...（起点坐标 0-192 + 八方向步进 0=N 顺时针）")
    lines.append("export const EVO_EXTRA = {")
    for ch, stages in data.items():
        parts = []
        for st in ["oracle", "bronze", "bamboo-silk", "seal", "clerical"]:
            if st in stages:
                parts.append('"%s":"%s"' % (st, stages[st]))
        lines.append('"%s":{%s},' % (ch, ",".join(parts)))
    lines.append("};")
    lines.append("export const EVO_CHARS = " + json.dumps(list(data.keys()), ensure_ascii=False) + ";")
    js = "\n".join(lines)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    open(args.out, "w", encoding="utf-8").write(js)
    size = os.path.getsize(args.out)
    print("chars:", stats["chars"], "none:", stats["none"])
    for st in ["oracle", "bronze", "bamboo-silk", "seal", "clerical"]:
        print("  ", st, stats[st])
    print("written:", args.out, "%.2f MB" % (size / 1048576))
    json.dump(picked_log, open(os.path.join(os.path.dirname(args.out), "..", "assets", "dev", "evo_picks.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
