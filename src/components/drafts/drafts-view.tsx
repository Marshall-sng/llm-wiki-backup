import { useEffect, useMemo } from "react"
import { FileText, Trash2, MessageSquare, Hash } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDraftStore } from "@/stores/draft-store"

function formatDate(ts: number): string {
  if (!Number.isFinite(ts)) return ""
  return new Date(ts).toLocaleString()
}

export function DraftsView() {
  const { t } = useTranslation()
  const drafts = useDraftStore((s) => s.drafts)
  const selectedDraftId = useDraftStore((s) => s.selectedDraftId)
  const selectDraft = useDraftStore((s) => s.selectDraft)
  const updateDraft = useDraftStore((s) => s.updateDraft)
  const deleteDraft = useDraftStore((s) => s.deleteDraft)

  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => b.updatedAt - a.updatedAt),
    [drafts],
  )
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null

  useEffect(() => {
    if (!selectedDraft && sortedDrafts[0]) {
      selectDraft(sortedDrafts[0].id)
    }
  }, [selectDraft, selectedDraft, sortedDrafts])

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

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-w-0 flex-col p-4">
                <Label htmlFor="draft-content" className="mb-2 text-xs text-muted-foreground">
                  {t("drafts.contentLabel")}
                </Label>
                <textarea
                  id="draft-content"
                  value={selectedDraft.content}
                  onChange={(event) => updateDraft(selectedDraft.id, { content: event.target.value })}
                  placeholder={t("drafts.contentPlaceholder")}
                  className="min-h-0 flex-1 resize-none rounded-lg border border-input bg-background p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              <aside className="border-l bg-muted/10 p-4">
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
                  <div>{t("drafts.fromChat")}</div>
                  <div>{t("drafts.created")}: {formatDate(selectedDraft.createdAt)}</div>
                  <div>{t("drafts.updated")}: {formatDate(selectedDraft.updatedAt)}</div>
                  <div className="flex items-center gap-1 break-all">
                    <Hash className="h-3 w-3 shrink-0" />
                    {selectedDraft.source.contentHash}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
