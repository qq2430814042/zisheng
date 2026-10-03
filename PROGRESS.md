# 《字·生》开发进度与交接说明

> 给未来的自己 / AI 助手：**继续开发前，请先完整阅读本文 + `README.md` + `docs/01-作品说明文档.md`**，再动手改代码。

## 一、当前状态（2026-10-02）

- 作品本体：功能完整，可运行、可演示、可提交
- 章节结构（13 章，横向切换）：开篇 / 甲骨文 / 金文 / 小篆 / 隶书 / 楷书 / 一字千年 / 构字 / 写字 / 认字 / 字量 / 尾声 / 关于
- 交互能力：
  - 横向章节切换：滚轮 / 方向键 / 触屏左右滑 / 界面箭头 / 左侧两级分组目录（开篇/演变/书写/辨字/数据/收束，当前组强制展开）；深链接（#act-seal）与刷新恢复
  - 一字千年：精选 30 字手绘五体（附考据卡）+ **扩展 14,873 字**（甲骨/金文/简帛/小篆/隶书，开源数据集骨架化，59 个分片按需加载；"更多字"网格选择器）；时间轴按每字实际收录阶段动态生成（2—6 阶段），实时连续演化；"看它三千年的全过程"一键自动推演
  - 构字：9 组合成（日月→明、木木→林、人木→休、女子→好、日日→昌、木子→李、月月→朋、人人→从、人子→仔）
  - 写字：自由书写（HanScribe 增强识别 12,361 字、高置信直认/Top-3 点选）/ 跟着写（田字格描红 + 笔画数 + 相似度评分，不校验笔顺）/ 名字图（可保存 1920×1080 海报）；识别或评分后一键"看它三千年"（笔迹原地长成甲骨文→自动推演→字形档案/考据卡）
  - 认字：三关制（认形 10 题自动出题 / 知义 6 题 / 辨体 4 题，总分 20）
  - 尾声：30 字字墙，点任意字看它的三千年；字量数据动画；程序化音效（音高按笔画数）
- 提交材料：`docs/` 下 4 份 Word + md（说明文档 / AI 使用说明 / 视频脚本 / 答辩提纲）
- 其他产物：`字生-单文件版.html`（46.6MB，双击即用，含内嵌字体 + 识别模型 + 全量字库分片，离线可用）、`启动预览.bat`、`fonts/`（OFL 字体与许可）、`tools/`（单文件构建 + 字体子集 + 扩展字库生成）
- 报名状态：已注册，作品编号 **316056**，分类"科技+创意，讲好中国故事"
- 待办：①用户真实手写体验与自检（assets/dev/recog_test.html 已切 HanScribe）②**开始录视频时（事实冻结）**：移除 dev 钩子 → 重建单文件 → 全量自测 ③Gitee Pages 部署 → 提交材料（截止 10/23 23:59，视频/PPT 至少其一，打包文件必填）

## 二、文件结构与职责

```
CMIT-zisheng/
├─ index.html          页面结构（13 个 section + HUD：分级目录/翻页/移动端抽屉/声音）
├─ css/style.css       全部样式；顶部为内嵌 LXGW WenKai 楷体子集（base64 @font-face）
├─ js/
│  ├─ main.js          章节配置 sections[]、横向导航 goTo()、全部互动章节、识别引擎、dev 测试钩子
│  ├─ particles.js     粒子引擎（点云采样 makeClusterCloud/makeDiskCloud、morph、setBlend 连续混合）
│  ├─ glyphs.js        精选 30 字手绘笔画 STROKES、ETY 考据、STROKE_COUNT、RECOG 识别面（192 字）、drawGlyph、扩展字库懒解码（evoAvailable/ensureEvo）、CHARS/LIB/STAGES
│  ├─ evo-index.js     **全量字库索引**（14,874 字符表 + 阶段/字体位图，base64，~68KB，由 build_evo 生成）
│  ├─ evo-data/        **59 个字形数据分片**（每片 256 字，JSON，共 ~31MB，按需 fetch，勿手改）
│  └─ audio.js         程序化音景（环境铺底 + 五声音阶拨弦）
├─ vendor/three.module.js   Three.js r160（MIT）；vendor/hanscribe* 手写识别（MIT）
├─ tools/
│  ├─ build_single.py       生成真·单文件版（内联 JS + CSS + 内嵌字体 + 识别模型）
│  ├─ build_evo.py          从开源数据集生成 js/evo-data.js（含 --sheet 抽样自检图）
│  ├─ ced_reader.py         character-evolution-dataset-1bit 单文件数据集读取器（Python 移植）
│  └─ build_font.py         重新子集化楷体并注入 style.css（需 LXGW WenKai TTF，见脚本内注释）
├─ fonts/                   内嵌字体源文件与 OFL 许可（zisheng-kai.woff2 基础 194KB / zisheng-kai-ext.woff2 扩展 3.0MB / OFL-LXGWWenKai.txt）
├─ 字生-单文件版.html        构建产物，双击运行
├─ 启动预览.bat              启动本地服务器并打开浏览器
├─ docs/                    提交材料（md + docx）
└─ assets/
   ├─ dev/                  开发自检页（glyph_test / test_mobile / recog_test 识别自检）
   └─ *.png                 开发过程截图（不提交）
```

