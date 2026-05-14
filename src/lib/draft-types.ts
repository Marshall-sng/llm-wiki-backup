import type { MessageReference } from "@/lib/format-profile-types"
import type { DraftVersion } from "@/lib/draft-versioning"

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
  formatProfileId?: string
  formatProfileTitle?: string
}

export interface DraftRestorationMeta {
  parentDraftId: string
  parentDraftTitle: string
  parentVersionId: string
  parentContentHash: string
  restoredAt: number
}

export interface DraftRecord {
  id: string
  title: string
  content: string
  references: MessageReference[]
  source: DraftSourceMeta
  derivation?: DraftDerivationMeta
  versions: DraftVersion[]
  restoration?: DraftRestorationMeta
  createdAt: number
  updatedAt: number
}
