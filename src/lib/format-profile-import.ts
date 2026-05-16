import type { FormatProfileProbe } from "@/commands/fs"
import { buildFormatProfileFromExtractedText, type FormatProfileRecord } from "@/lib/format-profile"

export interface FormatProfileImportDeps {
  readFile: (path: string) => Promise<string>
  probeFormatProfile: (path: string) => Promise<FormatProfileProbe | null>
}

export async function importFormatProfileFromPath(
  sourcePath: string,
  deps: FormatProfileImportDeps,
): Promise<FormatProfileRecord> {
  let readError: string | null = null
  let probeError: string | null = null

  const [extractedText, probe] = await Promise.all([
    deps.readFile(sourcePath).catch((err) => {
      readError = err instanceof Error ? err.message : String(err)
      return ""
    }),
    deps.probeFormatProfile(sourcePath).catch((err) => {
      probeError = err instanceof Error ? err.message : String(err)
      return null
    }),
  ])

  if (!extractedText.trim() && !probe) {
    throw new Error(readError || probeError || "无法读取该文件的文本或格式信息，请确认文件未加密、未被占用，或另存为未加密 DOCX 后重试。")
  }

  return buildFormatProfileFromExtractedText({
    sourcePath,
    extractedText,
    probe,
    probeError,
  })
}
