import { beforeEach, describe, expect, it, vi } from "vitest"

const fsMock = vi.hoisted(() => {
  let now = 1_000
  const files = new Map<string, { content: string; mtime: number }>()
  return {
    files,
    readFile: vi.fn(async (path: string) => {
      const file = files.get(path)
      if (!file) throw new Error(`missing ${path}`)
      return file.content
    }),
    writeFile: vi.fn(async (path: string, contents: string) => {
      files.set(path, { content: contents, mtime: ++now })
    }),
    createDirectory: vi.fn(async () => {}),
    listDirectory: vi.fn(async () => []),
    fileExists: vi.fn(async (path: string) => files.has(path)),
    fileModifiedMs: vi.fn(async (path: string) => files.get(path)?.mtime ?? null),
    convertWithMarkitdown: vi.fn(async () => ({
      ok: true,
      markdown: "MARKITDOWN BODY",
      error: null,
      timedOut: false,
    })),
    extractXlsxSidecarPayload: vi.fn(async (_path: string): Promise<unknown> => {
      throw new Error("extractXlsxSidecarPayload should stay disabled by default")
    }),
    reset: () => {
      now = 1_000
      files.clear()
    },
    touch: (path: string, content: string, mtime: number) => {
      files.set(path, { content, mtime })
      now = Math.max(now, mtime)
    },
  }
})

const llmMock = vi.hoisted(() => ({
  calls: [] as Array<Array<{ role: string; content: string }>>,
  streamChat: vi.fn(async (_cfg, messages, callbacks) => {
    llmMock.calls.push(messages)
    const response = llmMock.calls.length === 1
      ? "analysis from converted markdown"
      : [
          "---FILE: wiki/sources/report.md---",
          "---",
          "type: source",
          "title: Report",
          'sources: ["report.pdf"]',
          "---",
          "",
          "# Report",
          "",
          "generated summary",
          "---END FILE---",
        ].join("\n")
    callbacks.onToken(response)
    callbacks.onDone()
  }),
  reset: () => {
    llmMock.calls.length = 0
  },
}))

vi.mock("@/commands/fs", () => ({
  readFile: fsMock.readFile,
  writeFile: fsMock.writeFile,
  createDirectory: fsMock.createDirectory,
  listDirectory: fsMock.listDirectory,
  fileExists: fsMock.fileExists,
  fileModifiedMs: fsMock.fileModifiedMs,
  convertWithMarkitdown: fsMock.convertWithMarkitdown,
  extractXlsxSidecarPayload: fsMock.extractXlsxSidecarPayload,
}))

vi.mock("./llm-client", () => ({
  streamChat: llmMock.streamChat,
}))

vi.mock("@/lib/extract-source-images", () => ({
  extractAndSaveSourceImages: vi.fn(async () => []),
  buildImageMarkdownSection: vi.fn(() => ""),
}))

import { autoIngest, executeIngestWrites } from "./ingest"
import { useActivityStore } from "@/stores/activity-store"
import { useChatStore } from "@/stores/chat-store"
import { useReviewStore } from "@/stores/review-store"
import { useWikiStore } from "@/stores/wiki-store"

const PROJECT = "D:/project"
const RAW = "D:/project/raw/sources/report.pdf"

function unsupportedXlsxPayload(path: string) {
  return {
    path,
    fileName: "first-batch.xlsx",
    sizeBytes: 100,
    modifiedMs: 123,
    sha256: "a".repeat(64),
    sheets: [{
      name: "plain",
      rowCount: 2,
      columnCount: 2,
      cells: [
        { sheet: "plain", row: 1, column: 1, address: "A1", value: "name" },
        { sheet: "plain", row: 1, column: 2, address: "B1", value: "note" },
        { sheet: "plain", row: 2, column: 1, address: "A2", value: "not a company list" },
        { sheet: "plain", row: 2, column: 2, address: "B2", value: "no project column" },
      ],
    }],
  }
}

