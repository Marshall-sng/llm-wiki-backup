import { describe, expect, it } from "vitest"
import {
  detectDraftEditIntent,
  evaluateDraftDiffGuard,
} from "./draft-diff-guard"

describe("detectDraftEditIntent", () => {
  it.each([
    "只改标题",
    "只修改风险提醒，正文不要动",
    "不要缩短正文",
    "保留原结构",
    "keep the body unchanged",
    "only update the title",
  ])("detects local-edit instructions: %s", (instruction) => {
    expect(detectDraftEditIntent(instruction)).toBe("local-edit")
  })

  it.each([
    "改成正式汇报口吻",
    "扩写成一份完整报告",
    "",
  ])("keeps general instructions as general-edit: %s", (instruction) => {
    expect(detectDraftEditIntent(instruction)).toBe("general-edit")
  })
})

describe("evaluateDraftDiffGuard", () => {
  it("does not warn for general edits even when the result changes a lot", () => {
    const result = evaluateDraftDiffGuard({
      parentContent: "第一行\n第二行\n第三行\n第四行",
      candidateContent: "完全不同的新稿",
      instruction: "改成正式汇报口吻",
    })

    expect(result.intent).toBe("general-edit")
    expect(result.shouldWarn).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it("does not warn for a small local edit", () => {
    const parentContent = [
      "标题",
      "第一段",
      "第二段",
      "第三段",
      "第四段",
      "第五段",
      "第六段",
      "第七段",
      "第八段",
      "第九段",
    ].join("\n")
    const candidateContent = `${parentContent}\n补充一句`

    const result = evaluateDraftDiffGuard({
      parentContent,
      candidateContent,
      instruction: "只修改风险提醒",
    })

    expect(result.intent).toBe("local-edit")
    expect(result.shouldWarn).toBe(false)
  })

  it("warns when a local edit has a high changed ratio", () => {
    const result = evaluateDraftDiffGuard({
      parentContent: "a\nb\nc\nd",
      candidateContent: "x\ny\nz",
      instruction: "只改标题，正文不要动",
    })

    expect(result.shouldWarn).toBe(true)
    expect(result.reasons.join("\n")).toContain("变化比例")
  })

  it("warns when removals dominate additions", () => {
    const result = evaluateDraftDiffGuard({
      parentContent: "a\nb\nc\nd\ne\nf\ng\nh\ni\nj",
      candidateContent: "a\nb\n新增",
      instruction: "只修改风险提醒",
    })

    expect(result.shouldWarn).toBe(true)
    expect(result.reasons.join("\n")).toContain("删除行明显多于新增行")
  })

  it("warns when the result is clearly shorter than the parent draft", () => {
    const result = evaluateDraftDiffGuard({
      parentContent: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
      candidateContent: "1\n2\n3\n4\n5\n6",
      instruction: "正文不要缩短",
    })

    expect(result.shouldWarn).toBe(true)
    expect(result.reasons.join("\n")).toContain("过度缩短")
  })

  it("warns for local edits when comparison is too large", () => {
    const result = evaluateDraftDiffGuard({
      parentContent: "a\nb\nc",
      candidateContent: "a\nb\nc",
      instruction: "保留原结构，只改标题",
      maxLines: 5,
    })

    expect(result.shouldWarn).toBe(true)
    expect(result.comparison.tooLarge).toBe(true)
    expect(result.reasons.join("\n")).toContain("内容较长")
  })
})