## 三、核心实现速览

- **章节导航**：`main.js` 中 `sections[]` 是唯一数据源；`goTo(i)` 通过 `translateX(-i*100vw)` 横移轨道并调用 `applySection()`。**目录视图为左侧两级**（`NAV_GROUPS` 只存 sections 索引：开篇入口 + 演变/书写/辨字/数据/收束；当前组强制展开、组标题激活态、hover/点击展开、组内 max-height 过渡）；`buildNav()` 只在初始化执行一次，`syncNavActive(sec)` 随切章只切激活态与展开状态（**禁止重建 DOM**）；翻页按钮、移动端两级抽屉均由 JS 生成；支持深链接 hash。**改章节顺序/元素个数会破坏 goTo 索引与 NAV_GROUPS，原则上冻结。** 注意：带 hash 加载会触发浏览器原生锚点滚动，启动时已 `scrollTo(0,0)` 复位。
- **目录让位**：左侧面板留白统一为 `max(calc(6vw + 96px), 196px)`（`.act`/`#timeline`/`#combine`/`#write`/`#quiz`），`.panel` 为 `max(calc(8vw + 96px), 196px)`；`#nav` 定位 `left:24px; top:128px; bottom:128px`（宽 148px，内部滚动，`toc-inner` 垂直居中），与 logo、左下声音按钮互不重叠；窄屏/矮屏媒体查询已同步适配。
- **左文右效（SIDE）**：桌面端 `SIDE=true`——左侧文字面板、右侧粒子效果区；五幕云经 `shiftCloud(pos, +3.0, 0, 0.8)` 右移缩放，单字/文本云 x 取 `0.72W`，手写云在右半区展开。竖屏 `SIDE=false` 回退上文下效（CSS `max-width:760px, max-aspect-ratio:20/21` 与 JS `L.portrait` 对应）。**改章节布局时两者要同步改。**
- **粒子引擎**：字形栅格化 → 像素采样 → 点云（20k 粒子，移动端 9k）；过渡 = 逐点线性插值 + 缓动；点云对应关系按"分簇—角度—半径"排序；连续演化用 `setBlend(keyA, keyB, t, animate)`。
- **字形数据**：`STROKES[字][阶段]` 是 100×100 坐标系的 SVG path 数组；阶段 = oracle/bronze/bamboo-silk/seal/clerical/regular（regular 用内嵌楷体 ZiShengKai / LXGW WenKai 渲染）。精选 30 字为手绘；扩展 14,873 字来自开源数据集 character-evolution-dataset-1bit（MIT），经骨架化 + 方向数字编码存于 `js/evo-data/` 59 个分片（索引 `js/evo-index.js`，位图 + EVO_COUNT），`seqOf(ch)` 按每字真实收录阶段生成时间轴（缺甲骨会显示"暂未见"提示），`ensureEvo(ch)` 异步加载分片并解码（分片 LRU 16），timelineCloudKey 用 LRU（30 朵）回收点云。
- **识别（双引擎）**：主引擎为 **HanScribe**（MIT，WASM，12,361 字词表，模型 7.5MB 本地/单文件内嵌，离线可用）；笔迹 → [x,y,t] → preprocessStrokes → BiLSTM Top-5；高置信（≥0.85 且领先 ≥0.25）直接确认，否则 Top-3 点选。兜底引擎为自研像素特征（196 字 RECOG + 笔画数门控 + 5 角度模板），引擎未就绪时使用。**识别面 ↔ 演变面已基本打通**：识别结果若在扩展字库（14,873 字）内即可"看它三千年"；若字太新（如"的/你"）则诚实提示未收录。
- **写字**：pointer 采集笔迹（速度控宽笔锋）→ 包围盒归一化 → 离屏画布采样成粒子云；多字检测（宽高比 >1.6 提示一次写一个字）；田字格辅助线；撤销/重做（Ctrl+Z / Ctrl+Y）。
- **认字**：三关制 `QUIZ_STAGES`（认形 10 / 知义 6 / 辨体 4）；认形干扰项按模板相似度自动选形近字；知义答对弹考据卡；辨体用 `buildPairCloud` 并排两个字阶。
- **音效**：Web Audio 实时合成，无音频文件；`STAGE_NOTE` 决定每章拨弦音高；`pluckForChar` 按笔画数分配音高。
- **字体内嵌**：LXGW WenKai（SIL OFL 1.1）子集（887 字 → 186KB woff2）base64 内嵌在 style.css 顶部；主程序在构建粒子前 `await document.fonts.load('64px "ZiShengKai"')`，避免用回退字体采样字形。

