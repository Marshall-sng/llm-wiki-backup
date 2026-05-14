import { create } from "zustand"
import type { FormatProfileRecord } from "@/lib/format-profile"
import type { LlmConfig } from "@/stores/wiki-store"
import {
  buildEvidenceCatalog,
  buildEvidenceOnlyOverlayInput,
  buildSemanticOverlayPrompt,
  completeSemanticOverlay,
  createRunningSemanticOverlay,
  expireInterruptedRunningOverlay,
  requestSemanticOverlayCompletion,
  shouldAllowSemanticOverlayRequest,
} from "@/lib/format-profile-semantic-overlay"

export type FormatProfilePersistMode = "none" | "debounced" | "immediate"

export interface FormatProfileChangeMarker {
  revision: number
  persist: FormatProfilePersistMode
}

interface HydrateOptions {
  silent?: boolean
}

interface FormatProfileState {
  profiles: FormatProfileRecord[]
  selectedProfileId: string | null
  activeProfileId: string | null
  lastChange: FormatProfileChangeMarker

  addProfile: (profile: FormatProfileRecord) => void
  deleteProfile: (id: string) => void
  selectProfile: (id: string | null) => void
  setActiveProfile: (id: string | null) => void
  setProfiles: (profiles: FormatProfileRecord[], activeProfileId?: string | null, options?: HydrateOptions) => void
  clearProfiles: (options?: HydrateOptions) => void
  saveEditableFormatSpec: (id: string, sourceFormatSpecHash: string, promptBlock: string) => void
  resetEditableFormatSpec: (id: string) => void
  runSemanticOverlay: (id: string, config: LlmConfig, options?: { timeoutMs?: number; signal?: AbortSignal }) => Promise<void>
}

function markChange(current: FormatProfileChangeMarker, persist: FormatProfilePersistMode): FormatProfileChangeMarker {
  return { revision: current.revision + 1, persist }
}

function normalizeProfile(profile: FormatProfileRecord): FormatProfileRecord {
  const now = Date.now()
  const normalized = {
    ...profile,
    id: profile.id || `format_profile_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: profile.title?.trim() || profile.sourceName || "未命名格式画像",
    importedAt: typeof profile.importedAt === "number" ? profile.importedAt : now,
    updatedAt: typeof profile.updatedAt === "number" ? profile.updatedAt : now,
    diagnostics: Array.isArray(profile.diagnostics) ? profile.diagnostics : [],
  }
  return expireInterruptedRunningOverlay(normalized)
}

export const useFormatProfileStore = create<FormatProfileState>((set) => ({
  profiles: [],
  selectedProfileId: null,
  activeProfileId: null,
  lastChange: { revision: 0, persist: "none" },

  addProfile: (profile) => {
    const normalized = normalizeProfile(profile)
    set((state) => ({
      profiles: [normalized, ...state.profiles.filter((item) => item.id !== normalized.id)],
      selectedProfileId: normalized.id,
      activeProfileId: state.activeProfileId ?? normalized.id,
      lastChange: markChange(state.lastChange, "immediate"),
    }))
  },

  deleteProfile: (id) => {
    set((state) => {
      const profiles = state.profiles.filter((profile) => profile.id !== id)
      if (profiles.length === state.profiles.length) return state
      return {
        profiles,
        selectedProfileId: state.selectedProfileId === id ? profiles[0]?.id ?? null : state.selectedProfileId,
        activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
        lastChange: markChange(state.lastChange, "immediate"),
      }
    })
  },

  selectProfile: (selectedProfileId) => set({ selectedProfileId }),

  setActiveProfile: (activeProfileId) => {
    set((state) => {
      const normalizedId = activeProfileId && state.profiles.some((profile) => profile.id === activeProfileId)
        ? activeProfileId
        : null
      if (state.activeProfileId === normalizedId) return state
      return {
        activeProfileId: normalizedId,
        lastChange: markChange(state.lastChange, "immediate"),
      }
    })
  },

  setProfiles: (profiles, activeProfileId, options) => {
    const normalized = profiles.map(normalizeProfile).sort((a, b) => b.updatedAt - a.updatedAt)
    const safeActiveId = activeProfileId && normalized.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : null
    set((state) => ({
      profiles: normalized,
      selectedProfileId: normalized[0]?.id ?? null,
      activeProfileId: safeActiveId,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },

  clearProfiles: (options) => {
    set((state) => ({
      profiles: [],
      selectedProfileId: null,
      activeProfileId: null,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },

  saveEditableFormatSpec: (id, sourceFormatSpecHash, promptBlock) => {
    set((state) => ({
      profiles: state.profiles.map((profile) => profile.id === id
        ? {
          ...profile,
          editableFormatSpec: {
            schemaVersion: "editable-format-constraints.v0",
            sourceFormatSpecHash,
            promptBlock,
            updatedAt: Date.now(),
            editedBy: "user" as const,
          },
          updatedAt: Date.now(),
        }
        : profile),
      lastChange: markChange(state.lastChange, "immediate"),
    }))
  },

  resetEditableFormatSpec: (id) => {
    set((state) => ({
      profiles: state.profiles.map((profile) => {
        if (profile.id !== id || !profile.editableFormatSpec) return profile
        const { editableFormatSpec, ...rest } = profile
        return { ...rest, updatedAt: Date.now() }
      }),
      lastChange: markChange(state.lastChange, "immediate"),
    }))
  },

  runSemanticOverlay: async (id, config, options) => {
    if (!shouldAllowSemanticOverlayRequest(config)) {
      set((state) => ({
        profiles: state.profiles.map((profile) => profile.id === id
          ? { ...profile, refinement: { semanticStatus: "not-configured", dataScope: "evidence-only" } }
          : profile),
        lastChange: markChange(state.lastChange, "immediate"),
      }))
      return
    }

    let target: FormatProfileRecord | undefined
    let runningOverlay: ReturnType<typeof createRunningSemanticOverlay> | undefined
    const timeoutMs = options?.timeoutMs ?? 300_000
    set((state) => {
      const profiles = state.profiles.map((profile) => {
        if (profile.id !== id) return profile
        target = profile
        runningOverlay = createRunningSemanticOverlay(profile, config, timeoutMs)
        return {
          ...profile,
          semanticOverlay: runningOverlay,
          refinement: { semanticStatus: "running" as const, dataScope: "evidence-only" as const },
        }
      })
      return { profiles, lastChange: markChange(state.lastChange, "immediate") }
    })
    if (!target || !runningOverlay) return

    const input = buildEvidenceOnlyOverlayInput(target, true)
    const messages = buildSemanticOverlayPrompt(input)
    const result = await requestSemanticOverlayCompletion(config, messages, { timeoutMs, signal: options?.signal })
    const evidenceIds = new Set(buildEvidenceCatalog(target.styleFacts).map((item) => item.id))
    const completed = completeSemanticOverlay(runningOverlay, result, evidenceIds)
    const { buildGenerationInstruction } = await import("@/lib/format-profile")
    set((state) => ({
      profiles: state.profiles.map((profile) => {
        if (profile.id !== id) return profile
        const withOverlay: FormatProfileRecord = {
          ...profile,
          semanticOverlay: completed,
          refinement: { semanticStatus: completed.status, dataScope: "evidence-only" },
        }
        return {
          ...withOverlay,
          writingProfile: {
            ...withOverlay.writingProfile,
            generationInstruction: buildGenerationInstruction(withOverlay),
          },
        }
      }),
      lastChange: markChange(state.lastChange, "immediate"),
    }))
  },
}))
