# DocxExportContract

## 场景 1：从 DraftRecord 构建合同

- Given: 一个有效的 DraftRecord（含 draftId、title、contentHash）
- When: 调用 `buildDocxExportContract({ draft, formatProfileSnapshot })`
- Then: 返回 `DocxExportContract` 对象，包含：
  - exportId、draftId、draftTitle、draftContentHash
  - 可选的 formatProfileId / formatProfileTitle / formatSpecHash
  - documentIntent = 'formal-docx-export'
  - contentLeakagePolicy.includeSourceBodyText = false
  - contractHash 非空

## 场景 2：合同不泄漏来源全文

- Given: 一个构建完成的 `DocxExportContract`
- When: 调用 `containsForbiddenDocxExportLeakage(contract)`
- Then: 返回 false