## 四、运行 / 构建 / 部署

- 本地预览：双击 `启动预览.bat`，或 `python -m http.server 8017` 后访问 http://127.0.0.1:8017
- **直接双击 index.html 不工作**（file:// 禁止加载 JS 模块）；要双击请用 `字生-单文件版.html`
- 修改源码后重建单文件版：`python tools/build_single.py`
- 新增作品用字后重新子集化字体：`python tools/build_font.py`（脚本内含 TTF 下载地址注释；子集字符自动从项目文件收集）
- 部署：Gitee Pages（步骤见 README；每次 push 后需在 Gitee 页面点"更新"）

## 五、设计约定（改代码时请遵守）

1. 全部素材必须程序生成或开源许可（内嵌字体为 OFL）；**禁止引入第三方图片/音频/模型**
2. 新增演变字（两种途径）：①精选级：在 `LIB` 加字 → `STROKES` 补齐 4 个古体路径 → `assets/dev/glyph_test.html` 核对 → 重跑 `build_font.py`；②批量级：把字加入字体子集字符或 RECOG 后重跑 `tools/build_evo.py`（自动从数据集取材，无需手绘）
3. 新增识别字：只改 `glyphs.js` 的 `RECOG_EXTRA` → 重跑 `build_font.py`（模板自动生成，无需手绘）
4. 新增章节：`sections[]` 加配置 + `index.html` 加 `<section>` + `applySection()` 加分支；目录/位置指示自动适配
5. 配色沿用每章一套（骨白/铜金/青玉/素墨/月白/暖金）；字体：楷体语境用内嵌 ZiShengKai，界面正文用系统雅黑
6. 文案风格：文化表述求稳（考据按《说文》体系保守处理），字量数据引用公开来源，不夸大（识别不宣传"写什么都认得"）

## 六、自测方法（无头截图，不影响用户浏览器）

```powershell
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& $edge --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader `
  --window-size=1536,900 --virtual-time-budget=15000 `
  --screenshot="D:\CMIT-zisheng\assets\test.png" `
  "http://127.0.0.1:8017/index.html?v=99&dev=go:5"
```

- `?dev=go:<索引>`：直接跳章节（0=开篇 … 12=关于）
- `?dev=solo:<章节>:<参数>`：隐藏其他章节测试单个互动（timeline:木:250 / timeline:我:500 / timeline:互:0 单阶段字 / timeline:grid 字库网格 / combine:木子:go / write:go / write:hsgo / write:name / quiz:go …）
- 注意：无头模式虚拟时间不推进 morph，截图显示的是过渡起点状态，属测试环境限制；如需"瞬移"检查终态用 `solo:` 模式（内部包了 setCloud 快照）
- 识别自检页：`assets/dev/recog_test.html`（抽样 20 字，字符集/引擎与作品一致）
- 移动端压测：`assets/dev/test_mobile.html`（iframe 390×780 三章并排）

## 七、已知问题与注意事项

- dev 测试钩子（`?dev=`/`#dev=`）**开始录视频前必须移除**，之后重建单文件版
- 楷体已内嵌（LXGW WenKai OFL 子集），全平台一致；修改作品用字后需重跑 `tools/build_font.py`
- 竖屏小屏下各面板高度较紧张，已做媒体查询压缩；如遇遮挡优先调 `@media (max-height: 720px)` 段
- GitHub 推送偶发被网络重置（Gitee 稳定）；以 Gitee 为主副本；单文件版 46.6MB（含全量分片+双档字体+识别模型），首开需数秒解析，源码版首屏轻量（分片按需 fetch）
- 无头测试/答辩演示注意：字体加载门最多等 3 秒，正常设备瞬时完成

## 八、变更日志

