import { useEffect, useMemo, useState } from "react"
import { FileText, Trash2, MessageSquare, Hash, Sparkles, History, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDraftStore } from "@/stores/draft-store"
import { useChatStore, type DraftProcessingContext } from "@/stores/chat-store"
import { useWikiStore } from "@/stores/wiki-store"
import { useTemplateStore } from "@/stores/template-store"
import { buildDraftProcessingPrompt, buildDraftTemplateSnapshot } from "@/lib/draft-processing"
import { compareDraftText } from "@/lib/draft-versioning"
import { buildTemplateMatchReport, type TemplateMatchSeverity } from "@/lib/template-match"

function formatDate(ts: number): string {
  if (!Number.isFinite(ts)) return ""
  return new Date(ts).toLocaleString()
}

function templateMatchSeverityClass(severity: TemplateMatchSeverity): string {
  switch (severity) {
    case "pass":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "missing":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "manual":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
  }
}

export function DraftsView() {
  const { t } = useTranslation()
  const [processingInstruction, setProcessingInstruction] = useState("")
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const drafts = useDraftStore((s) => s.drafts)
  const selectedDraftId = useDraftStore((s) => s.selectedDraftId)
  const selectDraft = useDraftStore((s) => s.selectDraft)
  const updateDraft = useDraftStore((s) => s.updateDraft)
  const deleteDraft = useDraftStore((s) => s.deleteDraft)
  const createVersionSnapshot = useDraftStore((s) => s.createVersionSnapshot)
  const restoreVersionAsDraft = useDraftStore((s) => s.restoreVersionAsDraft)
  const createConversation = useChatStore((s) => s.createConversation)
  const enqueueDraftProcessingRequest = useChatStore((s) => s.enqueueDraftProcessingRequest)
  const setActiveView = useWikiStore((s) => s.setActiveView)
  const templates = useTemplateStore((s) => s.templates)
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId)

  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => b.updatedAt - a.updatedAt),
    [drafts],
  )
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null
  const selectedVersion = selectedDraft?.versions.find((version) => version.id === selectedVersionId) ?? null
  const versionComparison = useMemo(() => (
    selectedDraft && selectedVersion
      ? compareDraftText(selectedDraft.content, selectedVersion.content)
      : null
  ), [selectedDraft?.id, selectedDraft?.content, selectedVersion?.id, selectedVersion?.content])
  const templateMatchReport = useMemo(() => (
    selectedDraft && activeTemplate
      ? buildTemplateMatchReport(selectedDraft, activeTemplate)
      : null
  ), [activeTemplate, selectedDraft])
  const canStartProcessing = processingInstruction.trim().length > 0

  useEffect(() => {
    if (!selectedDraft && sortedDrafts[0]) {
      selectDraft(sortedDrafts[0].id)
    }
  }, [selectDraft, selectedDraft, sortedDrafts])

  useEffect(() => {
    setSelectedVersionId(null)
  }, [selectedDraftId])

  const handleStartProcessing = () => {
    if (!selectedDraft) return
    const instruction = processingInstruction.trim()
    if (!instruction) return
    const templateSnapshot = activeTemplate ? buildDraftTemplateSnapshot(activeTemplate) : undefined

    const draftContext: DraftProcessingContext = {
      draftId: selectedDraft.id,
      draftTitle: selectedDraft.title,
      parentContentHash: selectedDraft.source.contentHash,
      instruction,
      references: [...selectedDraft.references],
      startedAt: Date.now(),
      templateSnapshot,
    }
    const conversationId = createConversation({
      title: templateSnapshot
        ? t("drafts.templateProcessingConversationTitle", { title: selectedDraft.title })
        : t("drafts.processingConversationTitle", { title: selectedDraft.title }),
      kind: "draft-processing",
      draftContext,
    })
    enqueueDraftProcessingRequest({
      id: `draft_processing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      conversationId,
      prompt: buildDraftProcessingPrompt(selectedDraft, instruction, templateSnapshot),
    })
    setProcessingInstruction("")
    setActiveView("wiki")
  }

  const handleCreateVersionSnapshot = () => {
    if (!selectedDraft) return
    const snapshot = createVersionSnapshot(selectedDraft.id)
    if (snapshot) setSelectedVersionId(snapshot.id)
  }

  const handleRestoreVersion = () => {
    if (!selectedDraft || !selectedVersion) return
    restoreVersionAsDraft(selectedDraft.id, selectedVersion.id)
  }

  if (drafts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <div className="max-w-sm rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("drafts.emptyTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("drafts.emptyHint")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20">
        <div className="border-b p-3">
          <h1 className="text-sm font-semibold">{t("drafts.title")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("drafts.count", { count: drafts.length })}
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {sortedDrafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => selectDraft(draft.id)}
                className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                  selectedDraftId === draft.id
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <div className="line-clamp-2 text-xs font-medium">{draft.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                  <span>{formatDate(draft.updatedAt)}</span>
                  {draft.references.length > 0 && (
                    <span>· {t("drafts.referenceCount", { count: draft.references.length })}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedDraft ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <Label htmlFor="draft-title" className="mb-2 text-xs text-muted-foreground">
                  {t("drafts.titleLabel")}
                </Label>
                <Input
                  id="draft-title"
                  value={selectedDraft.title}
                  onChange={(event) => updateDraft(selectedDraft.id, { title: event.target.value })}
                  className="h-9 text-sm font-medium"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm(t("drafts.deleteConfirm"))) deleteDraft(selectedDraft.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("drafts.delete")}
              </Button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] overflow-hidden">
              <div className="flex min-h-0 min-w-0 flex-col p-4">
                <Label htmlFor="draft-content" className="mb-2 text-xs text-muted-foreground">
                  {t("drafts.contentLabel")}
                </Label>
                <textarea
                  id="draft-content"
                  value={selectedDraft.content}
                  onChange={(event) => updateDraft(selectedDraft.id, { content: event.target.value })}
                  placeholder={t("drafts.contentPlaceholder")}
                  className="min-h-0 flex-1 resize-none overflow-y-auto rounded-lg border border-input bg-background p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              <aside className="overflow-y-auto border-l bg-muted/10 p-4">
                <section className="mb-5 rounded-lg border bg-background/70 p-3">
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("drafts.aiProcessingTitle")}
                  </h2>
                  <Label htmlFor="draft-processing-instruction" className="mb-1.5 text-xs text-muted-foreground">
                    {t("drafts.processingInstructionLabel")}
                  </Label>
                  <textarea
                    id="draft-processing-instruction"
                    value={processingInstruction}
                    onChange={(event) => setProcessingInstruction(event.target.value)}
                    placeholder={t("drafts.processingInstructionPlaceholder")}
                    className="min-h-24 w-full resize-none rounded-md border border-input bg-background p-2 text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                  <div className={`mt-2 rounded-md border p-2 text-[11px] leading-relaxed ${
                    activeTemplate
                      ? "border-primary/20 bg-primary/5 text-muted-foreground"
                      : "bg-muted/20 text-muted-foreground"
                  }`}
                  >
                    <div className="font-medium text-foreground">
                      {activeTemplate
                        ? t("drafts.processingTemplateActive", { title: activeTemplate.title })
                        : t("drafts.processingTemplateNone")}
                    </div>
                    <div className="mt-0.5">
                      {activeTemplate
                        ? t("drafts.processingTemplateActiveHint")
                        : t("drafts.processingTemplateNoneHint")}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={!canStartProcessing}
                    onClick={handleStartProcessing}
                  >
                    {activeTemplate
                      ? t("drafts.createTemplateProcessingConversation")
                      : t("drafts.createProcessingConversation")}
                  </Button>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {t("drafts.processingNoOverwriteHint")}
                  </p>
                </section>

                {templateMatchReport && (
                  <section className="mb-5 rounded-lg border bg-background/70 p-3">
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("drafts.templateMatchReport")}
                    </h2>
                    <div className="mb-2 rounded-md bg-muted/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {t("drafts.templateMatchTemplate", { title: templateMatchReport.templateTitle })}
                      </div>
                      <div className="mt-0.5">
                        {t("drafts.templateMatchSummary", templateMatchReport.summary)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {templateMatchReport.items.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-md border p-2 text-[11px] leading-relaxed ${templateMatchSeverityClass(item.severity)}`}
                        >
                          <div className="font-medium">
                            {t(`drafts.templateMatchSeverity.${item.severity}`)} · {item.title}
                          </div>
                          <div className="mt-0.5 opacity-90">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {t("drafts.templateMatchNonBlockingHint")}
                    </p>
                  </section>
                )}

                <section className="mb-5 rounded-lg border bg-background/70 p-3">
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    {t("drafts.versionHistory")}
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleCreateVersionSnapshot}
                  >
                    {t("drafts.createVersionSnapshot")}
                  </Button>
                  {selectedDraft.versions.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {selectedDraft.versions.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => setSelectedVersionId(version.id)}
                          className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${
                            selectedVersionId === version.id
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-background/70 text-muted-foreground hover:bg-accent/50"
                          }`}
                        >
                          <div className="font-medium text-foreground">{formatDate(version.createdAt)}</div>
                          <div className="mt-0.5 break-all text-[10px]">
                            {t(`drafts.versionReason.${version.reason}`)} · {version.contentHash}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">{t("drafts.noVersions")}</p>
                  )}
                  {selectedVersion && versionComparison && (
                    <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{t("drafts.versionCompare")}</div>
                      {versionComparison.tooLarge ? (
                        <p>{t("drafts.versionCompareTooLarge", {
                          current: versionComparison.totalCurrentLines,
                          version: versionComparison.totalVersionLines,
                        })}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <span>{t("drafts.addedLines")}: {versionComparison.addedLines}</span>
                          <span>{t("drafts.removedLines")}: {versionComparison.removedLines}</span>
                          <span>{t("drafts.unchangedLines")}: {versionComparison.unchangedLines}</span>
                          <span>{t("drafts.changedRatio")}: {Math.round(versionComparison.changedRatio * 100)}%</span>
                        </div>
                      )}
                      <div>
                        <div className="mb-1 font-medium text-foreground">{t("drafts.versionPreview")}</div>
                        <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px] leading-relaxed">{selectedVersion.content}</pre>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full gap-1"
                        onClick={handleRestoreVersion}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("drafts.restoreVersionAsDraft")}
                      </Button>
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {t("drafts.references")}
                  </h2>
                  {selectedDraft.references.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedDraft.references.map((ref) => (
                        <div key={`${ref.path}-${ref.title}`} className="rounded-md border bg-background/70 p-2 text-xs">
                          <div className="font-medium text-foreground">{ref.title}</div>
                          <div className="mt-0.5 break-all text-[10px] text-muted-foreground">{ref.path}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("drafts.noReferences")}</p>
                  )}
                </section>

                <section className="mt-5 space-y-2 text-xs text-muted-foreground">
                  <h2 className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t("drafts.source")}
                  </h2>
                  {selectedDraft.restoration ? (
                    <>
                      <div className="font-medium text-foreground">{t("drafts.restoredFromVersion")}</div>
                      <div>{t("drafts.parentDraft")}: {selectedDraft.restoration.parentDraftTitle}</div>
                      <div className="break-all">{t("drafts.parentVersion")}: {selectedDraft.restoration.parentVersionId}</div>
                      <div className="break-all">{t("drafts.parentVersionHash")}: {selectedDraft.restoration.parentContentHash}</div>
                      <div>{t("drafts.restoredAt")}: {formatDate(selectedDraft.restoration.restoredAt)}</div>
                    </>
                  ) : (
                    <div>{t("drafts.fromChat")}</div>
                  )}
                  <div>{t("drafts.created")}: {formatDate(selectedDraft.createdAt)}</div>
                  <div>{t("drafts.updated")}: {formatDate(selectedDraft.updatedAt)}</div>
                  <div className="flex items-center gap-1 break-all">
                    <Hash className="h-3 w-3 shrink-0" />
                    {selectedDraft.source.contentHash}
                  </div>
                </section>

                {selectedDraft.derivation && (
                  <section className="mt-5 space-y-2 text-xs text-muted-foreground">
                    <h2 className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("drafts.derivedFromDraft")}
                    </h2>
                    <div>{t("drafts.parentDraft")}: {selectedDraft.derivation.parentDraftTitle}</div>
                    <div>{t("drafts.processingInstruction")}: {selectedDraft.derivation.instruction}</div>
                  </section>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
