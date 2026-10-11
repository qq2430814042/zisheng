# -*- coding: utf-8 -*-
"""build_unihan.py — 从 Unihan 提取部首/笔画，写入 js/evo-index.js。

用法: python tools/build_unihan.py [Unihan.zip 解压目录]
默认读取 %LOCALAPPDATA%\\Temp\\opencode-update（内含 Unihan_RadicalStrokeCounts.txt / Unihan_IRGSources.txt）
数据源: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
顺序: build_font.py → build_evo.py → build_unihan.py → build_single.py
"""
import base64
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("LOCALAPPDATA", ""), "Temp", "opencode-update")

rsk = os.path.join(DIR, "Unihan_RadicalStrokeCounts.txt")
irg = os.path.join(DIR, "Unihan_IRGSources.txt")
assert os.path.exists(rsk) and os.path.exists(irg), "缺少 Unihan 文件，请先下载解压 Unihan.zip 到 " + DIR

rad = {}
strokes = {}
# Unicode 18 起 kRSUnicode 位于 Unihan_IRGSources.txt（旧版可能在 RadicalStrokeCounts），两处都扫
for f in (irg, rsk):
    for line in open(f, encoding="utf-8"):
        if line.startswith("#"):
            continue
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 3:
            continue
        try:
            cp = int(parts[0][2:], 16)
        except Exception:
            continue
        if parts[1] == "kRSUnicode":
            try:
                n = int(parts[2].split()[0].split(".")[0].rstrip("'"))
                if 1 <= n <= 214:
                    rad.setdefault(cp, n)
            except Exception:
                pass
        elif parts[1] == "kTotalStrokes":
            try:
                n = int(parts[2].split()[0])
                if 1 <= n <= 64:
                    strokes.setdefault(cp, n)
            except Exception:
                pass
print("unihan rad:", len(rad), " strokes:", len(strokes))

p = os.path.join(ROOT, "js", "evo-index.js")
s = open(p, encoding="utf-8").read()
chars = json.loads(re.search(r'EVO_CHARS = ("(?:[^"\\]|\\.)*");', s).group(1))

rad_b = bytearray()
str_b = bytearray()
have_r = have_s = 0
for ch in chars:
    cp = ord(ch)
    r = rad.get(cp, 0)
    st = strokes.get(cp, 0)
    if r:
        have_r += 1
    if st:
        have_s += 1
    rad_b.append(r)
    str_b.append(st)
print("coverage: rad %d/%d  strokes %d/%d" % (have_r, len(chars), have_s, len(chars)))

# 214 部首显示字形：Kangxi Radicals 区块 U+2F00 起，NFKC 归一到通行的 CJK 等价字
radicals = []
for n in range(214):
    ch = chr(0x2F00 + n)
    norm = unicodedata.normalize("NFKC", ch)
    radicals.append(norm if len(norm) == 1 else ch)
rad_str = "".join(radicals)
assert len(rad_str) == 214, "radical string must be 214 chars"

rad_b64 = base64.b64encode(bytes(rad_b)).decode()
str_b64 = base64.b64encode(bytes(str_b)).decode()

def upsert(name, value):
    global s
    pat = re.compile(r'export const ' + name + r' = ".*?";\n', re.S)
    line = 'export const ' + name + ' = "' + value + '";\n'
    if pat.search(s):
        s = pat.sub(line, s)
    else:
        s = s.rstrip("\n") + "\n" + line

upsert("EVO_RAD", rad_b64)
upsert("EVO_STR", str_b64)
upsert("EVO_RADICALS", rad_str)
open(p, "w", encoding="utf-8").write(s)
print("evo-index.js updated:", os.path.getsize(p), "bytes")
