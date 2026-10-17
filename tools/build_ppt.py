# -*- coding: utf-8 -*-
"""build_ppt.py — 生成《字·生》参赛演示文稿（字生-演示文稿.pptx）

深色墨金风、16:9、纯展示向（无教学环节与讲稿）。
截图取自 assets/submission/（提交截图同款）。
用法: python tools/build_ppt.py
"""
import os
import glob
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "assets", "submission")
OUT = os.path.join(ROOT, "字生-演示文稿.pptx")

BG = "0B0B0F"
CARD = "15151C"
INK = "E9E6DF"
DIM = "A8A296"
GOLD = "E0B36A"
LINE = "34343E"
KAI = "楷体"
YAHEI = "微软雅黑"
W, H = 13.333, 7.5


def shot(name):
    hits = glob.glob(os.path.join(SHOTS, "*" + name + "*.jpg"))
    if not hits:
        raise SystemExit("缺少截图: " + name)
    return hits[0]


prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)


def cjk(run, name):
    run.font.name = name
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", name)


def set_alpha(shape, pct):
    clr = shape._element.spPr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
    clr.append(clr.makeelement(qn("a:alpha"), {"val": str(int(pct * 1000))}))


def rect(slide, x, y, w, h, color, alpha=None, line=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if color:
        shp.fill.solid()
        shp.fill.fore_color.rgb = RGBColor.from_string(color)
        if alpha is not None:
            set_alpha(shp, alpha)
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = RGBColor.from_string(line)
        shp.line.width = Pt(0.9)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def frame(slide, x, y, w, h):
    rect(slide, x, y, w, h, None, line=LINE)


def tb(slide, x, y, w, h, blocks):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    first = True
    for b in blocks:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = b.get("align", PP_ALIGN.LEFT)
        if b.get("before"):
            p.space_before = Pt(b["before"])
        p.line_spacing = b.get("line", 1.18)
        for r in b["runs"]:
            run = p.add_run()
            run.text = r[0]
            run.font.size = Pt(r[1])
            run.font.bold = r[3] if len(r) > 3 else False
            run.font.color.rgb = RGBColor.from_string(r[2])
            cjk(run, r[4] if len(r) > 4 else YAHEI)
    return box


def new_slide():
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, H, BG)
    return s


def head(s, kicker, title, sub=None):
    tb(s, 0.62, 0.42, 11.8, 0.4, [{"runs": [(kicker, 13, GOLD, False)]}])
    rect(s, 0.64, 0.82, 0.5, 0.028, GOLD)
    blocks = [{"runs": [(title, 30, INK, False, KAI)]}]
    if sub:
        blocks.append({"runs": [(sub, 13.5, DIM)], "before": 6})
    tb(s, 0.62, 0.98, 12.1, 1.0, blocks)


def foot(s, page):
    tb(s, 0.62, 7.03, 8, 0.3, [{"runs": [("《字·生》· 作品编号 316056 · 牛景飞（北京语言大学）", 10, "6B675E")]}])
    tb(s, 12.2, 7.03, 0.9, 0.3, [{"runs": [(page, 10, "6B675E")], "align": PP_ALIGN.RIGHT}])


def img_right(s, path, x=7.45, y=2.32, w=5.3):
    pic = s.shapes.add_picture(path, Inches(x), Inches(y), width=Inches(w))
    h = pic.height / 914400
    frame(s, x - 0.022, y - 0.022, w + 0.044, h + 0.044)
    return pic


def img_big(s, path, y=1.7, w=9.4):
    x = (W - w) / 2
    pic = s.shapes.add_picture(path, Inches(x), Inches(y), width=Inches(w))
    h = pic.height / 914400
    frame(s, x - 0.022, y - 0.022, w + 0.044, h + 0.044)
    return pic


def bullets(s, x, y, w, items, size=14):
    blocks = []
    for it in items:
        blocks.append({"runs": [("•  ", size, GOLD), (it, size, INK)], "before": 10, "line": 1.32})
    tb(s, x, y, w, 4.6, blocks)


def chips_row(s, y, chips):
    n = len(chips)
    gap = 0.28
    cw = (12.1 - gap * (n - 1)) / n
    for i, (num, label) in enumerate(chips):
        x = 0.62 + i * (cw + gap)
        rect(s, x, y, cw, 1.05, CARD, line=LINE)
        rect(s, x, y, cw, 0.04, GOLD)
        tb(s, x + 0.25, y + 0.14, cw - 0.4, 0.8, [
            {"runs": [(num, 22, GOLD, False, KAI)]},
            {"runs": [(label, 11.5, DIM)], "before": 2},
        ])


