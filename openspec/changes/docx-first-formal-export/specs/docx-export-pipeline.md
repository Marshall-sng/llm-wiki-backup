# DOCX 导出管线

## 场景 1：完整导出流程

- Given: 底稿 + 格式画像快照
- When: 调用 `writeDocxExport(input)`
- Then: 返回以下全部内容：
  - contract（DocxExportContract）
  - intermediate（DocxIntermediateDocument）
  - adapterResult（DocxAdapterResultLike）
  - fidelityDiagnostics（DocxFidelityDiagnosticsReport）
  - review（DocxMatchReview）
  - record（DocxExportRecord）
  - bytes（Uint8Array，可打开 DOCX）

## 场景 2：审查不通过

- Given: 底稿缺少合同要求的必要章节
- When: 执行 `reviewDocxExport`
- Then: review.verdict = "fail"
- And: review.diagnostics 包含缺失章节的描述

## 场景 3：来源泄漏检测

- Given: adapter 错误地将来源正文写入 DOCX
- When: 执行 export pipeline
- Then: fidelityDiagnostics 或 review 检测到泄漏并标记

## 场景 4：保真度诊断

- Given: 来源样式事实（StyleFacts）+ 导出 DOCX bytes
- When: 调用 `buildDocxFidelityDiagnostics`
- Then: 返回报告含 restored / partial / missing / unverified 四档分类
