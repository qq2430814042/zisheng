# 《字·生》开发进度与交接说明

> 给未来的自己 / AI 助手：**继续开发前，请先完整阅读本文 + `README.md` + `docs/01-作品说明文档.md`**，再动手改代码。

## 一、当前状态（2026-10-01）

- 作品本体：功能完整，可运行、可演示、可提交
- 章节结构（12 章，横向切换）：开篇 / 甲骨文 / 金文 / 小篆 / 隶书 / 楷书 / 一字千年 / 构字 / 写字 / 认字 / 字量 / 关于
- 交互能力：
  - 横向章节切换：滚轮 / 方向键 / 触屏左右滑 / 界面左右箭头 / 右侧目录点击
  - 一字千年：12 个基础象形字 × 五体，拖动时间轴实时连续演化
  - 构字：日+月=明、木+木=林、人+木=休、女+子=好、日+日=昌
  - 写字：手写任意内容 → 粒子化接住笔迹 → 融入星河
  - 认字：8 题甲骨文竞猜，答对演变为楷书并附释义
  - 字量数据动画、程序化音效开关
- 提交材料：`docs/` 下 4 份 Word（说明文档 / AI 使用说明 / 视频脚本 / 答辩提纲）
- 其他产物：`字生-单文件版.html`（双击即用）、`启动预览.bat`
- 报名状态：已注册，作品编号 **316056**，分类"科技+创意，讲好中国故事"
- 待办：①录 3 分钟演示视频 ②Gitee Pages 部署 ③**10月23日 23:59 前提交** ④交付前移除 dev 测试钩子并重建单文件版

## 二、文件结构与职责

```
CMIT-zisheng/
├─ index.html          页面结构（12 个 section + HUD：目录/进度条/翻页/声音）
├─ css/style.css       全部样式（横向轨道、章节面板、目录、进度条）
├─ js/
│  ├─ main.js          章节配置 sections[]、横向导航 goTo()、五个互动章节、数据动画、dev 测试钩子
│  ├─ particles.js     粒子引擎（点云采样 makeClusterCloud/makeDiskCloud、morph、setBlend 连续混合）
│  ├─ glyphs.js        12 字 × 4 古体手绘笔画 STROKES、drawGlyph、CHARS/LIB/STAGES
│  └─ audio.js         程序化音景（环境铺底 + 五声音阶拨弦）
├─ vendor/three.module.js   Three.js r160（MIT）
├─ tools/build_single.py    生成单文件版（内联全部 JS）
├─ 字生-单文件版.html        构建产物，双击运行
├─ 启动预览.bat              启动本地服务器并打开浏览器
├─ docs/                    提交材料（md + docx）
└─ assets/
   ├─ dev/                  开发自检页（glyph_test.html / test_mobile.html）
   └─ *.png                 开发过程截图（不提交）
```

## 三、核心实现速览

- **章节导航**：`main.js` 中 `sections[]` 是唯一数据源（id/label/cloud/color/bg/era/opacity）；`goTo(i)` 通过 `translateX(-i*100vw)` 横移轨道，并调用 `applySection()` 切换粒子云与配色。目录（TOC）、进度条、翻页按钮全部由 JS 生成/更新。
- **左文右效（SIDE）**：桌面端 `SIDE=true`——左侧文字面板、右侧粒子效果区；五幕云经 `shiftCloud(pos, +3.0, 0, 0.8)` 右移缩放，单字/文本云 x 取 `0.72W`，手写云在右半区展开。竖屏 `SIDE=false` 自动回退为上文下效（CSS 媒体查询 `max-width:760px, max-aspect-ratio:20/21` 与 JS 的 `L.portrait` 对应）。**改章节布局时两者要同步改。**
- **粒子引擎**：字形栅格化 → 像素采样 → 点云（20k 粒子，移动端 9k）；形态过渡 = 逐点线性插值 + 缓动；点云对应关系按"分簇—角度—半径"排序。连续演化用 `setBlend(keyA, keyB, t, animate)`。
- **字形数据**：`STROKES[字][阶段]` 是 100×100 坐标系的 SVG path 数组；阶段 = oracle/bronze/seal/clerical/regular（regular 用系统楷体渲染）。
- **写字**：pointer 事件采集笔迹 → 包围盒归一化 → 画到 1600×900 离屏画布 → 采样成粒子云。
- **认字**：`QUIZ[]` 题目数据；答对后 `setCloud(quiz:<字>:regular)` 演变为楷书。
- **音效**：Web Audio 实时合成，无音频文件；`STAGE_NOTE` 决定每章拨弦音高。

## 四、运行 / 构建 / 部署

- 本地预览：双击 `启动预览.bat`，或 `python -m http.server 8017` 后访问 http://127.0.0.1:8017
- **直接双击 index.html 不工作**（file:// 禁止加载 JS 模块）；要双击请用 `字生-单文件版.html`
- 修改源码后重建单文件版：`python tools/build_single.py`
- 部署：Gitee Pages（步骤见 README）

## 五、设计约定（改代码时请遵守）

1. 全部素材必须程序生成，**禁止引入第三方图片/音频/模型**（版权风险）
2. 新增古体字：在 `LIB` 加字 → `STROKES` 补齐 4 个古体路径 → 打开 `assets/dev/glyph_test.html` 核对字形 → 需要进五幕时再调 `actCells()`
3. 新增章节：`sections[]` 加配置 + `index.html` 加 `<section>` + `applySection()` 加分支；目录/进度条自动适配
4. 配色沿用每章一套（骨白/铜金/青玉/素墨/月白/暖金），字体用系统楷体+雅黑
5. 文案风格：文化表述求稳，字量数据引用公开来源，不夸大

## 六、自测方法（无头截图，不影响用户浏览器）

```powershell
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& $edge --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader `
  --window-size=1536,900 --virtual-time-budget=15000 `
  --screenshot="D:\CMIT-zisheng\assets\test.png" `
  "http://127.0.0.1:8017/index.html?v=99&dev=go:5"
```

- `?dev=go:<索引>`：直接跳章节（0=开篇 … 11=关于）
- `?dev=solo:<章节>:<参数>`：隐藏其他章节测试单个互动（timeline:木:250 / combine:日月:go / write:go / quiz:go）
- 注意：无头模式虚拟时间不推进 morph，截图显示的是过渡起点状态，属测试环境限制

## 七、已知问题与注意事项

- dev 测试钩子（`?dev=`/`#dev=`）**交付前必须移除**，之后重建单文件版
- 楷体依赖系统字体：Windows/macOS 正常显示，Linux 可能回退
- 竖屏小屏下各面板高度较紧张，已做媒体查询压缩；如遇遮挡优先调 `@media (max-height: 720px)` 段
- 音频默认关闭，需用户点击开启（浏览器自动播放策略）

## 八、变更日志

- **2026-10-01**：初版（五幕演变 + 构字 + 字量 + 音效）；扩展（12 字库 + 一字千年时间轴 + 写字 + 认字）；体验升级（横向章节切换 + 命名目录 + 进度条 + 翻页按钮 + 单文件版 + 启动脚本）；**左文右效改版**（桌面端所有章节改为左侧文字面板、右侧粒子效果区，写字/时间轴/构字/认字效果不再被遮挡；五幕字阵右移缩放至右半区；竖屏自动回退为上文下效）
