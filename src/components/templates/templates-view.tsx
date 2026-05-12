import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, LayoutTemplate, Plus, Trash2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTemplateStore, type TemplateRecord } from "@/stores/template-store"

function formatDate(ts: number): string {
  if (!Number.isFinite(ts)) return ""
  return new Date(ts).toLocaleString()
}

function linesToText(lines: string[]): string {
  return lines.join("\n")
}

function textToLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

interface TextAreaFieldProps {
  id: string
  label: string
  value: string
  placeholder?: string
  rows?: number
  onChange: (value: string) => void
}

function TextAreaField({ id, label, value, placeholder, rows = 4, onChange }: TextAreaFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 text-xs text-muted-foreground">
        {label}
      </Label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-input bg-background p-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  )
}

export function TemplatesView() {
  const { t } = useTranslation()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const templates = useTemplateStore((s) => s.templates)
  const selectedTemplateId = useTemplateStore((s) => s.selectedTemplateId)
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId)
  const createTemplate = useTemplateStore((s) => s.createTemplate)
  const updateTemplate = useTemplateStore((s) => s.updateTemplate)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)
  const selectTemplate = useTemplateStore((s) => s.selectTemplate)
  const setActiveTemplate = useTemplateStore((s) => s.setActiveTemplate)

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => b.updatedAt - a.updatedAt),
    [templates],
  )
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null

  useEffect(() => {
    if (!selectedTemplate && sortedTemplates[0]) {
      selectTemplate(sortedTemplates[0].id)
    }
  }, [selectTemplate, selectedTemplate, sortedTemplates])

  useEffect(() => {
    setDeleteConfirmId(null)
  }, [selectedTemplateId])

  const handleCreate = () => {
    createTemplate({ title: t("templates.defaultTitle") })
  }

  const handleDelete = (template: TemplateRecord) => {
    if (deleteConfirmId !== template.id) {
      setDeleteConfirmId(template.id)
      return
    }
    deleteTemplate(template.id)
    setDeleteConfirmId(null)
  }

  if (templates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <div className="max-w-sm rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <LayoutTemplate className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("templates.emptyTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("templates.emptyHint")}</p>
          <Button type="button" className="mt-4" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t("templates.create")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20">
        <div className="border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold">{t("templates.title")}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("templates.count", { count: templates.length })}
              </p>
            </div>
            <Button type="button" size="icon-sm" variant="outline" onClick={handleCreate} title={t("templates.create")}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {activeTemplate && (
            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
              <div className="font-medium text-foreground">{t("templates.currentTemplate")}</div>
              <div className="mt-0.5 line-clamp-2 text-muted-foreground">{activeTemplate.title}</div>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {sortedTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template.id)}
                className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                  selectedTemplateId === template.id
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-medium">{template.title}</div>
                    <div className="mt-1 text-[10px] opacity-70">{formatDate(template.updatedAt)}</div>
                  </div>
                  {template.id === activeTemplateId && (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedTemplate ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <Label htmlFor="template-title" className="mb-2 text-xs text-muted-foreground">
                  {t("templates.titleLabel")}
                </Label>
                <Input
                  id="template-title"
                  value={selectedTemplate.title}
                  onChange={(event) => updateTemplate(selectedTemplate.id, { title: event.target.value })}
                  className="h-9 text-sm font-medium"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedTemplate.id === activeTemplateId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveTemplate(null)}>
                    <X className="h-3.5 w-3.5" />
                    {t("templates.clearCurrent")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveTemplate(selectedTemplate.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("templates.setCurrent")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedTemplate)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleteConfirmId === selectedTemplate.id ? t("templates.deleteAgain") : t("templates.delete")}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="mx-auto max-w-5xl space-y-4 p-4">
                <div className="rounded-lg border bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="font-medium text-foreground">{t("templates.scopeTitle")}</div>
                  <p className="mt-1">{t("templates.scopeHint")}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <TextAreaField
                    id="template-description"
                    label={t("templates.descriptionLabel")}
                    value={selectedTemplate.description}
                    placeholder={t("templates.descriptionPlaceholder")}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { description: value })}
                  />
                  <TextAreaField
                    id="template-intent"
                    label={t("templates.intentLabel")}
                    value={selectedTemplate.intent}
                    placeholder={t("templates.intentPlaceholder")}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { intent: value })}
                  />
                  <TextAreaField
                    id="template-required-sections"
                    label={t("templates.requiredSectionsLabel")}
                    value={linesToText(selectedTemplate.requiredSections)}
                    placeholder={t("templates.linesPlaceholder")}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { requiredSections: textToLines(value) })}
                  />
                  <TextAreaField
                    id="template-section-order"
                    label={t("templates.sectionOrderLabel")}
                    value={linesToText(selectedTemplate.sectionOrder)}
                    placeholder={t("templates.linesPlaceholder")}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { sectionOrder: textToLines(value) })}
                  />
                  <TextAreaField
                    id="template-tone"
                    label={t("templates.toneLabel")}
                    value={selectedTemplate.tone}
                    placeholder={t("templates.tonePlaceholder")}
                    rows={3}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { tone: value })}
                  />
                  <TextAreaField
                    id="template-length-limit"
                    label={t("templates.lengthLimitLabel")}
                    value={selectedTemplate.lengthLimit}
                    placeholder={t("templates.lengthLimitPlaceholder")}
                    rows={3}
                    onChange={(value) => updateTemplate(selectedTemplate.id, { lengthLimit: value })}
                  />
                </div>

                <TextAreaField
                  id="template-citation-policy"
                  label={t("templates.citationPolicyLabel")}
                  value={selectedTemplate.citationPolicy}
                  placeholder={t("templates.citationPolicyPlaceholder")}
                  rows={4}
                  onChange={(value) => updateTemplate(selectedTemplate.id, { citationPolicy: value })}
                />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("templates.noSelection")}
          </div>
        )}
      </main>
    </div>
  )
}
