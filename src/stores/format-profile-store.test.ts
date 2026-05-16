import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFormatProfileStore } from "./format-profile-store"
import type { FormatProfileRecord } from "@/lib/format-profile"
import { createRunningSemanticOverlay } from "@/lib/format-profile-semantic-overlay"
import type { LlmConfig } from "@/stores/wiki-store"

const llmConfig: LlmConfig = {
  provider: "custom",
  apiKey: "",
  model: "mock-model",
  ollamaUrl: "http://localhost:11434",
  customEndpoint: "http://localhost:1234/v1/chat/completions",
  maxContextSize: 10000,
  apiMode: "chat_completions",
}

function makeProfile(id: string, title = id): FormatProfileRecord {
  return {
    id,
    title,
    sourceName: `${title}.docx`,
    fileType: "docx",
    sourceKind: "finished-file",
    documentKind: "formal-document",
    confidence: "high",
    importedAt: 1,
    updatedAt: 2,
    structureProfile: { sectionPattern: "numbered", sections: [], evidenceSummary: [] },
    styleProfile: { toneHints: [], layoutHints: [] },
    writingProfile: { generationInstruction: "instruction", constraints: [] },
    diagnostics: [],
    textSample: "",
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
  useFormatProfileStore.setState({
    profiles: [],
    selectedProfileId: null,
    activeProfileId: null,
    lastChange: { revision: 0, persist: "none" },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("format-profile-store", () => {
  it("adds an imported profile and binds the first one by default", () => {
    const profile = makeProfile("profile-1", "正式报告")

    useFormatProfileStore.getState().addProfile(profile)

    expect(useFormatProfileStore.getState().profiles[0]).toEqual(profile)
    expect(useFormatProfileStore.getState().selectedProfileId).toBe(profile.id)
    expect(useFormatProfileStore.getState().activeProfileId).toBe(profile.id)
    expect(useFormatProfileStore.getState().lastChange.persist).toBe("immediate")
  })

  it("binds only an existing profile as the current profile", () => {
    const profile = makeProfile("profile-1")
    useFormatProfileStore.getState().setProfiles([profile], null, { silent: true })

    useFormatProfileStore.getState().setActiveProfile(profile.id)
    expect(useFormatProfileStore.getState().activeProfileId).toBe(profile.id)

    useFormatProfileStore.getState().setActiveProfile("missing")
    expect(useFormatProfileStore.getState().activeProfileId).toBeNull()
  })

  it("clears current binding when deleting the active profile", () => {
    const first = makeProfile("first")
    const second = makeProfile("second")
    useFormatProfileStore.getState().setProfiles([first, second], second.id, { silent: true })

    useFormatProfileStore.getState().deleteProfile(second.id)

    expect(useFormatProfileStore.getState().profiles.map((profile) => profile.id)).toEqual(["first"])
    expect(useFormatProfileStore.getState().activeProfileId).toBeNull()
    expect(useFormatProfileStore.getState().lastChange.persist).toBe("immediate")
  })

  it("can import a fresh profile after deleting the last one", () => {
    const first = makeProfile("first")
    const second = makeProfile("second")
    useFormatProfileStore.getState().addProfile(first)

    useFormatProfileStore.getState().deleteProfile(first.id)
    expect(useFormatProfileStore.getState()).toMatchObject({
      profiles: [],
      selectedProfileId: null,
      activeProfileId: null,
    })

    useFormatProfileStore.getState().addProfile(second)

    expect(useFormatProfileStore.getState().profiles.map((profile) => profile.id)).toEqual(["second"])
    expect(useFormatProfileStore.getState().selectedProfileId).toBe(second.id)
    expect(useFormatProfileStore.getState().activeProfileId).toBe(second.id)
  })

  it("expires persisted running semantic overlays during hydration", () => {
    const profile = makeProfile("profile-1")
    const running = createRunningSemanticOverlay(profile, llmConfig, 1000, 123)

    useFormatProfileStore.getState().setProfiles([{ ...profile, semanticOverlay: running }], null, { silent: true })

    const hydrated = useFormatProfileStore.getState().profiles[0]
    expect(hydrated.semanticOverlay?.status).toBe("failed")
    expect(hydrated.semanticOverlay?.fallbackReason).toBe("interrupted")
    expect(hydrated.semanticOverlay?.output).toBeUndefined()
  })

  it("saves and resets user-edited format constraints", () => {
    const profile = makeProfile("profile-1")
    useFormatProfileStore.getState().setProfiles([profile], null, { silent: true })

    useFormatProfileStore.getState().saveEditableFormatSpec(profile.id, "hash-1", "edited prompt")

    const edited = useFormatProfileStore.getState().profiles[0]
    expect(edited.editableFormatSpec).toMatchObject({
      schemaVersion: "editable-format-constraints.v0",
      sourceFormatSpecHash: "hash-1",
      promptBlock: "edited prompt",
      editedBy: "user",
    })
    expect(useFormatProfileStore.getState().lastChange.persist).toBe("immediate")

    useFormatProfileStore.getState().resetEditableFormatSpec(profile.id)
    expect(useFormatProfileStore.getState().profiles[0].editableFormatSpec).toBeUndefined()
  })
})
