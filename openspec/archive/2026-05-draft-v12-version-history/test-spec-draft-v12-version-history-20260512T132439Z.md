# Test Spec: Draft v1.2「底稿版本历史 + 基础对比」

## Unit tests

### `src/lib/draft-versioning.test.ts`

- `buildDraftVersion` copies title/content/contentHash/references/reason.
- `buildDraftVersion` deep-copies references.
- `compareDraftText` returns zero changes for identical text.
- `compareDraftText` counts pure additions.
- `compareDraftText` counts pure removals.
- `compareDraftText` handles duplicate lines deterministically via LCS.
- `compareDraftText` handles empty current/version text.
- `compareDraftText` returns `tooLarge: true` when combined lines exceed threshold.

### `src/stores/draft-store.test.ts`

- Legacy drafts normalize to runtime `versions: []`.
- `createDraftFromMessage` creates drafts with `versions: []`.
- `createVersionSnapshot` creates an immutable snapshot of current title/content/references/hash.
- Snapshot creation updates parent `updatedAt` and sets `lastChange.persist` to `immediate`.
- `updateDraft` does not auto-create a version.
- `restoreVersionAsDraft` creates a new selected Draft and does not overwrite parent.
- Restored Draft content exactly equals version content.
- Restored Draft deep-copies references.
- Restored Draft has `restoration` metadata.
- Restored Draft source copies parent source but recalculates contentHash.
- Hydration preserves and normalizes versions/restoration.

### `src/i18n/i18n-parity.test.ts`

- New version-history/restoration keys exist in zh/en.

## Integration-ish tests

### `src/lib/draft-persist.test.ts` if needed

- Saving/loading drafts with versions/restoration preserves data through envelope v1.
- Legacy array/envelope formats still load.

## Manual smoke

1. Create a Draft from assistant reply.
2. Open Drafts page.
3. Click「创建版本快照」.
4. Edit the draft content.
5. Select the saved version and confirm comparison summary appears.
6. Click「恢复为新底稿」.
7. Confirm a new Draft is selected.
8. Confirm original Draft remains changed and restored Draft equals historical version.
9. Confirm restored Draft shows「由历史版本恢复生成」.

## Verification commands

```powershell
npx vitest run src/lib/draft-versioning.test.ts src/stores/draft-store.test.ts src/i18n/i18n-parity.test.ts
npm run typecheck
npm run test:mocks
npm run build
```
