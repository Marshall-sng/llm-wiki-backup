# Format Profile Backend Experiment

本目录用于“成品文件 → 格式画像 → 生成约束 → 底稿生成”的后端实验。

## 目标边界

- 支持 DOCX / XLSX / PPTX / PDF 四类成品文件进入同一条解析管线。
- 产出统一的 `FormatProfile`、生成约束、诊断信息和实验底稿。
- 暂不做前端交互、正式模板库 UI、导出、高保真还原或完整 diff guard。

## 目录约定

- `fixtures/`：脱敏样例文件，按格式分组；不要放真实敏感文件。
- `cases/`：实验用例描述。
- `spec/`：Phase 0 锁定的 JSON 协议。
- `scripts/`：实验 runner。
- `outputs/`：运行产物，已被 `.gitignore` 忽略。
- `runtime/format-profile/`：真实本地运行数据，位于仓库根目录下并被 `.gitignore` 忽略。

## Phase 0 验证

Phase 0 不做真实格式解析，只验证协议、样本路径、输出目录和两条底稿路径。

```powershell
node experiments/format-profile/scripts/run-phase0.mjs
```

运行后输出：

```text
runtime/format-profile/outputs/phase0/<caseId>/
├─ profile.json
├─ binding.json
├─ generation-instruction.md
├─ draft-output.md
└─ diagnostics.json

runtime/format-profile/reports/
├─ phase0-report.json
└─ phase0-report.md
```

## Phase 1 验证

Phase 1 接入真实基础探测：

- DOCX / XLSX / PPTX：读取 Office ZIP 中央目录并解析关键 XML。
- PDF：读取字节级对象线索，判断页对象、文本层、图片和扫描倾向。

```powershell
node experiments/format-profile/scripts/run-phase1.mjs
```

运行后输出：

```text
runtime/format-profile/outputs/phase1/<caseId>/
├─ profile.json
├─ binding.json
├─ generation-instruction.md
├─ draft-output.md
└─ diagnostics.json

runtime/format-profile/reports/
├─ phase1-report.json
└─ phase1-report.md
```

Phase 1 仍不做高保真样式还原、LLM 行文风格提炼、前端交互或导出。

## 能力原则

四类格式共用统一画像协议，但允许分格式降级：

- DOCX：优先提取正式文稿结构、样式和行文约束。
- XLSX：优先提取工作表、表头、区域、单元格样式和表格表达模式。
- PPTX：优先提取页面结构、占位符、主题、版式和汇报表达模式。
- PDF：优先提取可解析文本、页面布局和诊断信息；扫描 PDF 不默认承诺高置信度。
