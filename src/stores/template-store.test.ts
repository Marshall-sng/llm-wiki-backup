import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTemplateStore, type TemplateRecord } from "./template-store"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
  useTemplateStore.setState({
    templates: [],
    selectedTemplateId: null,
    activeTemplateId: null,
    lastChange: { revision: 0, persist: "none" },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("template-store", () => {
  it("creates a selected editable template without binding it automatically", () => {
    const template = useTemplateStore.getState().createTemplate({ title: " 政策汇报模板 " })

    expect(template.id).toMatch(/^template_/)
    expect(template.title).toBe("政策汇报模板")
    expect(template.requiredSections).toEqual([])
    expect(template.sectionOrder).toEqual([])
    expect(useTemplateStore.getState().selectedTemplateId).toBe(template.id)
    expect(useTemplateStore.getState().activeTemplateId).toBeNull()
    expect(useTemplateStore.getState().lastChange.persist).toBe("immediate")
  })

  it("updates template fields and normalizes line-based fields", () => {
    const template = useTemplateStore.getState().createTemplate({ title: "Template" })
    vi.setSystemTime(1_700_000_000_200)

    useTemplateStore.getState().updateTemplate(template.id, {
      title: "Updated",
      requiredSections: [" 背景 ", "", "结论"],
      sectionOrder: ["一、背景", "二、结论"],
      tone: "正式",
    })

    const updated = useTemplateStore.getState().templates[0]
    expect(updated).toMatchObject({
      title: "Updated",
      requiredSections: ["背景", "结论"],
      sectionOrder: ["一、背景", "二、结论"],
      tone: "正式",
      updatedAt: 1_700_000_000_200,
    })
    expect(useTemplateStore.getState().lastChange.persist).toBe("debounced")
  })

  it("binds only an existing template as the current template", () => {
    const template = useTemplateStore.getState().createTemplate({ title: "Template" })

    useTemplateStore.getState().setActiveTemplate(template.id)
    expect(useTemplateStore.getState().activeTemplateId).toBe(template.id)

    useTemplateStore.getState().setActiveTemplate("missing")
    expect(useTemplateStore.getState().activeTemplateId).toBeNull()
  })

  it("clears current binding when deleting the active template", () => {
    const first = useTemplateStore.getState().createTemplate({ title: "First" })
    const second = useTemplateStore.getState().createTemplate({ title: "Second" })
    useTemplateStore.getState().setActiveTemplate(second.id)

    useTemplateStore.getState().deleteTemplate(second.id)

    expect(useTemplateStore.getState().templates.map((template) => template.id)).toEqual([first.id])
    expect(useTemplateStore.getState().selectedTemplateId).toBe(first.id)
    expect(useTemplateStore.getState().activeTemplateId).toBeNull()
    expect(useTemplateStore.getState().lastChange.persist).toBe("immediate")
  })

  it("hydrates silently and keeps only a valid active template id", () => {
    const template: TemplateRecord = {
      id: "template-existing",
      title: "Existing",
      description: "",
      intent: "",
      requiredSections: [],
      sectionOrder: [],
      tone: "",
      lengthLimit: "",
      citationPolicy: "",
      createdAt: 1,
      updatedAt: 2,
    }

    useTemplateStore.getState().setTemplates([template], "missing", { silent: true })

    expect(useTemplateStore.getState().templates).toEqual([template])
    expect(useTemplateStore.getState().selectedTemplateId).toBe(template.id)
    expect(useTemplateStore.getState().activeTemplateId).toBeNull()
    expect(useTemplateStore.getState().lastChange.persist).toBe("none")
  })
})