function supportedXlsxPayload(path: string) {
  return {
    path,
    fileName: "first-batch.xlsx",
    sizeBytes: 100,
    modifiedMs: 123,
    sha256: "b".repeat(64),
    sheets: [{
      name: "申报名单",
      rowCount: 2,
      columnCount: 6,
      cells: [
        { sheet: "申报名单", row: 1, column: 1, address: "A1", value: "序号" },
        { sheet: "申报名单", row: 1, column: 2, address: "B1", value: "企业名称" },
        { sheet: "申报名单", row: 1, column: 3, address: "C1", value: "项目名称" },
        { sheet: "申报名单", row: 1, column: 4, address: "D1", value: "联系人" },
        { sheet: "申报名单", row: 1, column: 5, address: "E1", value: "电话" },
        { sheet: "申报名单", row: 1, column: 6, address: "F1", value: "行业" },
        { sheet: "申报名单", row: 2, column: 1, address: "A2", value: "1" },
        { sheet: "申报名单", row: 2, column: 2, address: "B2", value: "杭州数源科技有限公司" },
        { sheet: "申报名单", row: 2, column: 3, address: "C2", value: "数据资产登记" },
        { sheet: "申报名单", row: 2, column: 4, address: "D2", value: "联系人1" },
        { sheet: "申报名单", row: 2, column: 5, address: "E2", value: "13800000001" },
        { sheet: "申报名单", row: 2, column: 6, address: "F2", value: "数字政务" },
      ],
    }],
  }
}

async function sha256(content: string): Promise<string> {
  const data = new TextEncoder().encode(content)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function seedIngestCache(sourceFileName: string, sourceContent: string, filesWritten: string[]) {
  fsMock.touch(`${PROJECT}/.llm-wiki/ingest-cache.json`, JSON.stringify({
    entries: {
      [sourceFileName]: { hash: await sha256(sourceContent), timestamp: 1, filesWritten },
    },
  }), 20)
  for (const relativePath of filesWritten) {
    fsMock.touch(`${PROJECT}/${relativePath}`, "cached", 20)
  }
}

function setXlsxPrecisionMode(mode: "disabled" | "observe" | "block") {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => key === "llm-wiki.xlsxPrecisionRolloutMode" ? mode : null,
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  fsMock.reset()
  llmMock.reset()
  vi.clearAllMocks()
  fsMock.touch(RAW, "NATIVE BODY", 10)
  fsMock.touch(`${PROJECT}/schema.md`, "", 1)
  fsMock.touch(`${PROJECT}/purpose.md`, "", 1)
  fsMock.touch(`${PROJECT}/wiki/index.md`, "", 1)
  fsMock.touch(`${PROJECT}/wiki/overview.md`, "", 1)
  useActivityStore.setState({ items: [] })
  useReviewStore.setState({ items: [] })
  useChatStore.setState({
    conversations: [],
    messages: [],
    activeConversationId: null,
    mode: "chat",
    ingestSource: null,
    isStreaming: false,
    streamingContent: "",
  })
  useWikiStore.setState({
    outputLanguage: "auto",
    multimodalConfig: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      model: "",
      ollamaUrl: "",
      customEndpoint: "",
      useMainLlm: true,
      apiMode: "chat_completions",
      concurrency: 1,
    },
    embeddingConfig: {
      enabled: false,
      endpoint: "",
      apiKey: "",
      model: "",
    },
  } as Partial<ReturnType<typeof useWikiStore.getState>>)
})