- **2026-10-01**：初版（五幕演变 + 构字 + 字量 + 音效）；扩展（12 字库 + 一字千年时间轴 + 写字 + 认字）；体验升级（横向章节切换 + 命名目录 + 进度条 + 翻页按钮 + 单文件版 + 启动脚本）；左文右效改版；目录/导航重构（刻度轴 + 位置指示 + 真锚点/aria/深链接 + 移动端抽屉 + 首访引导 + 短屏折叠）
- **2026-10-01（第一批）**：加载开场；关于页创作阐述/参考资料/致谢；写字笔锋 + 撤销/重做 + 反馈；prefers-reduced-motion；真·单文件修复；1080P 兜底封面
- **2026-10-01（第二批）**：演变库扩到 30 字（含四体手绘 + 自检页）；手写闭环（识别三档 + 跟着写评分 + 考据卡 + 联动一字千年）；修复 `hidden` 被 `display:flex` 覆盖的坑
- **2026-10-01（第三批）**：名字图（生成 + 保存海报）；音高按笔画数映射；认字扩题
- **2026-10-01（第四批）**：统一副本并推送双远端；笔迹原地长成甲骨文；认字三关制；修复局部变量 `stage` 遮蔽全局粒子的命名冲突
- **2026-10-02（第五批）**：字体内嵌（OFL 子集 + 字体就绪门）；写字四项（方区+田字格 / 多字检测 / 笔顺免责与口诀 / 名字图库外提示）；尾声字墙可点击；一字千年一键三千年；文案与文档全量同步；识别自检页上线
- **2026-10-02（第六批）**：**识别引擎 v2**（双特征 + 领先余量 + 诚实拒识）；识别面扩至 192 字（3 角度增强）；识别成功三种走向；构字扩充至 9 组（木子→李、月月→朋、人人→从、人子→仔）；自检页改抽样 20 字
- **2026-10-02（第七批·路线二）**：**接入 HanScribe 增强识别引擎**——WASM 推理 + 12,361 字词表模型（7.5MB）；用笔顺中轴数据做客观评测：**Top-1 97% / Top-3 100%**（100 样本，y 轴方向修正后）；应用集成（懒加载、vendor 本地文件、单文件 base64 内嵌、Top-3 点选、高置信直认），源码版与单文件版均已实测；自检页切换至 HanScribe；单文件增至 11.6MB
- **2026-10-03（第十批·目录左置两级）**：章节目录从“右侧 13 项平铺”重构为“左侧 5 大类两级目录”（开篇入口 + 演变/书写/辨字/数据/收束；当前组强制展开、组标题激活态、hover/点击展开、内部滚动防溢出）；面板左留白统一让位；移动端抽屉两级化（默认只展开当前组）；修复抽屉横向滚动条；13 章状态机 DOM 校验（激活项/展开组/位置指示）与 1280/1536/1920 重叠检查、矮屏与竖屏验收通过
- **2026-10-02（第九批·全量字库）**：**演变字库 708 → 14,873 字全量**——索引 + 59 分片懒加载架构（`js/evo-index.js` + `js/evo-data/`，~31MB，按需 fetch，首屏不变）；双档内嵌字体（基础 194KB + 扩展 3.0MB unicode-range 按需加载）；字库网格搜索 + 分页 + 生僻字标注；**写字识别/名字图联动扩展到全量库**（识别出任意库内字即可"看它三千年"，此前仅精选 30 字）；修复跟着写评分卡空白（多角度模板**数组**误传给单个模板，识别引擎 v3 起遗留）；扩展字体在生成粒子云前 `document.fonts.load` 预加载（画布不自动重绘）；分片加载失败防重试死循环；单文件版 46.6MB 离线实测通过
- **2026-10-02（第八批·字库突围）**：**演变字库 30 → 708 字**——引入开源古文字数据集 character-evolution-dataset-1bit（MIT，26.3 万张历代字形图），自研 Python 管线（Zhang-Suen 骨架化 → 分叉合并 → 八方向数字编码）生成 `js/evo-data.js`（2.3MB，含甲骨 265 / 金文 455 / 简帛 529 / 小篆 707 / 隶书 622 阶段）；时间轴改为按字动态阶段序列（新增简帛阶段；缺甲骨显示"暂未见——有的字出生得晚"）；新增"更多字"708 字网格选择器；懒解码 + 点云 LRU 回收；识别结果直接跳扩展字演变；关于页/说明文档补充来源与 MIT 致谢；单文件增至 13.9MB（离线实测通过）
