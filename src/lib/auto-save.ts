import { useReviewStore } from "@/stores/review-store"
import { useChatStore } from "@/stores/chat-store"
import { useDraftStore } from "@/stores/draft-store"
import { useTemplateStore } from "@/stores/template-store"
import { useWikiStore } from "@/stores/wiki-store"
import { saveReviewItems, saveChatHistory } from "./persist"
import { saveDrafts } from "./draft-persist"
import { saveTemplates } from "./template-persist"

let reviewTimer: ReturnType<typeof setTimeout> | null = null
let chatTimer: ReturnType<typeof setTimeout> | null = null
let draftTimer: ReturnType<typeof setTimeout> | null = null
let templateTimer: ReturnType<typeof setTimeout> | null = null
let handledDraftRevision = 0
let handledTemplateRevision = 0

export function clearDraftAutoSaveTimer(): void {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = null
}

export function clearTemplateAutoSaveTimer(): void {
  if (templateTimer) clearTimeout(templateTimer)
  templateTimer = null
}

export function setupAutoSave(): void {
  // Auto-save review items (debounced 1s)
  useReviewStore.subscribe((state) => {
    if (reviewTimer) clearTimeout(reviewTimer)
    reviewTimer = setTimeout(() => {
      const project = useWikiStore.getState().project
      if (project) {
        saveReviewItems(project.path, state.items).catch(() => {})
      }
    }, 1000)
  })

  // Auto-save chat conversations and messages (debounced 2s, skip during streaming)
  useChatStore.subscribe((state) => {
    if (state.isStreaming) return
    if (chatTimer) clearTimeout(chatTimer)
    chatTimer = setTimeout(() => {
      const project = useWikiStore.getState().project
      if (project) {
        saveChatHistory(project.path, state.conversations, state.messages).catch(() => {})
      }
    }, 2000)
  })

  useDraftStore.subscribe((state) => {
    if (state.lastChange.revision === handledDraftRevision) return
    if (state.lastChange.persist === "none") return

    handledDraftRevision = state.lastChange.revision
    clearDraftAutoSaveTimer()

    const project = useWikiStore.getState().project
    if (!project) return

    const projectPath = project.path
    const delay = state.lastChange.persist === "immediate" ? 0 : 1200

    draftTimer = setTimeout(() => {
      const currentProject = useWikiStore.getState().project
      if (!currentProject || currentProject.path !== projectPath) return
      saveDrafts(projectPath, useDraftStore.getState().drafts).catch(() => {})
      draftTimer = null
    }, delay)
  })

  useTemplateStore.subscribe((state) => {
    if (state.lastChange.revision === handledTemplateRevision) return
    if (state.lastChange.persist === "none") return

    handledTemplateRevision = state.lastChange.revision
    clearTemplateAutoSaveTimer()

    const project = useWikiStore.getState().project
    if (!project) return

    const projectPath = project.path
    const delay = state.lastChange.persist === "immediate" ? 0 : 1200

    templateTimer = setTimeout(() => {
      const currentProject = useWikiStore.getState().project
      if (!currentProject || currentProject.path !== projectPath) return
      const templateState = useTemplateStore.getState()
      saveTemplates(projectPath, templateState.templates, templateState.activeTemplateId).catch(() => {})
      templateTimer = null
    }, delay)
  })
}
