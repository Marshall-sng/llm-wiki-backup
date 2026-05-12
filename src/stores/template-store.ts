import { create } from "zustand"

export interface TemplateRecord {
  id: string
  title: string
  description: string
  intent: string
  requiredSections: string[]
  sectionOrder: string[]
  tone: string
  lengthLimit: string
  citationPolicy: string
  createdAt: number
  updatedAt: number
}

export type TemplatePersistMode = "none" | "debounced" | "immediate"

export interface TemplateChangeMarker {
  revision: number
  persist: TemplatePersistMode
}

interface HydrateOptions {
  silent?: boolean
}

interface CreateTemplateInput {
  title?: string
}

interface TemplateState {
  templates: TemplateRecord[]
  selectedTemplateId: string | null
  activeTemplateId: string | null
  lastChange: TemplateChangeMarker

  createTemplate: (input?: CreateTemplateInput) => TemplateRecord
  updateTemplate: (
    id: string,
    updates: Partial<Omit<TemplateRecord, "id" | "createdAt" | "updatedAt">>,
  ) => void
  deleteTemplate: (id: string) => void
  selectTemplate: (id: string | null) => void
  setActiveTemplate: (id: string | null) => void
  setTemplates: (templates: TemplateRecord[], activeTemplateId?: string | null, options?: HydrateOptions) => void
  clearTemplates: (options?: HydrateOptions) => void
}

let templateCounter = 0

function nextTemplateId(): string {
  templateCounter += 1
  return `template_${Date.now()}_${templateCounter}_${Math.random().toString(36).slice(2, 8)}`
}

function markChange(current: TemplateChangeMarker, persist: TemplatePersistMode): TemplateChangeMarker {
  return { revision: current.revision + 1, persist }
}

function normalizeLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function normalizeTemplate(template: Partial<TemplateRecord>): TemplateRecord {
  const now = Date.now()
  return {
    id: template.id || nextTemplateId(),
    title: normalizeText(template.title).trim() || "未命名模板",
    description: normalizeText(template.description),
    intent: normalizeText(template.intent),
    requiredSections: normalizeLines(template.requiredSections),
    sectionOrder: normalizeLines(template.sectionOrder),
    tone: normalizeText(template.tone),
    lengthLimit: normalizeText(template.lengthLimit),
    citationPolicy: normalizeText(template.citationPolicy),
    createdAt: typeof template.createdAt === "number" ? template.createdAt : now,
    updatedAt: typeof template.updatedAt === "number" ? template.updatedAt : now,
  }
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  selectedTemplateId: null,
  activeTemplateId: null,
  lastChange: { revision: 0, persist: "none" },

  createTemplate: (input) => {
    const now = Date.now()
    const template: TemplateRecord = {
      id: nextTemplateId(),
      title: input?.title?.trim() || "未命名模板",
      description: "",
      intent: "",
      requiredSections: [],
      sectionOrder: [],
      tone: "",
      lengthLimit: "",
      citationPolicy: "",
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      templates: [template, ...state.templates],
      selectedTemplateId: template.id,
      lastChange: markChange(state.lastChange, "immediate"),
    }))
    return template
  },

  updateTemplate: (id, updates) => {
    set((state) => {
      let changed = false
      const templates = state.templates.map((template) => {
        if (template.id !== id) return template
        changed = true
        return {
          ...template,
          ...updates,
          requiredSections: updates.requiredSections !== undefined
            ? normalizeLines(updates.requiredSections)
            : template.requiredSections,
          sectionOrder: updates.sectionOrder !== undefined
            ? normalizeLines(updates.sectionOrder)
            : template.sectionOrder,
          title: updates.title?.trim() || template.title,
          updatedAt: Date.now(),
        }
      })
      if (!changed) return state
      return {
        templates,
        lastChange: markChange(state.lastChange, "debounced"),
      }
    })
  },

  deleteTemplate: (id) => {
    set((state) => {
      const templates = state.templates.filter((template) => template.id !== id)
      if (templates.length === state.templates.length) return state
      const selectedTemplateId = state.selectedTemplateId === id ? templates[0]?.id ?? null : state.selectedTemplateId
      const activeTemplateId = state.activeTemplateId === id ? null : state.activeTemplateId
      return {
        templates,
        selectedTemplateId,
        activeTemplateId,
        lastChange: markChange(state.lastChange, "immediate"),
      }
    })
  },

  selectTemplate: (selectedTemplateId) => set({ selectedTemplateId }),

  setActiveTemplate: (activeTemplateId) => {
    set((state) => {
      const normalizedId = activeTemplateId && state.templates.some((template) => template.id === activeTemplateId)
        ? activeTemplateId
        : null
      if (state.activeTemplateId === normalizedId) return state
      return {
        activeTemplateId: normalizedId,
        lastChange: markChange(state.lastChange, "immediate"),
      }
    })
  },

  setTemplates: (templates, activeTemplateId, options) => {
    const normalized = templates.map(normalizeTemplate).sort((a, b) => b.updatedAt - a.updatedAt)
    const safeActiveId = activeTemplateId && normalized.some((template) => template.id === activeTemplateId)
      ? activeTemplateId
      : null
    set((state) => ({
      templates: normalized,
      selectedTemplateId: normalized[0]?.id ?? null,
      activeTemplateId: safeActiveId,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },

  clearTemplates: (options) => {
    set((state) => ({
      templates: [],
      selectedTemplateId: null,
      activeTemplateId: null,
      lastChange: options?.silent ? state.lastChange : markChange(state.lastChange, "immediate"),
    }))
  },
}))
