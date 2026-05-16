import { useEffect, useMemo, useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { CheckCircle2, FileUp, Layers3, Trash2, X, AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { readFile, probeFormatProfile } from "@/commands/fs"
import { buildFormatProfileSnapshot, summarizeFormatDiagnostics } from "@/lib/format-profile"
import { importFormatProfileFromPath } from "@/lib/format-profile-import"
import { buildFormatSpecAuditView } from "@/lib/format-spec"
import { useFormatProfileStore } from "@/stores/format-profile-store"
import { useWikiStore } from "@/stores/wiki-store"
import { deriveSemanticOverlayStatus, semanticOverlaySummaryLines } from "@/lib/format-profile-semantic-overlay"
import { hasUsableLlm } from "@/lib/has-usable-llm"

function formatDate(ts: number): string {
  if (!Number.isFinite(ts)) return ""
  return new Date(ts).toLocaleString()
}

function confidenceClass(confidence: string): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "medium":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function shortHash(hash?: string): string {
  return hash ? hash.slice(0, 12) : "n/a"
}

export function FormatProfilesView() {
  const { t } = useTranslation()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const llmConfig = useWikiStore((s) => s.llmConfig)
  const profiles = useFormatProfileStore((s) => s.profiles)
  const selectedProfileId = useFormatProfileStore((s) => s.selectedProfileId)
  const activeProfileId = useFormatProfileStore((s) => s.activeProfileId)
  const addProfile = useFormatProfileStore((s) => s.addProfile)
  const deleteProfile = useFormatProfileStore((s) => s.deleteProfile)
  const selectProfile = useFormatProfileStore((s) => s.selectProfile)
  const setActiveProfile = useFormatProfileStore((s) => s.setActiveProfile)
  const runSemanticOverlay = useFormatProfileStore((s) => s.runSemanticOverlay)
  const saveEditableFormatSpec = useFormatProfileStore((s) => s.saveEditableFormatSpec)
  const resetEditableFormatSpec = useFormatProfileStore((s) => s.resetEditableFormatSpec)
  const [editingFormatSpec, setEditingFormatSpec] = useState(false)
  const [formatSpecDraft, setFormatSpecDraft] = useState("")

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.updatedAt - a.updatedAt),
    [profiles],
  )
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? sortedProfiles[0] ?? null
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null
  const selectedFormatSpecSnapshot = useMemo(
    () => selectedProfile ? buildFormatProfileSnapshot(selectedProfile) : null,
    [selectedProfile],
  )
  const selectedFormatSpecAudit = useMemo(
    () => selectedFormatSpecSnapshot
      ? buildFormatSpecAuditView(selectedFormatSpecSnapshot.formatSpec, {
        sourceProfileHash: selectedFormatSpecSnapshot.sourceProfileHash,
        formatSpecHash: selectedFormatSpecSnapshot.formatSpecHash,
        legacyGenerationInstruction: selectedFormatSpecSnapshot.legacyGenerationInstruction,
      })
      : null,
    [selectedFormatSpecSnapshot],
  )
  const diagnosticsSummary = selectedProfile ? summarizeFormatDiagnostics(selectedProfile) : null
  const providerUsable = hasUsableLlm(llmConfig)
  const semanticStatus = selectedProfile ? deriveSemanticOverlayStatus(selectedProfile, providerUsable) : "not-configured"
  const semanticSummary = selectedProfile ? semanticOverlaySummaryLines(selectedProfile, 6) : []

  useEffect(() => {
    setEditingFormatSpec(false)
    setFormatSpecDraft(selectedFormatSpecSnapshot?.formatSpec.promptBlock ?? "")
  }, [selectedProfile?.id, selectedFormatSpecSnapshot?.formatSpecHash])

  const handleImport = async () => {
    setError(null)
    setDeleteConfirmId(null)
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Finished documents", extensions: ["docx", "xlsx", "pptx", "pdf"] }],
    })
    if (!selected || Array.isArray(selected)) return

    setImporting(true)
    try {
      const profile = await importFormatProfileFromPath(selected, { readFile, probeFormatProfile })
      addProfile(profile)
      selectProfile(profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = () => {
    if (!selectedProfile) return
    if (deleteConfirmId !== selectedProfile.id) {
      setDeleteConfirmId(selectedProfile.id)
      return
    }
    deleteProfile(selectedProfile.id)
    setDeleteConfirmId(null)
  }

  const handleSemanticOverlay = async () => {
    if (!selectedProfile) return
    setError(null)
    setRefiningId(selectedProfile.id)
    try {
      await runSemanticOverlay(selectedProfile.id, llmConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefiningId(null)
    }
  }

  const handleSaveFormatSpecDraft = () => {
    if (!selectedProfile || !selectedFormatSpecSnapshot) return
    saveEditableFormatSpec(selectedProfile.id, selectedFormatSpecSnapshot.formatSpecHash, formatSpecDraft)
    setEditingFormatSpec(false)
  }

  const handleResetFormatSpecDraft = () => {
    if (!selectedProfile) return
    resetEditableFormatSpec(selectedProfile.id)
    setEditingFormatSpec(false)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r bg-muted/20">
        <div className="border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold">{t("formatProfiles.title")}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("formatProfiles.count", { count: profiles.length })}
              </p>
            </div>
            <Button type="button" size="icon-sm" variant="outline" onClick={handleImport} title={t("formatProfiles.import")} disabled={importing}>
              <FileUp className="h-3.5 w-3.5" />
            </Button>
          </div>
          {activeProfile && (
            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
              <div className="font-medium text-foreground">{t("formatProfiles.currentProfile")}</div>
              <div className="mt-0.5 line-clamp-2 text-muted-foreground">{activeProfile.title}</div>
            </div>
          )}
        </div>
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="p-2">
            {sortedProfiles.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                <Layers3 className="mx-auto mb-2 h-7 w-7 opacity-60" />
                <div className="font-medium text-foreground">{t("formatProfiles.emptyTitle")}</div>
                <p className="mt-1 leading-relaxed">{t("formatProfiles.emptyHint")}</p>
                {error && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-left text-[11px] text-destructive">
                    {error}
                  </div>
                )}
                <Button type="button" className="mt-3" size="sm" onClick={handleImport} disabled={importing}>
                  <FileUp className="h-3.5 w-3.5" />
                  {importing ? t("formatProfiles.importing") : t("formatProfiles.import")}
                </Button>
              </div>
            ) : sortedProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectProfile(profile.id)}
                className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                  selectedProfile?.id === profile.id
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-medium">{profile.title}</div>
                    <div className="mt-1 text-[10px] opacity-70">{profile.fileType.toUpperCase()} · {formatDate(profile.updatedAt)}</div>
                  </div>
                  {profile.id === activeProfileId && (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {selectedProfile ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{selectedProfile.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedProfile.sourceName} · {selectedProfile.fileType.toUpperCase()} · {t(`formatProfiles.confidence.${selectedProfile.confidence}`)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedProfile.id === activeProfileId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveProfile(null)}>
                    <X className="h-3.5 w-3.5" />
                    {t("formatProfiles.clearCurrent")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveProfile(selectedProfile.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("formatProfiles.setCurrent")}
                  </Button>
                )}
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleteConfirmId === selectedProfile.id ? t("formatProfiles.deleteAgain") : t("formatProfiles.delete")}
                </Button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 overflow-hidden">
              <div className="mx-auto max-w-5xl space-y-4 p-4">
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {error}
                  </div>
                )}
                <div className="rounded-lg border bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  <div className="font-medium text-foreground">{t("formatProfiles.scopeTitle")}</div>
                  <p className="mt-1">{t("formatProfiles.scopeHint")}</p>
                </div>

                <section className="rounded-lg border bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 text-xs">
                      <h3 className="font-semibold text-foreground">{t("formatProfiles.semanticOverlay.title")}</h3>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        {t(`formatProfiles.semanticOverlay.status.${semanticStatus}`)}
                      </p>
                      {selectedProfile.semanticOverlay?.fallbackReason && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {t("formatProfiles.semanticOverlay.fallbackReason", {
                            reason: t(`formatProfiles.semanticOverlay.fallback.${selectedProfile.semanticOverlay.fallbackReason}`, {
                              defaultValue: selectedProfile.semanticOverlay.fallbackReason,
                            }),
                          })}
                        </p>
                      )}
                      {selectedProfile.semanticOverlay?.fallbackMessage && (
                        <p className="mt-1 break-words rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                          {selectedProfile.semanticOverlay.fallbackMessage}
                        </p>
                      )}
                      {selectedProfile.semanticOverlay?.evaluatorReport?.violations.length ? (
                        <details className="mt-2 rounded border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer font-medium text-foreground">
                            校验详情（{selectedProfile.semanticOverlay.evaluatorReport.violations.length} 项）
                          </summary>
                          <div className="mt-2 space-y-1">
                            <div>
                              evidenceRefCoverage: {selectedProfile.semanticOverlay.evaluatorReport.evidenceRefCoverage}
                            </div>
                            {selectedProfile.semanticOverlay.evaluatorReport.violations.slice(0, 12).map((item, index) => (
                              <div key={`${item.code}-${item.claimId ?? "root"}-${index}`} className="break-words font-mono text-[10px]">
                                {index + 1}. {item.code}{item.claimId ? ` / ${item.claimId}` : ""}: {item.message}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSemanticOverlay}
                      disabled={!providerUsable || semanticStatus === "running" || refiningId === selectedProfile.id}
                    >
                      {semanticStatus === "accepted" ? t("formatProfiles.semanticOverlay.refresh") : t("formatProfiles.semanticOverlay.run")}
                    </Button>
                  </div>
                  {semanticSummary.length > 0 && (
                    <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted/20 p-2 pr-1 text-xs text-muted-foreground">
                      {semanticSummary.map((item, index) => (
                        <li key={`${item}-${index}`} className="break-words">- {item}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-background/70 p-3 text-xs">
                    <div className="text-muted-foreground">{t("formatProfiles.documentKind")}</div>
                    <div className="mt-1 font-medium">{selectedProfile.documentKind}</div>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-3 text-xs">
                    <div className="text-muted-foreground">{t("formatProfiles.sectionPattern")}</div>
                    <div className="mt-1 font-medium">{selectedProfile.structureProfile.sectionPattern}</div>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-3 text-xs">
                    <div className="text-muted-foreground">{t("formatProfiles.confidenceLabel")}</div>
                    <div className={`mt-1 inline-flex rounded px-2 py-0.5 font-medium ${confidenceClass(selectedProfile.confidence)}`}>
                      {t(`formatProfiles.confidence.${selectedProfile.confidence}`)}
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border bg-background/70 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formatProfiles.sections")}</h3>
                  {selectedProfile.structureProfile.sections.length > 0 ? (
                    <ol className="max-h-80 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                      {selectedProfile.structureProfile.sections.map((section, index) => (
                        <li key={`${section.title}-${index}`} className="flex items-start gap-2 rounded-md bg-muted/30 px-2 py-1">
                          <span className="min-w-0 flex-1 break-words font-medium text-foreground">{index + 1}. {section.title}</span>
                          <span className="shrink-0 text-muted-foreground/70">{section.evidence}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("formatProfiles.noSections")}</p>
                  )}
                </section>

                <section className="rounded-lg border bg-background/70 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formatProfiles.styleEvidence")}</h3>
                  <div className="mb-3 space-y-1 rounded-md border border-primary/15 bg-primary/5 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    <div>{t("formatProfiles.styleFactsBoundary")}</div>
                    <div>{semanticStatus === "accepted" ? t("formatProfiles.semanticOverlay.acceptedBoundary") : t("formatProfiles.styleFactsNoLlm")}</div>
                    {selectedProfile.styleFacts && (
                      <div className="break-words font-mono text-[10px] opacity-80">
                        {selectedProfile.styleFacts.schemaVersion} · {selectedProfile.styleFacts.metadata.styleFactsSha256.slice(0, 12)} · evidence-only
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-md bg-muted/20 p-2">
                      <div className="mb-1 text-[11px] font-medium text-foreground">{t("formatProfiles.styleSummary")}</div>
                      <ul className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                        {(selectedProfile.styleProfile.evidenceSummary ?? []).map((item, index) => (
                          <li key={`${item}-${index}`} className="break-words">- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="min-w-0 rounded-md bg-muted/20 p-2">
                      <div className="mb-1 text-[11px] font-medium text-foreground">{t("formatProfiles.structureEvidence")}</div>
                      <ul className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                        {selectedProfile.structureProfile.evidenceSummary.map((item, index) => (
                          <li key={`${item}-${index}`} className="break-words">- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {selectedProfile.styleFacts && (
                    <details className="mt-3 rounded-md border bg-muted/10 p-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">{t("formatProfiles.styleFactsEvidenceDetails", { count: selectedProfile.styleFacts.evidence.length })}</summary>
                      <div className="mt-2 max-h-56 min-w-0 space-y-1 overflow-y-auto pr-1">
                        {selectedProfile.styleFacts.evidence.map((item) => (
                          <div key={item.id} className="min-w-0 rounded bg-background/70 p-2">
                            <div className="break-words font-mono text-[10px] text-foreground">{item.id}</div>
                            <div className="mt-0.5 break-words">{item.kind} · {item.pointer} · {item.confidence}</div>
                            <div className="break-words font-mono text-[10px] opacity-70">sha256:{item.sha256.slice(0, 16)}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </section>

                {selectedFormatSpecAudit && (
                  <section className="rounded-lg border border-primary/15 bg-background/70 p-3">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FormatSpec 审计</h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          当前底稿加工主链路实际使用的格式约束。默认 evidence-only；不发送全文、片段或 raw evidence；不承诺导出或视觉还原。
                        </p>
                      </div>
                      <div className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">
                        {shortHash(selectedFormatSpecAudit.formatSpecHash)}
                      </div>
                    </div>

                    <div className="mb-3 grid gap-2 text-[11px] md:grid-cols-4">
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-muted-foreground">来源格式</div>
                        <div className="mt-0.5 font-medium text-foreground">{selectedFormatSpecAudit.sourceFileType.toUpperCase()}</div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-muted-foreground">文档定位</div>
                        <div className="mt-0.5 font-medium text-foreground">{selectedFormatSpecAudit.documentIntent}</div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-muted-foreground">Renderer</div>
                        <div className="mt-0.5 break-words font-mono text-[10px] text-foreground">{selectedFormatSpecAudit.rendererVersion}</div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-muted-foreground">Policy</div>
                        <div className="mt-0.5 break-words font-mono text-[10px] text-foreground">{selectedFormatSpecAudit.policyVersion}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="min-w-0 rounded-md bg-muted/20 p-2">
                        <div className="mb-1 text-[11px] font-medium text-foreground">摘要</div>
                        <ul className="max-h-32 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                          {selectedFormatSpecAudit.summaryLines.map((item, index) => (
                            <li key={`${item}-${index}`} className="break-words">- {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="min-w-0 rounded-md bg-muted/20 p-2">
                        <div className="mb-1 text-[11px] font-medium text-foreground">必守边界</div>
                        <ul className="max-h-32 space-y-1 overflow-y-auto pr-1 text-xs text-muted-foreground">
                          {selectedFormatSpecAudit.boundaries.map((item, index) => (
                            <li key={`${item}-${index}`} className="break-words">- {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-3 rounded-md bg-muted/20 p-2">
                      <div className="mb-2 text-[11px] font-medium text-foreground">规则分组</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedFormatSpecAudit.rulesByTarget.map((group) => (
                          <details key={group.target} className="rounded border bg-background/70 p-2 text-xs">
                            <summary className="cursor-pointer font-medium text-foreground">
                              {group.target} · {group.rules.length}
                            </summary>
                            <div className="mt-2 space-y-1 text-muted-foreground">
                              {group.rules.map((item) => (
                                <div key={item.id} className="rounded bg-muted/30 p-2">
                                  <div className="font-medium text-foreground">{item.rule}</div>
                                  <div className="mt-0.5 break-words">{item.detail}</div>
                                  {item.attributes?.length ? (
                                    <div className="mt-1 space-y-0.5 rounded bg-background/60 p-1">
                                      {item.attributes.slice(0, 6).map((attribute) => (
                                        <div key={`${item.id}-${attribute.name}`} className="break-words text-[10px]">
                                          <span className="font-medium text-foreground">{attribute.name}</span>
                                          <span>：{attribute.value}{attribute.unit ? ` ${attribute.unit}` : ""}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div className="mt-0.5 font-mono text-[10px] opacity-70">{item.source} · {item.confidence}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>

                    <details className="mt-3 rounded-md border bg-muted/10 p-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">查看审计文本 / 实际发送约束</summary>
                      <p className="mt-2 text-[11px] leading-relaxed">
                        以下是发送给模型的格式约束文本，仅用于审计；不代表导出、视觉复刻或高保真承诺。
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setFormatSpecDraft(selectedFormatSpecAudit.promptBlock)
                          setEditingFormatSpec(true)
                        }}>
                          编辑格式约束
                        </Button>
                        {selectedProfile.editableFormatSpec && (
                          <Button size="sm" variant="outline" onClick={handleResetFormatSpecDraft}>
                            重置为自动约束
                          </Button>
                        )}
                      </div>
                      {selectedProfile.editableFormatSpec && (
                        <p className="mt-2 rounded bg-primary/10 p-2 text-[11px] text-primary">
                          当前底稿加工将优先使用用户编辑后的格式约束。
                        </p>
                      )}
                      {editingFormatSpec && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            className="min-h-64 w-full rounded-md border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground"
                            value={formatSpecDraft}
                            onChange={(event) => setFormatSpecDraft(event.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={handleSaveFormatSpecDraft} disabled={!formatSpecDraft.trim()}>
                              保存编辑版
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingFormatSpec(false)
                              setFormatSpecDraft(selectedFormatSpecAudit.promptBlock)
                            }}>
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/70 p-3 text-[11px] leading-relaxed">
                        {selectedFormatSpecAudit.promptBlock}
                      </pre>
                    </details>
                  </section>
                )}

                <section className="rounded-lg border bg-background/70 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formatProfiles.diagnostics")}</h3>
                  {diagnosticsSummary && (
                    <div className="mb-2 text-[11px] text-muted-foreground">
                      {t("formatProfiles.diagnosticsSummary", diagnosticsSummary)}
                    </div>
                  )}
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {selectedProfile.diagnostics.map((item) => (
                      <div key={item.id} className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t(`formatProfiles.severity.${item.severity}`)} · {item.message}
                        </div>
                        {item.recommendation && <div className="mt-0.5">{item.recommendation}</div>}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-background/70 p-3">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">兼容生成约束</h3>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    兼容展示，不参与新的底稿加工主链路；当前主链路以 FormatSpec 为准。
                  </p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    {selectedProfile.writingProfile.generationInstruction}
                  </pre>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("formatProfiles.noSelection")}
          </div>
        )}
      </main>
    </div>
  )
}
