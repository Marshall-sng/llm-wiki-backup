import { describe, expect, it } from "vitest"

import { normalizeDraftStorageWhitespace, normalizeWhitespaceHtmlEntities } from "@/lib/text-normalization"

describe("text normalization", () => {
  it("normalizes only whitespace HTML entities", () => {
    expect(normalizeWhitespaceHtmlEntities("&emsp;&#8195;&#x2003;&ensp;&nbsp;")).toBe("\u2003\u2003\u2003\u2002\u00a0")
    expect(normalizeWhitespaceHtmlEntities("&lt;tag&gt; &amp; value")).toBe("&lt;tag&gt; &amp; value")
  })

  it("removes line-leading visual indentation artifacts for draft storage", () => {
    expect(normalizeDraftStorageWhitespace("# 标题\n\n&emsp;&emsp;正文\n甲&emsp;乙")).toBe("# 标题\n\n正文\n甲\u2003乙")
  })
})
