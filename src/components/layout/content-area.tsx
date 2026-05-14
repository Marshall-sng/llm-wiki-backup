import { useWikiStore } from "@/stores/wiki-store"
import { ChatPanel } from "@/components/chat/chat-panel"
import { SettingsView } from "@/components/settings/settings-view"
import { SourcesView } from "@/components/sources/sources-view"
import { ReviewView } from "@/components/review/review-view"
import { LintView } from "@/components/lint/lint-view"
import { SearchView } from "@/components/search/search-view"
import { GraphView } from "@/components/graph/graph-view"
import { DraftsView } from "@/components/drafts/drafts-view"
import { FormatProfilesView } from "@/components/format-profiles/format-profiles-view"

export function ContentArea() {
  const activeView = useWikiStore((s) => s.activeView)

  switch (activeView) {
    case "settings":
      return <SettingsView />
    case "sources":
      return <SourcesView />
    case "review":
      return <ReviewView />
    case "drafts":
      return <DraftsView />
    case "formatProfiles":
      return <FormatProfilesView />
    case "lint":
      return <LintView />
    case "search":
      return <SearchView />
    case "graph":
      return <GraphView />
    default:
      return <ChatPanel />
  }
}
