# Phase 1C：PDF text-span / block anchor 方案实验计划

## 背景

Phase 1B 已经证明：

- DOCX / TXT / XLSX 可以稳定生成结构化 EvidenceAnchor sidecar。
- PDF 当前只能做到 page-anchor skeleton 与抽取质量诊断。
- OCR 暂不纳入当前阶段。

因此 Phase 1C 的目标不是“证明 PDF 能被摘要”，而是找出一个足以支撑 Wiki 精准定位、精准检索和证据回溯的 PDF 文本抽取方案。

## 要解决的问题

1. 能否从文本型 PDF 中抽出 page + text item + 坐标/尺寸/字体等定位信息？
2. 能否把 text item 合并为可用于检索和引用的 line/block/span anchor？
3. 能否识别抽取失败或低质量 PDF，并进入 `needs-review / insufficient-extraction`？
4. 哪个方案最适合当前 TypeScript/Tauri 架构？

## 明确不做

- 暂不做 OCR。
- 暂不接入生产 pipeline。
- 暂不修改根目录 `package.json` / `package-lock.json`。
- 暂不追求复杂表格结构恢复；表格恢复作为后续增强。

## 候选方案

### A. PDF.js / pdfjs-dist

依据：

- 官方 API `getDocument` 是加载 PDF 的主入口。
- `PDFPageProxy.getTextContent()` 返回页面 TextContent。
- `getViewport()` 返回页面尺寸与渲染变换信息。

参考：

- https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
- https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html

优点：

- 与当前前端/TypeScript 技术栈最兼容。
- 可在浏览器/Tauri 环境使用。
- `getTextContent()` 可以得到 text items，通常包含字符串、transform、width、height、fontName 等。
- 适合直接生成 `pdf.text_item`、`pdf.line`、`pdf.block` anchor。

风险：

- 对加密、字体编码异常、复杂版式仍可能失败。
- 需要设计 text item 到 line/block 的合并启发式。
- Node 环境与浏览器环境配置可能不同。

### B. pypdf

依据：

- 官方文档支持 `extract_text()`。
- 支持 visitor 函数，可获得文本片段、矩阵、字体信息。
- 官方文档明确 PDF 抽取困难，包括缺少语义层、表格难、位置可能复杂。

参考：

- https://pypdf.readthedocs.io/en/stable/user/extract-text.html

优点：

- 纯 Python，易做研究脚本。
- 可做 fallback 或诊断工具。

风险：

- 与当前 TypeScript/Tauri 主栈不一致。
- 官方文档也提示复杂文档中坐标可能难以确定。
- 如果用于生产，需要增加 Python 运行时/打包复杂度。

### C. PyMuPDF

依据：

- 官方文档支持从页面提取 blocks、words 等多种层级文本。

参考：

- https://pymupdf.readthedocs.io/en/latest/app1.html

优点：

- 工程上常用于高质量 PDF 文本/块/词抽取。
- block/word 层次与 EvidenceAnchor 很贴合。

风险：

- 许可证和分发模式需要单独确认。
- Python/native 依赖会增加桌面应用打包复杂度。

### D. pdfminer.six / pdfplumber

依据：

- pdfminer.six 官方文档支持高层文本抽取。
- pdfplumber README 明确面向 char、rect、line、table 等详细对象。

参考：

- https://pdfminersix.readthedocs.io/en/latest/tutorial/highlevel.html
- https://github.com/jsvine/pdfplumber

优点：

- 适合研究与质量对比。
- pdfplumber 对 char/line/table 诊断友好。

风险：

- Python 依赖，不适合直接进入当前 TS/Tauri 主链路。
- 性能和打包需要验证。

## 本轮推荐优先实验

优先实验 PDF.js，因为它最可能成为当前项目的主方案。

实验样本：

- S003：政务数据共享条例，text-like。
- S004：政务数据目录治理工作 Q&A，text-like。
- S036：数据要素流通标准化白皮书，Phase 1B 判定 insufficient-extraction。
- S001：易经杂说，Phase 1B 判定 insufficient-extraction。

## 实验步骤

1. 在 `.tools/pdfjs-eval/` 隔离安装 `pdfjs-dist`，避免修改根目录依赖。
2. 写一个 PDF.js probe：
   - 加载 PDF；
   - 遍历页面；
   - 调用 `getTextContent()`；
   - 记录 text item 数、字符数、transform、width、height；
   - 按 y 坐标聚合 line anchor；
   - 按页面输出 coverage summary。
3. 对 S003 / S004 / S036 / S001 执行。
4. 生成：
   - `pdfjs-text-anchor-probe.json`
   - `pdf-text-anchor-solution-results.md`
5. 判断 PDF.js 是否可作为主路线，或是否需要 PyMuPDF/pdfplumber 对照实验。

## 成功标准

对 text-like PDF：

- 能抽出 page-level text items。
- text items 包含可定位 transform 或等价位置信息。
- 能合并生成 line anchor。
- 每页有字符数、item 数、line 数、失败原因。

对失败 PDF：

- 明确输出失败类型。
- 不得静默当作完整抽取成功。

## 失败判据

- 无法从 S003/S004 抽出文本 item。
- text item 没有可用位置信息。
- 运行需要修改生产依赖或主线代码。
- 加密/异常 PDF 无法被标记为 needs-review。

## 预期判断

如果 PDF.js 能在 S003/S004 上产出 text item + line anchor，并能在 S036/S001 上稳定给出失败/低质量诊断，则推荐：

```text
主方案：PDF.js text item / line anchor
增强方案：后续再用 PyMuPDF/pdfplumber 做质量对照
OCR：继续后置
```

如果 PDF.js 对中文 PDF 的字符质量、坐标质量或失败诊断不足，则追加 PyMuPDF/pdfplumber 对照实验。
