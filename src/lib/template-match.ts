import type { DraftRecord } from "@/stores/draft-store"
import type { TemplateRecord } from "@/stores/template-store"

export type TemplateMatchSeverity = "pass" | "warning" | "missing" | "manual"

export interface TemplateMatchItem {
  id: string
  severity: TemplateMatchSeverity
  title: string
  detail: string
}

export interface TemplateMatchReport {
  templateId: string
  templateTitle: string
  checkedAt: number
  items: TemplateMatchItem[]
  summary: {
    pass: number
    warning: number
    missing: number
    manual: number
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase()
}

function findSectionIndex(content: string, section: string): number {
  const normalizedSection = normalizeText(section.replace(/^第?[一二三四五六七八九十0-9]+[、.．]\s*/, ""))
  if (!normalizedSection) return -1
  const lines = content.split(/\r?\n/)
  let offset = 0
  for (const line of lines) {
    const stripped = line
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^第?[一二三四五六七八九十0-9]+[、.．]\s*/, "")
      .replace(/[：:]\s*.*$/, "")
    const normalizedLine = normalizeText(stripped)
    if (normalizedLine === normalizedSection) return offset
    offset += line.length + 1
  }
  return -1
}

function hasCitationSignal(draft: Pick<DraftRecord, "content" | "references">): boolean {
  if (draft.references.length > 0) return true
  return /\[\d+\]|（\d+）|\(\d+\)|https?:\/\//.test(draft.content)
}

function summarize(items: TemplateMatchItem[]): TemplateMatchReport["summary"] {
  return items.reduce<TemplateMatchReport["summary"]>((acc, item) => {
    acc[item.severity] += 1
    return acc
  }, { pass: 0, warning: 0, missing: 0, manual: 0 })
}

export function buildTemplateMatchReport(
  draft: Pick<DraftRecord, "content" | "references">,
  template: TemplateRecord,
): TemplateMatchReport {
  const items: TemplateMatchItem[] = []
  const content = draft.content || ""

  for (const section of template.requiredSections) {
    if (findSectionIndex(content, section) >= 0) {
      items.push({
        id: `required:${section}`,
        severity: "pass",
        title: `必备章节：${section}`,
        detail: "底稿中已发现该章节或同名内容。",
      })
    } else {
      items.push({
        id: `required:${section}`,
        severity: "missing",
        title: `缺少必备章节：${section}`,
        detail: "底稿中未发现该章节，请在导出前补齐或确认模板是否适用。",
      })
    }
  }

  if (template.sectionOrder.length >= 2) {
    const positions = template.sectionOrder.map((section) => ({ section, index: findSectionIndex(content, section) }))
    const present = positions.filter((item) => item.index >= 0)
    const ordered = present.every((item, index) => index === 0 || present[index - 1].index <= item.index)
    if (present.length < 2) {
      items.push({
        id: "section-order",
        severity: "warning",
        title: "章节顺序未能完整检查",
        detail: "模板设置了章节顺序，但底稿中可识别的章节不足两个。",
      })
    } else if (ordered) {
      items.push({
        id: "section-order",
        severity: "pass",
        title: "章节顺序基本符合",
        detail: "已识别章节的出现顺序与模板一致。",
      })
    } else {
      items.push({
        id: "section-order",
        severity: "warning",
        title: "章节顺序可能不符合模板",
        detail: "已识别章节的出现顺序与模板不一致，请人工确认。",
      })
    }
  }

  if (template.citationPolicy.trim()) {
    if (hasCitationSignal(draft)) {
      items.push({
        id: "citation-policy",
        severity: "pass",
        title: "引用线索存在",
        detail: "底稿存在引用资料或正文引用标记，可继续人工核对引用规则。",
      })
    } else {
      items.push({
        id: "citation-policy",
        severity: "warning",
        title: "缺少引用线索",
        detail: "模板设置了引用规则，但底稿未发现引用资料或常见引用标记。",
      })
    }
  }

  if (template.lengthLimit.trim()) {
    items.push({
      id: "length-limit",
      severity: "manual",
      title: "长度要求需人工确认",
      detail: template.lengthLimit,
    })
  }

  if (template.tone.trim()) {
    items.push({
      id: "tone",
      severity: "manual",
      title: "语气要求需人工确认",
      detail: template.tone,
    })
  }

  return {
    templateId: template.id,
    templateTitle: template.title,
    checkedAt: Date.now(),
    items,
    summary: summarize(items),
  }
}
