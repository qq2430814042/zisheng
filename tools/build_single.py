import re
import base64
import os
import glob

# 仓库根目录由脚本位置推导（不再硬编码、不再依赖 CWD）
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    return open(BASE + "\\" + p, encoding="utf-8").read()

def read_bytes(p):
    return open(BASE + "\\" + p, "rb").read()

three = read(r"vendor\three.module.js")
m = re.search(r"export \{([^}]*)\};", three)
assert m, "three export not found"
three = three[:m.start()] + "window.THREE = {" + m.group(1) + "};" + three[m.end():]

# HanScribe：整体包进 IIFE 防顶层命名冲突，export 列表转 window.HanScribeLib
hs = read(r"vendor\hanscribe.js")
m = re.search(r"export\s*\{([^}]*)\};", hs)
assert m, "hanscribe export not found"
entries = []
for part in m.group(1).split(","):
    part = part.strip()
    if not part:
        continue
    if " as " in part:
        a, b = [x.strip() for x in part.split(" as ")]
    else:
        a = b = part
    if b != "default":
        entries.append(b + ":" + a)
hs_body = hs[:m.start()]
hs_wrapped = (
    "/* HanScribe - Copyright (c) 2026 Peter Olson, MIT License (see vendor/hanscribe-LICENSE.txt) */\n"
    "(function(){\n" + hs_body + "\nwindow.HanScribeLib = {" + ",".join(entries) + "};\n})();"
)

# 内嵌 wasm 与模型为 base64（单文件离线自洽）
wasm_b64 = base64.b64encode(read_bytes(r"vendor\hanscribe-inference.wasm")).decode()
model_b64 = base64.b64encode(read_bytes(r"vendor\hanscribe.hzmodel")).decode()
hs_assets = (
    '<script>window.__HS_WASM_B64="' + wasm_b64 + '";window.__HS_MODEL_B64="' + model_b64 + '";</script>\n'
)

def strip_module(src):
    src = re.sub(r"^import .*?;$", "", src, flags=re.M)
    src = re.sub(r"^export ", "", src, flags=re.M)
    return src

evo_index = strip_module(read(r"js\evo-index.js"))
glyphs = strip_module(read(r"js\glyphs.js"))
stroke_counts = strip_module(read(r"js\stroke-counts.js"))
audio = strip_module(read(r"js\audio.js"))
particles = strip_module(read(r"js\particles.js"))
main = strip_module(read(r"js\main.js"))

parts = [three, evo_index, glyphs, stroke_counts, hs_wrapped, audio, particles, main]
full = "\n\n".join(parts)

# 去掉重复的 FONT_STACK 定义（保留第一个）
first = full.find("const FONT_STACK")
if first >= 0:
    head = full[:first + 10]
    tail = full[first + 10:]
    tail = re.sub(r"\nconst FONT_STACK = .*?;\n", "\n", tail)
    full = head + tail

import glob as _g

shard_files = sorted(_g.glob(os.path.join(BASE, "js", "evo-data", "shard-*.json")))
shards_html = []
for i, p in enumerate(shard_files):
    txt = open(p, encoding="utf-8").read()
    assert "</" not in txt, "unexpected </ in shard " + p
    shards_html.append('<script type="application/json" id="evo-shard-%d">%s</script>' % (i, txt))
print("shards embedded:", len(shard_files))

html = read("index.html")
old_tag = '<script type="module" src="js/main.js"></script>'
assert old_tag in html, "script tag not found"
flag = "<script>window.__SINGLE_FILE__=true;</script>\n"
inline = '<script type="module">\n' + full + "\n</script>"
html = html.replace(old_tag, flag + hs_assets + "".join(shards_html) + "\n" + inline)

css = read(r"css\style.css")
# 扩展字体为多分块（build_font.py 生成），逐个内嵌
ext_files = sorted(glob.glob(os.path.join(BASE, "fonts", "zisheng-kai-ext-*.woff2")))
for fp in ext_files:
    fname = fp.replace("\\", "/").rsplit("/", 1)[-1]
    b64 = base64.b64encode(open(fp, "rb").read()).decode()
    css = css.replace('url("../fonts/' + fname + '")', "url(data:font/woff2;base64," + b64 + ")")
print("ext font chunks embedded:", len(ext_files))
old_css = '<link rel="stylesheet" href="css/style.css">'
assert old_css in html, "css link not found"
html = html.replace(old_css, "<style>\n" + css + "\n</style>")

html = html.replace("<title>字·生 —— 汉字五体演变的粒子交互体验</title>",
                    "<title>字·生 —— 汉字五体演变的粒子交互体验（单文件版）</title>")

# ---------- 交付产物完整性断言（防"看似成功、其实仍引用外链/带着 dev 钩子"） ----------
assert 'src="js/' not in html and "src='js/" not in html, "single file still references js/"
assert 'href="css/' not in html, "single file still references css/"
assert 'url("../fonts' not in html, "single file still references ../fonts"
m = re.search(r"EVO_SHARD_COUNT = (\d+)", evo_index)
assert m, "EVO_SHARD_COUNT not found in evo-index.js"
assert html.count('id="evo-shard-') == int(m.group(1)) == len(shard_files), "shard count mismatch"
assert "window.HanScribeLib = {" in html, "HanScribeLib missing"
assert "Peter Olson" in html, "HanScribe MIT notice missing"
assert "__noDownload" not in html and "__hsReady" not in html and "__posterSize" not in html, "dev hooks leaked into single file"
assert 'get("dev")' not in html and "?dev=" not in html, "dev query hook leaked into single file"

out = os.path.join(BASE, "字生-单文件版.html")
tmp = out + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(html)
os.replace(tmp, out)  # 原子替换，避免中途失败留下截断产物

print("written:", out, len(html), "chars,", round(len(html.encode('utf-8')) / 1024 / 1024, 2), "MB")
