import { extractXlsxSidecarPayload, type XlsxSidecarPayload } from "@/commands/fs"
import { buildXlsxSourceSidecar } from "./xlsx-sidecar"
import { persistSourceSidecar } from "./source-sidecar-persist"
import type { SourceSidecar } from "./source-sidecar-types"

export interface EnsureXlsxSidecarDeps {
  extractPayload: (sourcePath: string) => Promise<XlsxSidecarPayload>
  persist: (projectPath: string, sidecar: SourceSidecar) => Promise<string>
}

export interface EnsureXlsxSidecarInput {
  projectPath: string
  sourcePath: string
  enabled: boolean
  deps?: EnsureXlsxSidecarDeps
}

export type EnsureXlsxSidecarResult =
  | { status: "disabled"; reason: string }
  | { status: "skipped"; reason: string }
  | { status: "written"; path: string; sidecar: SourceSidecar }

const defaultDeps: EnsureXlsxSidecarDeps = {
  extractPayload: extractXlsxSidecarPayload,
  persist: persistSourceSidecar,
}

export function isXlsxSourcePath(path: string): boolean {
  return /\.xlsx$/i.test(path.trim())
}

export function readXlsxSourceSidecarFeatureFlag(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem("llm-wiki.enableXlsxSourceSidecar") === "true"
  } catch {
    return false
  }
}

export async function ensureXlsxSourceSidecarFresh(input: EnsureXlsxSidecarInput): Promise<EnsureXlsxSidecarResult> {
  if (!input.enabled) {
    return { status: "disabled", reason: "enableXlsxSourceSidecar is false" }
  }
  if (!isXlsxSourcePath(input.sourcePath)) {
    return { status: "skipped", reason: "source is not .xlsx" }
  }

  const deps = input.deps ?? defaultDeps
  const payload = await deps.extractPayload(input.sourcePath)
  const sidecar = buildXlsxSourceSidecar(payload)
  const path = await deps.persist(input.projectPath, sidecar)
  return { status: "written", path, sidecar }
}