# ---------- S1 封面 ----------
s = new_slide()
rows = ["日", "月", "山", "水", "人"]
for i, ch in enumerate(rows):
    tb(s, 10.6, 1.35 + i * 1.06, 2.2, 1.0, [{"runs": [(ch, 44, "26262E", False, KAI)], "align": PP_ALIGN.CENTER}])
tb(s, 0.8, 0.72, 9.2, 0.4, [{"runs": [("第十四届全国大学生数字媒体科技作品及创意竞赛 · 指定命题「科技+创意，讲好中国故事」", 12.5, GOLD)]}])
tb(s, 0.8, 2.35, 9.2, 1.6, [{"runs": [("字·生", 64, INK, False, KAI)]}])
tb(s, 0.8, 3.95, 9.2, 0.7, [{"runs": [("汉字五体演变的粒子交互体验", 20, INK, False, KAI)]}])
rect(s, 0.85, 4.75, 2.2, 0.03, GOLD)
tb(s, 0.8, 5.05, 9.2, 1.3, [
    {"runs": [("一个用数万枚实时粒子讲汉字故事、并能亲手构字书写的交互网页", 13, DIM)]},
    {"runs": [("作品编号 316056 ｜ 作者：牛景飞（北京语言大学）｜ 个人参赛 · 2026", 13, DIM)], "before": 8},
])

# ---------- S2 一句话定位 ----------
s = new_slide()
head(s, "作品定位", "把汉字的三千年，变成能亲手玩的体验")
img_right(s, shot("01开篇"), x=7.9, y=2.15, w=4.6)
tb(s, 0.62, 2.4, 6.9, 1.8, [
    {"runs": [("从甲骨到楷书，任选一个字亲手推动它演变；", 16, INK, False, KAI)], "line": 1.5},
    {"runs": [("写两个部件，合成一个新字；", 16, INK, False, KAI)], "line": 1.5},
    {"runs": [("写下笔迹，粒子接住它。", 16, INK, False, KAI)], "line": 1.5},
])
chips_row(s, 5.15, [
    ("14,873", "全量可推演字库"),
    ("28,776", "历代字形点云"),
    ("8,600", "构字组合"),
    ("47.3MB", "单文件离线运行"),
])
foot(s, "02 / 15")

# ---------- S3 问题与做法 ----------
s = new_slide()
head(s, "为什么做", "汉字教学里，缺一个「能动手」的汉字")
pairs = [
    ("演变只可看", "时间轴由观众掌控：拖动五体，任选一字推演三千年"),
    ("造字原理抽象", "选字或手写两个部件，合成为新字，回看它的来路"),
    ("手写被键盘取代", "粒子实时接住笔迹，离线手写识别给出 Top-3 确认"),
    ("学习缺少反馈", "三关竞猜 + 三档难度，答对给释读、答错给机会"),
]
for i, (q, a) in enumerate(pairs):
    y = 2.25 + i * 1.02
    rect(s, 0.62, y, 3.3, 0.82, CARD, line=LINE)
    tb(s, 0.85, y + 0.2, 2.9, 0.5, [{"runs": [(q, 14, DIM)]}])
    tb(s, 4.2, y + 0.14, 8.6, 0.7, [{"runs": [("→  ", 15, GOLD), (a, 15, INK)], "line": 1.3}])
foot(s, "03 / 15")

# ---------- S4 章节地图 ----------
s = new_slide()
head(s, "作品全景", "十四个章节，一条横向叙事线")
chapters = ["开篇", "甲骨文", "金文", "简帛", "小篆", "隶书", "楷书", "一字千年", "构字", "写字", "认字", "字量", "尾声", "关于"]
for i, name in enumerate(chapters):
    row = 0 if i < 7 else 1
    col = i if row == 0 else i - 7
    per = 7
    gap = 0.22
    cw = (12.1 - gap * (per - 1)) / per
    x = 0.62 + col * (cw + gap)
    y = 2.5 + row * 1.35
    rect(s, x, y, cw, 1.05, CARD, line=LINE)
    tb(s, x, y + 0.13, cw, 0.8, [
        {"runs": [("%02d" % (i + 1), 11, GOLD)], "align": PP_ALIGN.CENTER},
        {"runs": [(name, 14, INK, False, KAI)], "align": PP_ALIGN.CENTER, "before": 2},
    ])
tb(s, 0.62, 5.35, 12, 1.4, [
    {"runs": [("滚轮 / 方向键 / 触摸滑动 / 目录 / 深链接切换章节；", 13.5, DIM)]},
    {"runs": [("六幕演变 → 全量字库 → 构字 → 写字 → 认字 → 数据，构成「看—查—拼—写—测」的完整闭环。", 13.5, DIM)], "before": 6},
])
foot(s, "04 / 15")

# ---------- S5 六幕演变 ----------
s = new_slide()
head(s, "核心体验 ①", "六幕演变：从甲骨到楷书的粒子生长", "手绘矢量笔画与开源古文字字形，实时粒子化呈现")
img_big(s, shot("02甲骨文"), y=2.0, w=8.8)
foot(s, "05 / 15")

