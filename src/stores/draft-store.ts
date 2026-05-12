import { create } from "zustand"
import type { DisplayMessage, MessageReference } from "@/stores/chat-store"

export interface DraftSourceMeta {
  kind: "chat-assistant"
  conversationId: string
  messageId: string
  messageTimestamp: number
  contentHash: string
}

export interface DraftDerivationMeta {
  parentDraftId: string
  parentDraftTitle: string
  parentContentHash: string
  instruction: string
  processingConversationId: string
}

export interface DraftRecord {
  id: string
  title: string
  content: string
  references: MessageReference[]
  source: DraftSourceMeta
  derivation?: DraftDerivationMeta
  createdAt: number
  updatedAt: number
}

export type DraftPersistMode = "none" | "debounced" | "immediate"

export interface DraftChangeMarker {
  revision: number
  persist: DraftPersistMode
}

interface HydrateOptions {
  silent?: boolean
}

interface CreateDraftFromMessageOptions {
  derivation?: DraftDerivationMeta
  forceNew?: boolean
}

interface DraftState {
  drafts: DraftRecord[]
  selectedDraftId: string | null
  lastChange: DraftChangeMarker

  createDraftFromMessage: (message: DisplayMessage, options?: CreateDraftFromMessageOptions) => DraftRecord
  updateDraft: (id: string, updates: Partial<Pick<DraftRecord, "title" | "content" | "references">>) => void
  deleteDraft: (id: string) => void
  selectDraft: (id: string | null) => void
  setDrafts: (drafts: DraftRecord[], options?: HydrateOptions) => void
  clearDrafts: (options?: HydrateOptions) => void
}

let draftCounter = 0

function nextDraftId(): string {
  draftCounter += 1
  return `draft_${Date.now()}_${draftCounter}_${Math.random().toString(36).slice(2, 8)}`
}

export function cleanDraftContent(content: string): string {
  return content
    .replace(/<!--\s*sources:[\s\S]*?-->/gi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/<think(?:ing)?>\s*[\s\S]*?<\/think(?:ing)?>\s*/gi, "")
    .replace(/<think(?:ing)?>\s*[\s\S]*$/gi, "")
    .trim()
}

export function hashDraftContent(content: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function titleFromContent(content: string): string {
  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s+/, "").trim())
    .find(Boolean)

  return (firstMeaningfulLine ?? "Untitled draft").slice(0, 80)
}

function markChange(current: DraftChangeMarker, persist: DraftPersistMode): DraftChangeMarker {
  return { revision: current.revision + 1, persist }
}

function normalizeDraft(record: DraftRecord): DraftRecord {
  const content = record.content ?? ""
  const source = record.source ?? {
    kind: "chat-assistant" as const,
    conversationId: "",
    messageId: "",
    messageTimestamp: record.createdAt ?? Date.now(),
    contentHash: hashDraftContent(content),
  }
  return {
    id: record.id || nextDraftId(),
    title: record.title || titleFromContent(content),
    content,
    references: Array.isArray(record.references) ? record.references : [],
    source: {
      kind: "chat-assistant",
      conversationId: source.conversationId ?? "",
      messageId: source.messageId ?? "",
      messageTimestamp: typeof source.messageTimestamp === "number" ? source.messageTimestamp : Date.now(),
      contentHash: source.contentHash || hashDraftContent(content),
    },
    derivation: record.derivation
      ? {
          parentDraftId: record.derivation.parentDraftId ?? "",
          parentDraftTitle: record.derivation.parentDraftTitle ?? "",
          parentContentHash: record.derivation.parentContentHash ?? "",
          instruction: record.derivation.instruction ?? "",
          processingConversationId: record.derivation.processingConversationId ?? "",
        }
      : undefined,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  }
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: [],
  selectedDraftId: null,
  lastChange: { revision: 0, persist: "none" },

  createDraftFromMessage: (message, options) => {
    const content = cleanDraftContent(message.content)
    const contentHash = hashDraftContent(content)
    const shouldDeduplicate = !options?.forceNew && !options?.derivation
    const existing = shouldDeduplicate
      ? get().drafts.find((draft) => (
        draft.source.messageId === message.id &&
        draft.source.conversationId === message.conversationId
      ) || draft.source.contentHash === contentHash)
      : undefined

    if (existing) {
      set({ selectedDraftId: existing.id })
      return existing
    }

    const now = Date.now()
    const draft: DraftRecord = {
      id: nextDraftId(),
      title: titleFromContent(content),
      content,
      references: message.references ? [...message.references] : [],
      source: {
        kind: "chat-assistant",
        conversationId: message.conversationId,
        messageId: message.id,
        messageTimestamp: message.timestamp,
        contentHash,
      },
      derivation: options?.derivation,
      createdAt: now,
      updatedAt: now,
    }

    set((state) => ({
      drafts: [draft, ...state.drafts],
      selectedDraftId: draft.id,
      lastChange: markChange(state.lastChange, "immediate"),
    }))
    return draft
  },

  updateDraft: (id, updates) => {
    set((state) => {
      let changed = false
      const drafts = state.drafts.map((draft) => {
        if (draft.id !== id) return draft
        changed = true
        const nextContent = updates.content ?? draft.content
        return {
          ...draft,
          ...updates,
          content: nextContent,
          source: {
            ...draft.source,
            contentHash: updates.content !== undefined ? hashDraftContent(nextContent) : draft.source.contentHash,
          },
          updatedAt: Date.now(),
        }
      })
      if (!changed) return state
      return {
        drafts,
        lastChange: markChange(state.lastChange, "debounced"),
      }
    })
  },

  deleteDraft: (id) => {
    set((state) => {
      const drafts = state.drafts.filter((draft) => draft.id !== id)
      if (drafts.length === state.drafts.length) return state
      const selectedDraftId = state.selectedDraftId === id ? drafts[0]?.id ?? null : state.selectedDraftId
      return {
        drafts,
        selectedDraftId,
        lastChange: markChange(state.lastChange, "immediate"),
      }
    })
  },

  selectDraft: (selectedDraftId) => set({ selectedDraftId }),

  setDrafts: (drafts, options) => {
    const normalized = drafts.map(normalizeDraft).sort((a, b) => b.updatedAt - a.updatedAt)
    set((state) => ({
      drafts: normalized,
      selectedDraftId: normalized[0]?.id ?? null,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },

  clearDrafts: (options) => {
    set((state) => ({
      drafts: [],
      selectedDraftId: null,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },
}))
