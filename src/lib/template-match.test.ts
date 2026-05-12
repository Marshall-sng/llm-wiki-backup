import { afterEach, describe, expect, it, vi } from "vitest"
import { buildTemplateMatchReport } from "./template-match"
import type { DraftRecord } from "@/stores/draft-store"
import type { TemplateRecord } from "@/stores/template-store"

const template: TemplateRecord = {
  id: "template-1",
  title: "正式汇报模板",
  description: "",
  intent: "",
  requiredSections: ["背景", "风险提醒", "结论"],
  sectionOrder: ["一、背景", "二、风险提醒", "三、结论"],
  tone: "正式、审慎",
  lengthLimit: "不少于 2000 字",
  citationPolicy: "保留引用",
  createdAt: 1,
  updatedAt: 2,
}

function makeDraft(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "draft-1",
    title: "Draft",
    content: "# Draft\n\n## 背景\n内容[1]\n\n## 风险提醒\n内容\n\n## 结论\n内容",
    references: [{ title: "Ref", path: "wiki/ref.md" }],
    source: {
      kind: "chat-assistant",
      conversationId: "conv",
      messageId: "msg",
      messageTimestamp: 1,
      contentHash: "hash",
    },
    versions: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("template-match", () => {
  it("passes required sections, order, and citation signal when present", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    const report = buildTemplateMatchReport(makeDraft(), template)

    expect(report.checkedAt).toBe(1_700_000_000_000)
    expect(report.summary.pass).toBeGreaterThanOrEqual(5)
    expect(report.summary.missing).toBe(0)
    expect(report.items.find((item) => item.id === "section-order")?.severity).toBe("pass")
    expect(report.items.find((item) => item.id === "length-limit")?.severity).toBe("manual")
  })

  it("flags missing required sections and weak citation evidence", () => {
    const report = buildTemplateMatchReport(makeDraft({
      content: "# Draft\n\n## 背景\n只有背景，没有结论",
      references: [],
    }), template)

    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "required:风险提醒", severity: "missing" }),
      expect.objectContaining({ id: "required:结论", severity: "missing" }),
      expect.objectContaining({ id: "citation-policy", severity: "warning" }),
    ]))
    expect(report.summary.missing).toBe(2)
  })

  it("warns when recognized sections are out of template order", () => {
    const report = buildTemplateMatchReport(makeDraft({
      content: "## 结论\n先写结论\n\n## 背景\n后写背景\n\n## 风险提醒\n最后风险",
    }), template)

    expect(report.items.find((item) => item.id === "section-order")?.severity).toBe("warning")
  })
})