describe("autoIngest converted source input", () => {
  it("feeds MarkItDown markdown to the LLM instead of native extraction", async () => {
    await autoIngest(PROJECT, RAW, {
      provider: "openai",
      apiKey: "test",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    expect(fsMock.convertWithMarkitdown).toHaveBeenCalledWith(RAW)
    expect(fsMock.extractXlsxSidecarPayload).not.toHaveBeenCalled()
    expect(fsMock.files.get(`${PROJECT}/.llm-wiki/converted/report.pdf.md`)?.content)
      .toBe("MARKITDOWN BODY\n")
    const firstUserMessage = llmMock.calls[0]?.find((m) => m.role === "user")?.content ?? ""
    expect(firstUserMessage).toContain("MARKITDOWN BODY")
    expect(firstUserMessage).not.toContain("NATIVE BODY")
  })

  it("observe mode records xlsx audit issues without blocking the normal LLM pipeline", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(unsupportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("observe")

    const written = await autoIngest(PROJECT, xlsxPath, {
      provider: "openai",
      apiKey: "test",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    expect(llmMock.calls.length).toBeGreaterThan(0)
    expect(written.length).toBeGreaterThan(0)
    expect(useReviewStore.getState().items[0]?.metadata?.wouldBlockPaths).toBeDefined()
  })

  it("block mode stops unsupported xlsx before LLM FILE blocks write target pages", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(unsupportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("block")

    const written = await autoIngest(PROJECT, xlsxPath, {
      provider: "openai",
      apiKey: "test",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    expect(llmMock.calls).toHaveLength(0)
    expect(written).toEqual(["wiki/sources/first-batch.md"])
    expect([...fsMock.files.keys()].some((path) => path.includes("/wiki/entities/"))).toBe(false)
    expect(useReviewStore.getState().items[0]?.metadata?.wouldBlockPaths).toEqual(expect.arrayContaining([
      "wiki/index.md",
      "wiki/overview.md",
      "wiki/log.md",
    ]))
    expect(useReviewStore.getState().items[0]?.metadata?.auditPath).toMatch(/\.audit\.json$/)
  })

  it("block mode also stops manual ingest FILE-block writes for unsupported xlsx", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(unsupportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("block")
    useChatStore.setState({ ingestSource: xlsxPath })

    const written = await executeIngestWrites(PROJECT, {
      provider: "openai",
      apiKey: "test",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    expect(llmMock.calls).toHaveLength(0)
    expect(written).toEqual([`${PROJECT}/wiki/sources/first-batch.md`])
    expect([...fsMock.files.keys()].some((path) => path.includes("/wiki/entities/"))).toBe(false)
    expect(useReviewStore.getState().items[0]?.metadata?.wouldBlockPaths).toEqual(expect.arrayContaining([
      "wiki/index.md",
      "wiki/overview.md",
      "wiki/log.md",
    ]))
  })


  it("block mode filters unsafe cache-hit paths for unsupported xlsx", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(unsupportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("block")
    await seedIngestCache("first-batch.xlsx", "MARKITDOWN BODY\n", [
      "wiki/sources/first-batch.md",
      "wiki/entities/company.md",
      "wiki/index.md",
      "wiki/overview.md",
      "wiki/log.md",
      "wiki/sources/first-batch-precision.md",
    ])

    const written = await autoIngest(PROJECT, xlsxPath, {
      provider: "openai", apiKey: "test", model: "gpt-4", ollamaUrl: "", customEndpoint: "", maxContextSize: 128000,
    })

    expect(llmMock.calls).toHaveLength(0)
    expect(written).toEqual(["wiki/sources/first-batch.md"])
  })

  it("observe mode keeps cache-hit behavior while recording would-block metadata", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(unsupportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("observe")
    const cached = ["wiki/sources/first-batch.md", "wiki/entities/company.md"]
    await seedIngestCache("first-batch.xlsx", "MARKITDOWN BODY\n", cached)

    const written = await autoIngest(PROJECT, xlsxPath, {
      provider: "openai", apiKey: "test", model: "gpt-4", ollamaUrl: "", customEndpoint: "", maxContextSize: 128000,
    })

    expect(llmMock.calls).toHaveLength(0)
    expect(written).toEqual(cached)
    expect(useReviewStore.getState().items[0]?.metadata?.wouldBlockPaths).toBeDefined()
  })

  it("block mode with passed audit writes deterministic source and precision pages", async () => {
    const xlsxPath = `${PROJECT}/raw/sources/first-batch.xlsx`
    fsMock.touch(xlsxPath, "NATIVE XLSX BODY", 10)
    fsMock.extractXlsxSidecarPayload.mockResolvedValueOnce(supportedXlsxPayload(xlsxPath))
    setXlsxPrecisionMode("block")

    const written = await autoIngest(PROJECT, xlsxPath, {
      provider: "openai", apiKey: "test", model: "gpt-4", ollamaUrl: "", customEndpoint: "", maxContextSize: 128000,
    })

    expect(llmMock.calls).toHaveLength(0)
    expect(written).toEqual(["wiki/sources/first-batch.md", "wiki/sources/first-batch-precision.md"])
    const precisionPage = fsMock.files.get(`${PROJECT}/wiki/sources/first-batch-precision.md`)?.content ?? ""
    expect(precisionPage).toContain("generatedBy: xlsx-precision-p0")
    expect(precisionPage).toContain(".audit.json")
    expect([...fsMock.files.keys()].some((path) => path.endsWith(".audit.json"))).toBe(true)
  })

})