# ---------- S6 一字千年 ----------
s = new_slide()
head(s, "核心体验 ②", "一字千年：任选一个字，推演它的三千年")
img_right(s, shot("04一字千年"))
bullets(s, 0.62, 2.45, 6.6, [
    "全量字库 14,873 字、28,776 个历代字形",
    "拖动时间轴：甲骨—金文—简帛—小篆—隶书—楷书",
    "按 214 部首 / 36 笔画检索，支持随机一字",
    "缺哪一阶段就标注哪一阶段：晚出字如实说明",
], size=13.5)
foot(s, "06 / 15")

# ---------- S7 检索与数据管线 ----------
s = new_slide()
head(s, "核心体验 ②", "两万八千个字形，来自一条自建数据管线")
img_right(s, shot("05字库检索"), y=2.0, w=5.0)
tb(s, 0.62, 2.45, 6.4, 1.6, [
    {"runs": [("字形来源：character-evolution-dataset-1bit（MIT）", 13.5, INK)], "line": 1.4},
    {"runs": [("二值化 → Zhang-Suen 骨架化 → 分叉合并 → 八方向编码 → 矢量笔画", 13.5, GOLD)], "before": 8, "line": 1.4},
])
tb(s, 0.62, 4.35, 6.4, 2.2, [
    {"runs": [("•  59 个数据分片按需加载，首屏不等待", 13.5, INK)], "before": 6, "line": 1.3},
    {"runs": [("•  逐字标注可用阶段，字体按 unicode-range 分块加载", 13.5, INK)], "before": 6, "line": 1.3},
    {"runs": [("•  「晚出字」如实提示，不用虚构字形补位", 13.5, INK)], "before": 6, "line": 1.3},
])
foot(s, "07 / 15")

# ---------- S8 构字 ----------
s = new_slide()
head(s, "核心体验 ③", "构字：写两个部件，合成一个新字")
img_right(s, shot("06构字"))
bullets(s, 0.62, 2.45, 6.6, [
    "8,600 组部件组合：精编会意/形声 351 组 + CCD 结构拆解 8,249 组",
    "双入口：从字库选部件，或手写两个部件经识别确认",
    "部首归一：写「水」+「可」，合成「河」",
    "合出的字可「看它三千年」；结构、解读循序展开",
    "拆解数据逐条署名；晚出字与管理边界如实标注",
], size=13)
foot(s, "08 / 15")

# ---------- S9 写字 ----------
s = new_slide()
head(s, "核心体验 ④", "写字：粒子实时接住你的笔迹")
img_right(s, shot("07手写识别"))
bullets(s, 0.62, 2.45, 6.6, [
    "自由书写 / 跟着写（描红·评分）/ 名字图三种模式",
    "离线手写识别：HanScribe（WASM，12,361 字）",
    "合成样本口径 Top-1 97% / Top-3 100%，候选可确认",
    "笔迹逐段化入粒子，与整件作品同一种「数字笔墨」",
], size=13.5)
foot(s, "09 / 15")

# ---------- S10 名字图 ----------
s = new_slide()
head(s, "核心体验 ④", "名字图：把名字变成一片星空", "输入 2–4 个字，生成可保存的粒子星图海报（1920×1080）")
img_big(s, shot("08名字图"), y=2.0, w=8.8)
foot(s, "10 / 15")

# ---------- S11 认字 ----------
s = new_slide()
head(s, "核心体验 ⑤", "认字：三关 × 三档难度，每轮都不一样")
img_right(s, shot("09认字"))
bullets(s, 0.62, 2.45, 6.6, [
    "认形 → 知义 → 辨体，逐层检验理解",
    "简单 / 普通 / 困难：题量与难度随之变化",
    "困难级认形从全量字库随机抽取，干扰项同部首",
    "跨轮不重样：记忆近期用字，池尽自动回退",
    "答对附释读与部首信息，实时总分",
], size=13.5)
foot(s, "11 / 15")

# ---------- S12 字量 ----------
s = new_slide()
head(s, "核心体验 ⑥", "字量：让「汉字越来越多」看得见")
img_right(s, shot("10字量"))
bullets(s, 0.62, 2.45, 6.6, [
    "文献口径：甲骨 4,500 → 康熙 47,035 → 通用规范 8,105",
    "作品实录：各阶段实际收录 28,776 个历代字形",
    "两组数据并置：既有常识，也有作品的真实覆盖",
], size=13.5)
foot(s, "12 / 15")

