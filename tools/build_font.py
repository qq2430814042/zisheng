import os, re, base64, subprocess, sys, shutil

root = r"D:\CMIT-zisheng"
tmp = r"C:\Users\roman\AppData\Local\Temp\opencode\font"
ttf = os.path.join(tmp, "LXGWWenKai-Regular.ttf")

BASE_FILES = ["index.html", r"js\main.js", r"js\glyphs.js", r"js\particles.js", r"js\audio.js"]


def collect_base():
    need = set()
    for rel in BASE_FILES:
        s = open(os.path.join(root, rel), encoding="utf-8").read()
        for ch in s:
            if "\u4e00" <= ch <= "\u9fff":
                need.add(ch)
    for ch in " ．·、，。：；？！《》〈〉（）【】—…“”‘’「」『』％＋－×÷＝":
        need.add(ch)
    for i in range(0x20, 0x7F):
        need.add(chr(i))
    return need


def collect_ext():
    # 扩展字体：evo-index.js（含全部 1.5 万字）+ 项目文件中的 CJK
    need = set()
    p = os.path.join(root, "js", "evo-index.js")
    if os.path.exists(p):
        s = open(p, encoding="utf-8").read()
        for ch in s:
            if "\u3400" <= ch <= "\u9fff":
                need.add(ch)
    for rel in BASE_FILES:
        s = open(os.path.join(root, rel), encoding="utf-8").read()
        for ch in s:
            if "\u3400" <= ch <= "\u9fff":
                need.add(ch)
    return need


def subset(chars, out):
    cf = os.path.join(tmp, "subset_chars.txt")
    open(cf, "w", encoding="utf-8").write("".join(sorted(chars)))
    r = subprocess.run(
        [sys.executable, "-m", "fontTools.subset", ttf,
         "--text-file=" + cf, "--flavor=woff2", "--output-file=" + out,
         "--layout-features=*", "--no-hinting"],
        capture_output=True, text=True)
    if r.returncode != 0:
        print("SUBSET FAILED:", r.stderr[-800:])
        sys.exit(1)
    print(os.path.basename(out), round(os.path.getsize(out) / 1024), "KB", "(", len(chars), "chars )")


def inject_css(base_path, ext_path):
    b64 = base64.b64encode(open(base_path, "rb").read()).decode()
    face = (
        "/* 内嵌开源楷体：LXGW WenKai（SIL Open Font License 1.1）子集，见 fonts/OFL-LXGWWenKai.txt */\n"
        "@font-face {\n"
        '  font-family: "ZiShengKai";\n'
        "  font-style: normal;\n"
        "  font-weight: 400;\n"
        "  font-display: block;\n"
        '  src: url(data:font/woff2;base64,' + b64 + ') format("woff2");\n'
        "}\n\n"
        "/* 扩展字库字体（按需加载：仅当渲染普通字库之外的汉字时下载） */\n"
        "@font-face {\n"
        '  font-family: "ZiShengKai";\n'
        "  font-style: normal;\n"
        "  font-weight: 400;\n"
        "  font-display: swap;\n"
        "  unicode-range: U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF;\n"
        '  src: url("../fonts/zisheng-kai-ext.woff2") format("woff2");\n'
        "}\n\n"
    )
    css_path = os.path.join(root, "css", "style.css")
    css = open(css_path, encoding="utf-8").read()
    if "@font-face" in css:
        css = re.sub(r"/\* 内嵌开源楷体.*?\n\}\n\n(?:/\* 扩展字库字体.*?\n\}\n\n)?", "", css, flags=re.S)
    css = face + css
    open(css_path, "w", encoding="utf-8").write(css)
    print("css injected, size:", round(os.path.getsize(css_path) / 1024), "KB")


def main():
    assert os.path.exists(ttf), "missing TTF: " + ttf
    base = collect_base()
    ext = collect_ext()
    print("base chars:", len(base), " ext chars:", len(ext))

    base_out = os.path.join(tmp, "zisheng-kai.woff2")
    ext_out = os.path.join(tmp, "zisheng-kai-ext.woff2")
    subset(base, base_out)
    subset(ext, ext_out)

    fonts_dir = os.path.join(root, "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    shutil.copy(base_out, os.path.join(fonts_dir, "zisheng-kai.woff2"))
    shutil.copy(ext_out, os.path.join(fonts_dir, "zisheng-kai-ext.woff2"))
    ofl_src = os.path.join(tmp, "package", "OFL.txt") if os.path.exists(os.path.join(tmp, "package", "OFL.txt")) else os.path.join(tmp, "OFL.txt")
    if os.path.exists(ofl_src):
        shutil.copy(ofl_src, os.path.join(fonts_dir, "OFL-LXGWWenKai.txt"))
    else:
        print("OFL text not found, keeping existing fonts/OFL-LXGWWenKai.txt")

    inject_css(base_out, ext_out)
    print("done")


if __name__ == "__main__":
    main()
