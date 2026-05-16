# RALPLAN Slice D — UI / Store / Tauri DOCX Save Flow

## Requirements Summary

Connect the Slice C `writeDocxExport` library writer to a desktop-visible export action. The flow must let the user choose a `.docx` path, write bytes only after that explicit choice, show warning/failure diagnostics, and never claim high-fidelity or Word-openability guarantees. It must not revive the abandoned manual-template route and must not auto-overwrite user files without an OS save dialog.

## Evidence Snapshot

- Slice C product writer is available at `src/lib/docx-writer.ts` and returns `{ contract, intermediate, adapterResult, review, record, bytes }`.
- Draft UI entry point is `src/components/drafts/drafts-view.tsx`.
- Active format profile snapshot can be built via `buildDraftFormatProfileSnapshot(activeProfile)` in the same DraftsView processing path.
- Existing Tauri text write command is `write_file`; binary DOCX requires a binary-safe command because string writing can corrupt ZIP bytes.
- `base64` is already a Rust dependency and `read_file_as_base64` exists, so a symmetric `write_binary_file_base64` command is the narrowest binary-safe Tauri addition.
- Tauri dialog plugin is already installed and permitted; use `save` from `@tauri-apps/plugin-dialog`.

## Design Decision

Implement Slice D as a direct DraftsView export action plus a binary-safe Tauri command.

### Product flow

1. User opens Drafts view and selects a draft.
2. User clicks `导出 DOCX`.
3. App opens OS save dialog with default filename derived from draft title and `.docx` extension.
4. If user cancels, do nothing and show a non-error idle/cancel status.
5. Write only the exact path returned by the save dialog. If the returned path does not end with `.docx` (case-insensitive), do not append a new path silently; instead block the write and ask the user to choose a `.docx` file name again.
6. If user chooses a valid `.docx` path, app runs `writeDocxExport` with the selected active format profile snapshot.
7. If `review.verdict === "fail"`, do not write bytes; show blocking diagnostic.
8. If `review.verdict === "warn"`, write bytes and show warning status, including that manual Word openability/high-fidelity replica are not guaranteed.
9. If `review.verdict === "pass"`, write bytes and show success status.
10. If the Tauri binary write fails, override any previous pass/warn status with failure; do not show success/warning as completed.
11. Disable the export button while an export is running to prevent concurrent writes and stale status.

### Files to modify/add

- Add `src/lib/docx-export-save.ts`
  - filename sanitization and default `.docx` name;
  - exact `.docx` path validation without silently appending a new output path after save dialog returns;
  - chunk-safe, binary-exact `Uint8Array` -> base64 conversion; no spread-based large array conversion;
  - injectable `runDocxExportSaveFlow` helper for save-dialog/writer/write-command orchestration tests;
  - user-facing status summary helpers.
- Add `src/lib/docx-export-save.test.ts`
  - filename and base64 behavior;
  - large byte-array roundtrip behavior;
  - cancel/fail/warn/pass/write-error gating with injected dependencies;
  - active profile snapshot forwarding.
- Modify `src/commands/fs.ts`
  - add `writeBinaryFileBase64(path, contentsBase64)` wrapper.
- Modify `src-tauri/src/commands/fs.rs`
  - add `write_binary_file_base64` command using existing `base64` crate and `fs::write`.
  - call `file_sync::mark_app_write_path(p)` before and after writing, matching existing `write_file`, so app-created export files do not trigger unintended ingest if saved under a watched project path.
  - decode base64 before opening/writing the target; invalid base64 must return an error and must not create, truncate, overwrite, or otherwise modify the target file.
  - add Rust unit tests for binary-exact write, invalid-base64 no-side-effect on missing path, invalid-base64 no-side-effect on existing path, and app-write marker behavior.
- Modify `src-tauri/src/lib.rs`
  - register the command.
- Modify `src/components/drafts/drafts-view.tsx`
  - add export state and button in the right-side panel;
  - use `save` dialog and `writeBinaryFileBase64`;
  - show warning/failure/success diagnostics.
- Modify `src/i18n/zh.json` and `src/i18n/en.json`
  - add labels/messages; parity test must pass.

### Explicitly out of scope

- No automatic path selection.
- No silent overwrite.
- No template DOCX import or manual input template route.
- No high-fidelity/visual replica claim.
- No XLSX/PPTX export in Slice D.
- No file sync ingest of exported DOCX unless the user later imports it manually; binary command must mark app-written paths for watcher ignore.

## Acceptance Criteria

- User-visible DraftsView has a DOCX export action for the selected draft.
- Export opens OS save dialog before writing; cancel writes nothing.
- Binary bytes are written through a binary-safe Tauri command, not `write_file` text writing.
- Binary command marks app-written paths with `file_sync::mark_app_write_path` before and after writing.
- Returned save path must already be `.docx`; no silent post-dialog path mutation that bypasses OS overwrite confirmation.
- Failed review blocks writing.
- Warnings write the file but remain visible as warnings.
- Tauri write errors show failure and do not show success/warning completion.
- Export button is disabled while the flow is running.
- Active format profile snapshot is passed to `writeDocxExport` when present.
- UI does not promise high-fidelity replica or manual Word openability.
- `npm run typecheck`, targeted Vitest, i18n parity, and `npm run build` pass.
- Rust command compiles through `npm run tauri build` only if practical; if too slow, run `cargo check --manifest-path src-tauri/Cargo.toml` as a narrower compile gate.

## Verification Plan

```powershell
npx vitest run src/lib/docx-export-save.test.ts src/lib/docx-package-probe.test.ts src/lib/docx-ts-adapter.test.ts src/lib/docx-writer.test.ts src/i18n/i18n-parity.test.ts --reporter=verbose
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml write_binary_file_base64
npm run build
```

## Architecture Review Checklist

- `write_binary_file_base64` only writes a path explicitly returned by save dialog.
- `write_binary_file_base64` uses file-sync app-write ignore markers.
- No UI path auto-generation beyond save dialog default name.
- No overwrite bypass code such as pre-creating/deleting target files.
- No silent `.docx` extension append after the OS dialog returns.
- Save-flow tests prove cancel and fail do not write.
- Rust tests prove binary-exact write, invalid-base64 no-side-effect, and file-sync app-write marker behavior.
- No product code imports experiments.
- No manual-template/high-fidelity promise in labels/messages.
- Diagnostics clearly distinguish success/warning/failure.

## Stop Condition

Stop Slice D when the desktop export path is implemented, verified, architecture-reviewed, and recorded. Do not continue to fidelity improvement, XLSX/PPTX, or further UI polishing before human desktop testing.
