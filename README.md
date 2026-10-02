# 《字·生》——汉字五体演变的粒子交互体验

2026 年第十四届全国大学生数字媒体科技作品及创意竞赛参赛作品。

## 这是什么

一个纯前端交互网页：以约两万枚实时粒子为"数字笔墨"，滚动叙事呈现"日、月、山、水、人"五个象形字从甲骨文、金文、小篆、隶书到楷书的演变；并提供"构字"互动（日+月=明 等）与字量数据可视化。全部画面与音效由代码实时生成，无第三方素材。

## 目录结构

```
CMIT-zisheng/
├─ index.html            作品入口
├─ css/style.css         样式
├─ js/
│  ├─ main.js            叙事控制、构字互动、数据动画
│  ├─ particles.js       粒子引擎（点云采样 / 形态过渡 / 渲染）
│  ├─ glyphs.js          精选 30 字手绘字形 + 扩展字库懒解码
│  ├─ evo-data.js        扩展演变字库数据（708 字，由 tools/build_evo.py 生成）
│  └─ audio.js           程序化音景（Web Audio）
├─ vendor/                 Three.js r160（MIT）、HanScribe 手写识别（MIT）
├─ tools/                 构建脚本（单文件 / 字体子集 / 扩展字库生成）
├─ docs/                 提交材料（说明文档 / AI使用说明 / 视频脚本 / 答辩提纲，含 Word 版）
└─ assets/
   ├─ dev/               开发自检页（glyph_test / test_mobile，不参与提交）
   └─ *.png              开发过程截图（不参与提交）
```

## 本地运行（三选一）

**重要**：直接双击 `index.html` 无法运行——浏览器禁止 `file://` 协议下加载 JS 模块（粒子、按钮都是 JS 生成的，会大片空白）。

1. **最简单：双击 `字生-单文件版.html`** —— 所有代码已内联，无需服务器，任意浏览器直接打开；
2. **源码版一键预览：双击 `启动预览.bat`** —— 自动启动本地服务器并打开浏览器（需已安装 Python 3）；
3. **手动方式**：在项目根目录执行：

```powershell
python -m http.server 8017
```

浏览器打开 `http://127.0.0.1:8017`。

> 说明：单文件版由源码构建生成。修改 `js/`、`css/`、`index.html` 后，执行 `python tools/build_single.py` 重新生成。

## 部署到公网（推荐 Gitee Pages）

1. 注册 gitee.com 账号（需实名认证）；
2. 新建仓库（公开），例如 `zisheng`；
3. 将本项目文件推送到仓库（不包含 assets 开发资料）：
   ```powershell
   cd D:\CMIT-zisheng
   git init
   git add index.html css js vendor docs
   git commit -m "字·生 参赛作品"
   git remote add origin https://gitee.com/你的用户名/zisheng.git
   git push -u origin master
   ```
4. 仓库页 → 服务 → Gitee Pages → 部署（选择 master 分支、强制 HTTPS）；
5. 等待部署完成，获得形如 `https://你的用户名.gitee.io/zisheng` 的链接；
6. 用手机与电脑各打开一次验证。

替代方案：GitHub Pages（`设置 → Pages`）或腾讯云/阿里云静态托管。若校内提供服务器，也可直接部署。

## 提交清单（截止 2026-10-23 23:59:59）

- [ ] 官网 www.cmit.cn 完成团队注册与作品报名（分类：指定命题"科技+创意，讲好中国故事"）
- [ ] 作品介绍文档（docs/01，Word 版直接上传）
- [ ] 演示视频（按 docs/03 录制，2–3 分钟，MP4）
- [ ] 原创性与知识产权声明（按系统模板填写）
- [ ] 人工智能工具使用情况说明（docs/02）
- [ ] 作品本体：部署链接 + 源码压缩包（按《作品材料提交规范》命名）
- [ ] 校内推荐（10/24–10/28 校级初赛，联系学院竞赛负责人）
- [ ] 系统显示"提交成功"并生成作品编号后截图备份

## 交付前检查

- [ ] 所有页面在 Chrome / Edge 正常，手机竖屏正常
- [ ] 四个互动完好：一字千年时间轴、构字合成、写字粒子化、认字答题
- [ ] 文档中作者、学校信息填写完整
- [ ] 移除开发用测试钩子（js/main.js 中 `?dev=`/`#dev=` 分支）与 assets 目录
- [ ] 移除测试钩子后重新生成单文件版：`python tools/build_single.py`
