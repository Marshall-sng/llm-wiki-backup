/**
 * Normalize whitespace-only HTML entities that LLMs sometimes emit to force
 * visual indentation in Markdown/chat. Keep this intentionally narrow: do not
 * decode general HTML entities such as &lt; or &amp;, because those may be real
 * source text or markdown examples.
 */
export function normalizeWhitespaceHtmlEntities(text: string): string {
  return text
    .replace(/&emsp;|&#8195;|&#x2003;/gi, "\u2003")
    .replace(/&ensp;|&#8194;|&#x2002;/gi, "\u2002")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, "\u00a0")
}

export function normalizeDraftStorageWhitespace(text: string): string {
  return normalizeWhitespaceHtmlEntities(text)
    .replace(/^[\u00a0\u2002\u2003\u3000]+/gm, "")
}
