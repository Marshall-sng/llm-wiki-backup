# Test Spec: Draft / 底稿 v1

## Unit
- Draft store creates a draft from a full DisplayMessage and copies references/source metadata.
- Store update/delete/select behavior is deterministic.
- Persistence loads missing/corrupt files as empty and roundtrips versioned drafts.

## Integration
- App project hydration loads drafts silently.
- Reset clears drafts without triggering cross-project writes.
- Autosave guards project path for debounced edits and flushes create/delete.

## UI
- Assistant messages show Set as Draft; user messages do not.
- Drafts route renders list/detail/empty states.
- Draft references render from copied references, not transient chat state.

## Verification commands
- Targeted Vitest for draft store/persist/i18n.
- `npm run build`.
