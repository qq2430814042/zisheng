import re
import base64

BASE = r"D:\CMIT-zisheng"

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
hs_wrapped = ("(function(){\n" + hs_body + "\nwindow.HanScribeLib = {" + ",".join(entries) + "};\n})();")

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

glyphs = strip_module(read(r"js\glyphs.js"))
stroke_counts = strip_module(read(r"js\stroke-counts.js"))
audio = strip_module(read(r"js\audio.js"))
particles = strip_module(read(r"js\particles.js"))
main = strip_module(read(r"js\main.js"))

parts = [three, glyphs, stroke_counts, hs_wrapped, audio, particles, main]
full = "\n\n".join(parts)

# 去掉重复的 FONT_STACK 定义（保留第一个）
first = full.find("const FONT_STACK")
if first >= 0:
    head = full[:first + 10]
    tail = full[first + 10:]
    tail = re.sub(r"\nconst FONT_STACK = .*?;\n", "\n", tail)
    full = head + tail

html = read("index.html")
old_tag = '<script type="module" src="js/main.js"></script>'
assert old_tag in html, "script tag not found"
inline = '<script type="module">\n' + full + "\n</script>"
html = html.replace(old_tag, hs_assets + inline)

css = read(r"css\style.css")
old_css = '<link rel="stylesheet" href="css/style.css">'
assert old_css in html, "css link not found"
html = html.replace(old_css, "<style>\n" + css + "\n</style>")

html = html.replace("<title>字·生 —— 汉字五体演变的粒子交互体验</title>",
                    "<title>字·生 —— 汉字五体演变的粒子交互体验（单文件版）</title>")

out = BASE + r"\字生-单文件版.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", out, len(html), "chars,", round(len(html.encode('utf-8')) / 1024 / 1024, 2), "MB")
