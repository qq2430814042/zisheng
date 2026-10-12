# CCD 汉字拆解表（数据来源说明）

- 文件：`ccd.json`（21,169 条汉字二元拆解记录）
- 来源：Wikimedia Commons 项目页 "Commons:Chinese characters decomposition" 整理表
  - https://commons.wikimedia.org/wiki/Commons:Chinese_characters_decomposition
- 获取渠道：npm 包 `chinese-characters-decomposition`（MIT License，作者 Leon Silicon）
  - https://github.com/leonsilicon/chinese-characters-decomposition
- 字段：component / strokes / compositionType / leftComponent / leftStrokes /
  rightComponent / rightStrokes / signature / notes / section

## 本作品的使用方式

仅将拆解关系（哪两个部件构成哪个字、布局类型）作为**语言学事实**使用；
`tools/build_combo.py` 在生成时：
- 剔除标注不确定（notes 含 ? * #）的条目；
- 只保留部件与结果字均在《字·生》古文字字形库（14,873 字，MIT）内的条目；
- 与作品精编的会意/形声条目（自写解读）合并，精编条目优先；
- 拆解类条目在界面中以"拆解"标注，并署名数据来源。

数据页本身按 Wikimedia Commons 项目条款（CC BY-SA 4.0）提供；npm 封装声明 MIT。
本作品对数据的使用限于事实性拆解信息，使用处均已署名。
