# EvidenceAnchor / SourceSidecar 统一模型草案

## 背景

前置实验已经分别验证：

- DOCX 可以生成 `paragraph / table / row / cell` anchor。
- TXT 可以生成 `line / char / chunk` anchor，并证明尾部覆盖。
- XLSX 可以生成 `sheet / row / column / cell` anchor。
- PDF.js 可以生成 `page / text_item / line` anchor。

因此下一步不应继续把每种格式做成孤立能力，而应收敛为统一的证据层。

## 核心结论

统一模型不应强行把所有格式压成同一种 selector，而应采用：

```text
统一 EvidenceAnchor 接口
+ 分格式 selector
+ 统一 CoverageSummary
+ 统一 ExtractionQuality
+ 统一 ReviewItem
```

也就是说：

```text
SourceIdentity
→ SourceSidecar
→ EvidenceAnchor[]
→ CoverageSummary
→ ExtractionQuality
→ EvidenceAnchorIndex
→ Retrieval / WikiCandidate / CoverageAudit
```

## 非目标

- 不把 converted markdown 当作唯一事实层。
- 不在本阶段接入生产 pipeline。
- 不在本阶段解决 OCR。
- 不承诺 PDF 表格结构恢复或复杂阅读顺序完全正确。

## 数据对象

### 1. SourceIdentity

用于标识原始材料。

建议字段：

```json
{
  "source_id": "S003",
  "uri": "runtime/format-profile/samples/...",
  "format": "pdf",
  "title": "政务数据共享条例",
  "content_hash": "optional",
  "origin": "local-sample"
}
```

### 2. SourceSidecar

每个原始材料对应一个 sidecar。

```json
{
  "source": {},
  "anchors": [],
  "coverage": {},
  "quality": {},
  "review_items": []
}
```

### 3. EvidenceAnchor

统一字段：

```json
{
  "anchor_id": "S003:pdf:line:p0001:l0001",
  "source_id": "S003",
  "format": "pdf",
  "kind": "pdf.line",
  "selector": {},
  "text": {
    "preview": "中华人民共和国国务院令",
    "text_len": 22,
    "text_hash": "..."
  },
  "confidence": 0.95
}
```

### 4. Selector 分型

#### DOCX

```json
{
  "paragraph_index": 1,
  "block_index": 1,
  "style": "Heading1"
}
```

或：

```json
{
  "table_index": 1,
  "row_index": 2,
  "cell_index": 3
}
```

#### PDF

```json
{
  "page": 1,
  "line_index": 3,
  "bbox_approx": {
    "x_min": 100,
    "y_avg": 700,
    "x_max": 400,
    "height_max": 14
  }
}
```

#### TXT

```json
{
  "chunk_index": 12,
  "char_start": 220000,
  "char_end": 240000,
  "line_start": 9001,
  "line_end": 9800
}
```

#### XLSX

```json
{
  "sheet": "Sheet1",
  "row": 5,
  "column": "B",
  "cell": "B5"
}
```

## CoverageSummary

用于回答“是否覆盖完整”。

不同格式保留不同原生指标，但统一暴露：

```json
{
  "status": "passed | partial | failed",
  "anchor_count": 123,
  "text_units": 4567,
  "native": {}
}
```

示例：

- DOCX：paragraph/table/row/cell/nonempty_cell。
- PDF：pages/pages_with_text/text_items/line_anchors/chars。
- TXT：text_chars/lines/chunks/tail_covered。
- XLSX：sheets/nonempty_rows/nonempty_cells。

## ExtractionQuality

用于决定是否可以进入 Wiki 生成，还是进入 ReviewQueue。

建议字段：

```json
{
  "status": "good | partial | low_confidence | failed",
  "issues": [],
  "quality_score": 0.0
}
```

示例规则：

- PDF pages_failed > 0：partial。
- PDF pages_with_text / pages 太低：low_confidence。
- TXT tail_covered=false：partial。
- XLSX nonempty_cells=0：failed。
- DOCX anchor_count=0：failed。

## ReviewItem

当 coverage 或 quality 不足时生成。

```json
{
  "review_id": "review:S003:pdf:low_text_page",
  "source_id": "S003",
  "severity": "warning",
  "reason": "page has no text anchors",
  "anchor_id": "S003:pdf:page:0003"
}
```

## 与 Wiki / RAG / 长文 / DOCX 导出的关系

### Wiki 生成

Wiki 不应直接依赖 converted markdown，而应依赖：

```text
EvidenceAnchorIndex
→ WikiCandidate
→ CoverageAudit
→ ReviewItem
→ Wiki Page
```

### RAG / 检索

检索结果必须返回：

```text
answer candidate + source_id + anchor_id + selector + preview
```

证据不足时返回 insufficient evidence，而不是让 LLM 猜。

### 长文工程

长文工程的底层能力应复用：

```text
CoverageSummary
EvidencePacket
Anchor Index
ReviewItem
```

独立 LongDocumentProject 只负责 outline、section plan、draft、merge、export 等上层编排。

### DOCX-first Export

导出时可把引用写回：

```text
source_id + anchor_id + selector
```

这样 DOCX 长文不是无来源文本，而是可追溯证据包生成物。

## 当前推荐路线

```text
各格式 extractor
→ SourceSidecar
→ EvidenceAnchorIndex
→ RetrievalSmoke
→ WikiCandidateSkeleton
→ CoverageAudit
→ 主线 pipeline 接入设计
```

下一阶段应先验证统一 sidecar 是否能支撑 query→anchor 精准定位，再进入“第一批企业名单.xlsx”真实 Wiki 闭环。
