import re
import io

BASE = r"D:\CMIT-zisheng"

def read(p):
    return open(BASE + "\\" + p, encoding="utf-8").read()

three = read(r"vendor\three.module.js")
m = re.search(r"export \{([^}]*)\};", three)
assert m, "three export not found"
three = three[:m.start()] + "window.THREE = {" + m.group(1) + "};" + three[m.end():]

def strip_module(src):
    src = re.sub(r"^import .*?;$", "", src, flags=re.M)
    src = re.sub(r"^export ", "", src, flags=re.M)
    return src

glyphs = strip_module(read(r"js\glyphs.js"))
audio = strip_module(read(r"js\audio.js"))
particles = strip_module(read(r"js\particles.js"))
main = strip_module(read(r"js\main.js"))

parts = [three, glyphs, audio, particles, main]
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
html = html.replace(old_tag, inline)

css = read(r"css\style.css")
old_css = '<link rel="stylesheet" href="css/style.css">'
assert old_css in html, "css link not found"
html = html.replace(old_css, "<style>\n" + css + "\n</style>")

html = html.replace("<title>字·生 —— 汉字五体演变的粒子交互体验</title>",
                    "<title>字·生 —— 汉字五体演变的粒子交互体验（单文件版）</title>")

out = BASE + r"\字生-单文件版.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", out, len(html), "chars")