# ---------- S13 技术实现 ----------
s = new_slide()
head(s, "技术实现", "纯前端、零外部请求、双击即用")
cards = [
    ("粒子引擎", ["Three.js + 自定义着色器", "数万粒子实时演变", "点云 LRU 管理内存"]),
    ("字库管线", ["骨架化为矢量笔画", "59 分片懒加载", "Unihan 部首/笔画索引"]),
    ("字体方案", ["LXGW WenKai 内嵌楷体", "基础档 + 5 个分块", "font-display: swap"]),
    ("离线识别", ["HanScribe WASM", "12,361 字词表", "Top-3 候选确认"]),
    ("交付形态", ["单文件 47.3MB", "字体/数据/模型全内嵌", "断网可用"]),
    ("体验保障", ["桌面 / 平板 / 手机", "无障碍与动效降级", "320px 宽度起可用"]),
]
for i, (t, lines) in enumerate(cards):
    row, col = divmod(i, 3)
    gap = 0.28
    cw = (12.1 - gap * 2) / 3
    x = 0.62 + col * (cw + gap)
    y = 2.3 + row * 2.15
    rect(s, x, y, cw, 1.9, CARD, line=LINE)
    rect(s, x, y, cw, 0.04, GOLD)
    blocks = [{"runs": [(t, 15, GOLD, True)]}]
    for ln in lines:
        blocks.append({"runs": [(ln, 12, INK)], "before": 5, "line": 1.3})
    tb(s, x + 0.25, y + 0.16, cw - 0.45, 1.65, blocks)
foot(s, "13 / 15")

# ---------- S14 原创与合规 ----------
s = new_slide()
head(s, "原创贡献与合规", "学生主导创作，素材链路可追溯")
rect(s, 0.62, 2.2, 6.0, 4.1, CARD, line=LINE)
rect(s, 0.62, 2.2, 6.0, 0.04, GOLD)
tb(s, 0.9, 2.45, 5.5, 3.7, [
    {"runs": [("学生原创贡献", 15, GOLD, True)]},
    {"runs": [("•  选题、叙事结构与交互设计由作者主导", 13, INK)], "before": 8, "line": 1.35},
    {"runs": [("•  逐字撰写释读文案与构字解读", 13, INK)], "before": 5, "line": 1.35},
    {"runs": [("•  粒子视觉、章节节奏与声音设计", 13, INK)], "before": 5, "line": 1.35},
    {"runs": [("•  AI 仅用于代码辅助与文字整理，画面音效非 AI 生成", 13, INK)], "before": 5, "line": 1.35},
])
rect(s, 6.85, 2.2, 5.87, 4.1, CARD, line=LINE)
rect(s, 6.85, 2.2, 5.87, 0.04, GOLD)
tb(s, 7.13, 2.45, 5.4, 3.7, [
    {"runs": [("素材与合规", 15, GOLD, True)]},
    {"runs": [("•  Three.js（MIT）· LXGW WenKai（SIL OFL 1.1）", 13, INK)], "before": 8, "line": 1.35},
    {"runs": [("•  HanScribe（MIT）· 古文字字形数据集（MIT）", 13, INK)], "before": 5, "line": 1.35},
    {"runs": [("•  CCD 拆解表：Wikimedia Commons，界面署名", 13, INK)], "before": 5, "line": 1.35},
    {"runs": [("•  零第三方图片与音频素材；许可声明随作品保留", 13, INK)], "before": 5, "line": 1.35},
])
foot(s, "14 / 15")

# ---------- S15 结语 ----------
s = new_slide()
tb(s, 0, 2.15, W, 1.6, [{"runs": [("字·生", 60, INK, False, KAI)], "align": PP_ALIGN.CENTER}])
rect(s, 5.57, 3.8, 2.2, 0.03, GOLD)
tb(s, 0, 4.1, W, 0.6, [{"runs": [("让沉默的字符，在粒子系统中重新「活」起来", 18, DIM)], "align": PP_ALIGN.CENTER}])
tb(s, 0, 4.85, W, 0.5, [{"runs": [("课堂 · 展馆 · 国际中文教育　——　一套可以即刻打开、离线运行的汉字数字体验", 13, "8F8A80")], "align": PP_ALIGN.CENTER}])
tb(s, 0, 6.1, W, 0.5, [{"runs": [("作品编号 316056 · 牛景飞（北京语言大学）· 2026", 11.5, "6B675E")], "align": PP_ALIGN.CENTER}])

prs.core_properties.title = "字·生 — 汉字五体演变的粒子交互体验（参赛演示文稿）"
prs.core_properties.author = "牛景飞"
prs.core_properties.subject = "第十四届全国大学生数字媒体科技作品及创意竞赛 · 作品编号 316056"
prs.core_properties.comments = "由 tools/build_ppt.py 生成；截图与文案与单文件版作品同步。"

prs.save(OUT)
print("written:", OUT, os.path.getsize(OUT), "bytes,", len(prs.slides._sldIdLst), "slides")
