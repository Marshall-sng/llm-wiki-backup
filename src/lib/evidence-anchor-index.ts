import type { EvidenceAnchor, EvidenceRef } from "./source-sidecar-types"
import { makeEvidenceRef } from "./source-sidecar-types"

export interface EvidenceAnchorIndex {
  byAnchorId: Map<string, EvidenceAnchor>
  bySourceId: Map<string, EvidenceAnchor[]>
}

export function buildEvidenceAnchorIndex(anchors: EvidenceAnchor[]): EvidenceAnchorIndex {
  const byAnchorId = new Map<string, EvidenceAnchor>()
  const bySourceId = new Map<string, EvidenceAnchor[]>()

  for (const anchor of anchors) {
    byAnchorId.set(anchor.anchor_id, anchor)
    const sourceAnchors = bySourceId.get(anchor.source_id) ?? []
    sourceAnchors.push(anchor)
    bySourceId.set(anchor.source_id, sourceAnchors)
  }

  return { byAnchorId, bySourceId }
}

export function evidenceRefForAnchorId(index: EvidenceAnchorIndex, anchorId: string): EvidenceRef | undefined {
  const anchor = index.byAnchorId.get(anchorId)
  return anchor ? makeEvidenceRef(anchor) : undefined
}
