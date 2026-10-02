import os, re, base64, subprocess, sys

root = r"D:\CMIT-zisheng"
tmp = r"C:\Users\roman\AppData\Local\Temp\opencode\font"
ttf = os.path.join(tmp, "LXGWWenKai-Regular.ttf")
chars_file = os.path.join(tmp, "chars.txt")

# 1) 收集字符：项目中的全部 CJK + ASCII + 常用标点
need = set()
for rel in ["index.html", r"js\main.js", r"js\glyphs.js", r"js\particles.js", r"js\audio.js"]:
    s = open(os.path.join(root, rel), encoding="utf-8").read()
    for ch in s:
        if "\u4e00" <= ch <= "\u9fff":
            need.add(ch)
for ch in " ．·、，。：；？！《》〈〉（）【】—…“”‘’「」『』％＋－×÷＝":
    need.add(ch)
for i in range(0x20, 0x7F):
    need.add(chr(i))

with open(chars_file, "w", encoding="utf-8") as f:
    f.write("".join(sorted(need)))
print("chars:", len(need))

# 2) 子集化 → woff2
out = os.path.join(tmp, "zisheng-kai.woff2")
r = subprocess.run(
    [sys.executable, "-m", "fontTools.subset", ttf,
     "--text-file=" + chars_file, "--flavor=woff2", "--output-file=" + out,
     "--layout-features=*", "--no-hinting"],
    capture_output=True, text=True)
if r.returncode != 0:
    print("SUBSET FAILED:", r.stderr[-800:])
    sys.exit(1)
print("woff2:", round(os.path.getsize(out) / 1024), "KB")

# 3) 存一份到项目 fonts/ 目录（连同 OFL 许可）
fonts_dir = os.path.join(root, "fonts")
os.makedirs(fonts_dir, exist_ok=True)
import shutil
shutil.copy(out, os.path.join(fonts_dir, "zisheng-kai.woff2"))
shutil.copy(os.path.join(tmp, "package", "OFL.txt") if os.path.exists(os.path.join(tmp, "package", "OFL.txt")) else os.path.join(tmp, "OFL.txt"),
            os.path.join(fonts_dir, "OFL-LXGWWenKai.txt"))
print("copied to", fonts_dir)

# 4) base64 注入 css/style.css 顶部
b64 = base64.b64encode(open(out, "rb").read()).decode()
face = (
    "/* 内嵌开源楷体：LXGW WenKai（SIL Open Font License 1.1）子集，见 fonts/OFL-LXGWWenKai.txt */\n"
    "@font-face {\n"
    '  font-family: "ZiShengKai";\n'
    "  font-style: normal;\n"
    "  font-weight: 400;\n"
    "  font-display: block;\n"
    '  src: url(data:font/woff2;base64,' + b64 + ') format("woff2");\n'
    "}\n\n"
)
css_path = os.path.join(root, "css", "style.css")
css = open(css_path, encoding="utf-8").read()
if "@font-face" in css:
    css = re.sub(r"/\* 内嵌开源楷体.*?\n\}\n\n", "", css, flags=re.S)
css = face + css
open(css_path, "w", encoding="utf-8").write(css)
print("css injected, size:", round(os.path.getsize(css_path) / 1024), "KB")
