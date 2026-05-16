# RALPLAN: Merge upstream 0.4.9 into song-dev without feature loss

Status: Final approved ralplan artifact  
Context snapshot: .omx/context/upstream-049-merge-strategy-20260512T034555Z.md  
Branch baseline: song-dev @ 336292c  
Upstream target: upstream/main @ 76e5a80 (v0.4.9)  
Merge base: cddc1b7 (v0.4.7)

## Requirements Summary

Merge upstream 0.4.9 into the local development line while preserving local additions and absorbing upstream additions. The merge must be done on an integration branch first, with no blanket `-X ours` or `-X theirs` strategy. The final result must contain no conflict markers, pass tests/build, and keep these feature groups intact:

### Local features that must survive
- Draft v1: `src/stores/draft-store.ts`, `src/lib/draft-persist.ts`, `src/components/drafts/drafts-view.tsx`, chat action in `src/components/chat/chat-message.tsx`, Drafts nav in `src/components/layout/icon-sidebar.tsx`, route in `src/components/layout/content-area.tsx`, hydration in `src/App.tsx`, autosave/reset hooks in `src/lib/auto-save.ts` and `src/lib/reset-project-state.ts`.
- Web Access: `src/lib/web-access/*`, `src/commands/web-access.ts`, `src-tauri/src/commands/web_access.rs`, `webAccessConfig` in `src/stores/wiki-store.ts` and `src/lib/project-store.ts`, and the Web Access settings UI in `src/components/settings/sections/web-search-section.tsx`.
- MarkItDown/source conversion: `src/lib/source-conversion.ts`, `loadSourceForIngest` in `src/lib/ingest.ts`, frontend commands `convertWithMarkitdown` and `fileModifiedMs` in `src/commands/fs.ts`, Rust commands in `src-tauri/src/commands/fs.rs`, and converted-cache deletion behavior.
- Local Chinese/default-zh behavior and Chinese UI copy where already intentional, including `src/lib/project-store.ts` language behavior.

### Upstream features that must be absorbed
- Project file sync watcher: `src-tauri/src/commands/file_sync.rs`, `src/commands/file-sync.ts`, `src/lib/project-file-sync.ts`, `src/stores/file-sync-store.ts`, startup/reset integration in `src/App.tsx` and `src/lib/reset-project-state.ts`.
- Source lifecycle refactor and cleanup fixes: `src/lib/source-lifecycle.ts`, simplified `src/components/sources/sources-view.tsx`, source cleanup tests.
- SearXNG search provider: `searxng` provider type, `SearXngCategory`, `SEARXNG_CATEGORY_OPTIONS`, SearXNG URL/categories in store/settings, and `src/lib/web-search.ts` tests.
- GPT-5/o-series OpenAI strict completion compatibility in `src/lib/llm-providers.ts`.
- Windows path and filesystem fixes in `src/lib/ingest.ts`, `src-tauri/src/commands/fs.rs`, and `src-tauri/windows-app-manifest.xml`.
- Version/docs updates to v0.4.9, including README updates and `README_JA.md`.

## RALPLAN-DR Summary

### Principles
1. **Feature union over side choice**: every conflict must be resolved as an intentional union of local and upstream behavior, not by choosing an entire side.
2. **Integrate at boundaries first**: stores, project lifecycle, command registries, and persistence boundaries should be resolved before UI views depending on them.
3. **Prefer upstream refactors where they reduce surface area**: especially source lifecycle, where upstream moved logic out of `sources-view.tsx` into `source-lifecycle.ts`.
4. **Keep project-switch safety invariants**: draft autosave, ingest queues, dedup queues, graph cache, and file sync watcher must not leak between projects.
5. **Verify by feature families**: tests must separately prove Draft, WebAccess/search, source lifecycle/file sync, source conversion/ingest, and full app build.

### Decision Drivers
1. **No feature regression** across four local additions and five upstream additions.
2. **Conflict containment** by resolving shared foundation files before dependent UI files.
3. **Low-risk rollback** through a temporary integration branch and pre-merge safety branch.

### Viable Options

#### Option A — Merge upstream into a temporary integration branch, resolve conflicts by file-family union (recommended)
Approach: create `song-dev-before-upstream-0.4.9`, then `song-dev-merge-upstream-0.4.9`, run `git merge --no-commit --no-ff upstream/main`, resolve conflicts manually by feature family, run targeted then full verification, then merge or fast-forward into `song-dev` after approval.

Pros:
- Preserves full local branch context and produces a normal merge commit documenting upstream integration.
- Lets conflict files be resolved with both sides present in the index.
- Keeps current `song-dev` safe until verification succeeds.

Cons:
- Requires careful manual resolution in high-conflict files such as `web-search-section.tsx`, `sources-view.tsx`, and Rust command registries.
- Larger review diff because local and upstream changes meet in one integration commit.

#### Option B — Rebase local commits onto upstream/main on a temporary branch
Approach: create a new branch from `upstream/main`, cherry-pick local commits `6670afd`, `fb8bbfa`, `336292c`, resolving conflicts commit-by-commit.

Pros:
- Smaller conflict scope per commit.
- Final history is linear and may be easier to bisect.

Cons:
- Local baseline commit `6670afd` is broad (66 files), so conflicts still occur and may repeat across commits.
- Rewrites local development history if later adopted directly; more confusing with already-pushed `origin/song-dev`.
- Harder to show upstream integration as a single decision point.

#### Option C — Build a fresh branch from upstream/main and manually reapply only selected local feature patches
Approach: start from upstream 0.4.9, manually port Draft/WebAccess/MarkItDown/default-zh changes.

Pros:
- Cleanest upstream base.
- Can intentionally drop accidental local churn.

Cons:
- Highest risk of losing subtle local behavior, especially broad Chinese UI and WebAccess integration.
- More manual effort and less faithful to the already-tested local branch.

### Recommended Option
Use **Option A**. It best satisfies the user’s stated goal: preserve all new features while achieving a conflict-free integrated result. Option B is acceptable only if Option A becomes unmanageable; Option C is a fallback for catastrophic conflict resolution failure.

## File-Level Conflict Resolution Plan

### 1. Branch and safety setup
- Confirm clean tracked state except known untracked unrelated webaccess plan files.
- Create safety branch: `song-dev-before-upstream-0.4.9` at current `song-dev`.
- Create integration branch: `song-dev-merge-upstream-0.4.9`.
- Run `git merge --no-commit --no-ff upstream/main`.
- Do not stage unrelated untracked files: `.omx/plans/prd-webaccess-research-executor-20260511T072227Z.md`, `.omx/plans/test-spec-webaccess-research-executor-20260511T072227Z.md`.

### 2. Foundation: Tauri/Rust commands and frontend command wrappers
Files: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/fs.rs`, `src/commands/fs.ts`, `src-tauri/tauri.conf.json`.

Resolution policy:
- `commands/mod.rs`: include both `pub mod file_sync;` and `pub mod web_access;`.
- `lib.rs`: include upstream `FileSyncState` setup and all `file_sync::*` handlers; keep local `web_access::start_web_access_proxy`; keep local `convert_with_markitdown` and `file_modified_ms`; keep upstream `open_project_folder`.
- `src/commands/fs.ts`: include upstream `copyDirectory` and `openProjectFolder`; keep local `convertWithMarkitdown` and `fileModifiedMs`.
- `tauri.conf.json`: use upstream version `0.4.9`; keep local `devUrl: http://127.0.0.1:1420` unless execution testing proves it incompatible.

Acceptance checks:
- TypeScript imports compile.
- Tauri command names referenced by TS exist in Rust handler list.

### 3. Store and project persistence union
Files: `src/stores/wiki-store.ts`, `src/lib/project-store.ts`.

Resolution policy:
- `activeView`: include local `drafts` plus all existing upstream views.
- `SearchProvider`: include upstream `searxng`.
- Add upstream `SearXngCategory`, `searXngUrl`, `searXngCategories` to search config and defaults.
- Keep local `WebAccessConfig`, `webAccessConfig`, `setWebAccessConfig`, and type export.
- `project-store.ts`: keep local `saveWebAccessConfig/loadWebAccessConfig`; add upstream `saveProjectFileSyncEnabled/loadProjectFileSyncEnabled`; preserve current forced `zh` behavior unless the user explicitly changes language policy.

Acceptance checks:
- `SearchApiConfig` consumers can configure Tavily, SerpApi, and SearXNG.
- WebAccess settings can still persist.
- Draft active view compiles.

### 4. App lifecycle and reset integration
Files: `src/App.tsx`, `src/lib/reset-project-state.ts`, `src/lib/auto-save.ts`.

Resolution policy:
- `App.tsx`: union imports for `useDraftStore/loadDrafts`, `loadWebAccessConfig`, and `loadProjectFileSyncEnabled`.
- Startup preferences: load search config, WebAccess config, embedding, multimodal, proxy, language.
- Project open sequence:
  1. await `resetProjectState()`;
  2. set project and output language;
  3. await upstream `restoreQueue(proj.id, proj.path)` before file sync;
  4. restore dedup queue;
  5. start/stop project file sync based on `loadProjectFileSyncEnabled(proj.id)`;
  6. load file tree;
  7. load review;
  8. load chat;
  9. load drafts silently.
- `reset-project-state.ts`: keep local draft clear + `clearDraftAutoSaveTimer`; add upstream `stopProjectFileSync` in Promise.allSettled import set and cleanup block.
- `auto-save.ts`: retain draft autosave revision guard and project path guard.

Acceptance checks:
- Opening/switching projects does not write old-project drafts.
- File sync does not start before ingest queue restore.
- Reset stops file sync watcher.

### 5. Source lifecycle and source conversion integration
Files: `src/components/sources/sources-view.tsx`, `src/lib/source-lifecycle.ts`, `src/lib/source-conversion.ts`.

Resolution policy:
- Use upstream `sources-view.tsx` as base because it delegates import/delete/reingest to `source-lifecycle.ts` and includes progressive rendering improvements.
- Port local source conversion cache cleanup into upstream `source-lifecycle.ts` by importing `deleteConvertedSourceCache` and invoking it alongside raw cache and ingest-cache cleanup in `deleteSourceFiles`.
- Preserve local `source-conversion.ts` unchanged unless type changes are needed.
- Ensure import folder path uses upstream `copyDirectory` wrapper rather than direct `invoke` from the component.

Acceptance checks:
- Source import still preprocesses and enqueues ingest.
- Source delete removes raw source, generated wiki refs, ingest cache, embeddings, upstream cleanup artifacts, and local converted markdown cache.
- Large source tree progressive rendering remains.

### 6. Ingest and LLM compatibility integration
Files: `src/lib/ingest.ts`, `src/lib/llm-providers.ts`.

Resolution policy:
- In `ingest.ts`, keep local `loadSourceForIngest(pp, sp)` and activity messages; add upstream Windows-safe path segment validation in `isSafeIngestPath`.
- Keep upstream `isOpenAiStrictCompletionModel` and `adaptOpenAiStrictCompletionBody` in `llm-providers.ts`; local branch does not conflict there, so prefer upstream additions directly.

Acceptance checks:
- Converted source ingest tests pass.
- Windows-invalid FILE block paths are rejected.
- GPT-5/o-series strict body tests pass.

### 7. Search provider and settings union
Files: `src/lib/web-search.ts`, `src/lib/web-search.test.ts`, `src/components/settings/sections/web-search-section.tsx`, `src/components/settings/settings-types.ts`, `src/components/settings/settings-view.tsx`.

Resolution policy:
- Use upstream `web-search.ts` as base for SearXNG implementation; preserve local Chinese error copy only after all providers still work.
- `resolveSearchConfig` must preserve per-provider configs for Tavily, SerpApi, and SearXNG.
- `web-search-section.tsx`: build a union UI with:
  - search provider cards for Tavily, SerpApi, SearXNG;
  - SerpApi engine picker;
  - SearXNG URL and category picker;
  - local WebAccess health/proxy configuration section.
- Avoid mixing WebAccess config into `SearchApiConfig`; keep it in `webAccessConfig`.

Acceptance checks:
- Web search tests cover missing config, Tavily, SerpApi, SearXNG normalization/error paths.
- Settings UI can persist WebAccess and all search providers independently.

### 8. Activity/search/maintenance UI conflicts
Files: `src/components/layout/activity-panel.tsx`, `src/components/search/search-view.tsx`, `src/components/settings/sections/maintenance-section.tsx`.

Resolution policy:
- For `activity-panel.tsx`, preserve local Chinese labels and absorb upstream file-sync queue/status UI if present.
- For `search-view.tsx`, prefer union of local behavior and upstream cleanup; ensure no removed imports are still referenced.
- For `maintenance-section.tsx`, keep upstream project file sync enable/disable controls and preserve local maintenance/WebAccess-related adjustments if any.

Acceptance checks:
- No unused imports or missing symbols.
- File sync tasks/status are visible/manageable if upstream UI intended it.

### 9. Draft UI/i18n and docs/version
Files: `src/i18n/en.json`, `src/i18n/zh.json`, `README*.md`, `package.json`, `src-tauri/tauri.conf.json`, `src/lib/changelog.ts`.

Resolution policy:
- Preserve Draft translation keys in both languages.
- Absorb upstream SearXNG/source-watch translation/docs where present.
- Use version `0.4.9`; keep local Draft docs/demo files as local artifacts.
- Include `README_JA.md` from upstream.

Acceptance checks:
- i18n parity test passes.
- Package version and Tauri version agree.

## Ordered Execution Plan

1. Prepare safety branch.
2. Start merge without committing.
3. Resolve command and store foundations.
4. Resolve lifecycle foundations.
5. Resolve source/ingest stack.
6. Resolve search/settings stack.
7. Resolve secondary UI and i18n/docs/version.
8. Verification loop.
9. Finalize with Lore commit on integration branch only; merge into `song-dev` after approval; do not push unless explicitly requested.

## Acceptance Criteria

- `git status` on integration branch has no unmerged paths.
- `git grep -n "<<<<<<<\|=======\|>>>>>>>" -- .` returns no conflict markers.
- Draft feature works at compile/test level: chat action still calls draft store; Drafts nav exists; draft persistence tests pass; project reset clears drafts silently.
- WebAccess feature works at compile/test level: WebAccess config remains in wiki/project store; settings UI still renders/persists WebAccess; Tauri handler includes `start_web_access_proxy`.
- Upstream file sync works at compile/test level: project file sync commands compile; `loadProjectFileSyncEnabled` exists; App starts file sync only after ingest queue restore; reset stops file sync.
- Search providers include Tavily, SerpApi, and SearXNG; tests prove SearXNG URL/category handling.
- Source lifecycle uses upstream helper structure and also deletes local converted-source cache.
- Ingest uses local MarkItDown source loading and upstream Windows-safe path rejection.
- Package/Tauri version is 0.4.9.
- Verification commands listed below pass, except Tauri manual smoke may be reported separately if not run.

## Verification Commands

```powershell
npm run typecheck
npx vitest run src/stores/draft-store.test.ts src/lib/draft-persist.test.ts src/i18n/i18n-parity.test.ts
npx vitest run src/lib/web-search.test.ts
npx vitest run src/lib/project-file-sync.test.ts src/lib/source-lifecycle.test.ts
npx vitest run src/lib/source-conversion.test.ts src/lib/ingest.converted-source.test.ts src/lib/ingest-parse.test.ts
npx vitest run src/lib/__tests__/llm-providers.test.ts
npm run test:mocks
npm run build
Push-Location src-tauri; cargo check; Pop-Location
```

Manual smoke after automated checks:

```powershell
npm run tauri dev
```

Manual smoke checklist:
- Open project; chat -> set assistant answer as Draft; edit/delete Draft; verify `.llm-wiki/drafts.json`.
- Configure Web Search providers, including SearXNG URL/categories.
- Toggle project file sync; add/delete a file in `raw/sources` outside the app; observe activity queue.
- Import/delete a source and verify source lifecycle cleanup plus converted cache cleanup.
- Run ingest with GPT-5/o-series config shape if credentials are available, otherwise rely on provider body unit tests.

## Risks and Mitigations

- **Risk: source lifecycle refactor drops local converted-cache cleanup.** Mitigation: explicitly port `deleteConvertedSourceCache` into `source-lifecycle.ts`; run source-conversion and source-lifecycle tests.
- **Risk: WebAccess settings and SearXNG settings overwrite each other.** Mitigation: keep WebAccess in separate `webAccessConfig`; keep search provider overrides in `SearchApiConfig.providerConfigs`; test typecheck and settings render path.
- **Risk: project switch causes stale writes/watchers.** Mitigation: preserve draft autosave path guard; add upstream `stopProjectFileSync` in reset; keep App restore-before-watch ordering.
- **Risk: Rust/TS command mismatch.** Mitigation: resolve command registries first; typecheck; run `npm run tauri dev` smoke.
- **Risk: default zh policy diverges from upstream i18n expectations.** Mitigation: preserve local behavior now because user operates in Chinese; document as intentional follow-up decision.
- **Risk: merge commit accidentally includes unrelated untracked plan files.** Mitigation: stage explicit paths only; review `git status --short` before commit.
- **Risk: full `npm run test:mocks` passes while Rust command wiring is broken.** Mitigation: add `cargo check` inside `src-tauri` and at least one `npm run tauri dev` smoke when a GUI session is practical.
- **Risk: conflict resolution accidentally resurrects pre-refactor source logic in `sources-view.tsx`.** Mitigation: treat upstream `sources-view.tsx` as base and move local source-conversion behavior into `source-lifecycle.ts`; do not duplicate lifecycle code back into the React component.

## ADR

### Decision
Use a temporary integration branch and a manual file-family union merge of upstream 0.4.9 into local `song-dev`.

### Drivers
- Preserve all local Draft/WebAccess/MarkItDown/default-zh features.
- Absorb all upstream file-sync/source-lifecycle/SearXNG/GPT-5/Windows fixes.
- Maintain a reversible, reviewable path with tests before modifying the main development branch.

### Alternatives considered
- Blanket `-X ours` or `-X theirs`: rejected because it would lose one side’s features.
- Rebase local commits onto upstream: viable but less desirable because the broad local baseline commit would still create repeated conflicts and could confuse already-pushed branch history.
- Fresh upstream branch with manual local feature reapplication: rejected as higher risk of subtle feature loss.

### Why chosen
A no-commit merge on a temporary branch exposes all conflicts at once, keeps both sides available for manual union, and produces a clear integration commit after verification.

### Consequences
- Requires careful manual resolution in high-conflict files.
- Produces a larger integration diff.
- Leaves current `song-dev` safe until the integration branch is verified.

### Follow-ups
- Decide whether forced `zh` language behavior should remain permanent or become a user setting.
- Consider documenting Draft v1 in README/changelog after merge.
- After manual smoke, decide whether to push `song-dev` or open a PR from integration branch.

## Available-Agent-Types Roster

- `explore`, `planner`, `architect`, `critic`, `executor`, `debugger`, `test-engineer`, `verifier`, `code-reviewer`, `reviewer`, `build-engineer`.

## Follow-up Staffing Guidance

### Recommended `$ralph` lane
Use `$ralph` when one owner should perform the merge carefully with persistent verification pressure.
- Main executor: `executor`, medium/high reasoning, owns conflict resolution.
- Side reviewer after source edits: `architect`, high reasoning, reviews source lifecycle/search/App lifecycle union.
- Final verification: `verifier`, high reasoning, checks criteria and command outputs.
- Build troubleshooting if needed: `build-engineer`, medium reasoning.

Suggested handoff:

```text
$ralph execute .omx/plans/upstream-049-merge-strategy-ralplan.md
```

### Recommended `$team` lane
Use `$team` if speed matters and conflict ownership can be split by file families.
- Worker 1: Rust/Tauri + frontend command wrappers (`src-tauri/*`, `src/commands/fs.ts`).
- Worker 2: stores/App/reset lifecycle (`wiki-store`, `project-store`, `App`, `reset-project-state`, `auto-save`).
- Worker 3: source lifecycle/ingest (`sources-view`, `source-lifecycle`, `source-conversion`, `ingest`, `llm-providers`).
- Worker 4: search/settings/i18n (`web-search`, `web-search-section`, settings, i18n).
- Verifier lane: test/build command execution and final checklist.

Launch hint:

```text
$team implement .omx/plans/upstream-049-merge-strategy-ralplan.md with 4 workers plus verifier
```

Team verification path:
- Each worker proves local typecheck for owned files when possible and reports exact changed files.
- Verifier runs the full verification command list.
- Ralph or leader performs final conflict-marker/status audit before commit.

## Goal-Mode Follow-up Suggestions

- `$ultragoal`: default if the merge should become a durable goal with tracked subgoals and completion evidence.
- `$performance-goal`: not primary here; only use if source tree rendering or file sync performance becomes the central objective.
- `$autoresearch-goal`: not appropriate; this is implementation integration, not a research deliverable.

## Consensus Review Results

### Architect Review

Verdict: **APPROVE WITH REQUIRED IMPROVEMENTS**.

Strongest steelman counterargument against Option A:
- A no-commit merge exposes all conflicts at once and may encourage broad “make it compile” edits. A rebase/cherry-pick path could isolate the local broad baseline commit, Draft commit, and upstream changes more cleanly for review.

Tradeoff tension:
- **History clarity vs integration safety**: rebase gives cleaner linear history, but the local baseline commit is broad and already tied to remote `origin/song-dev`; a temporary merge branch is safer and easier to roll back.

Synthesis path:
- Keep Option A, but structure it as file-family phases with hard verification gates after each foundation layer. Add Rust verification and explicitly prevent duplicated source lifecycle logic from re-entering `sources-view.tsx`.

Architect-required improvements applied:
- Added `cargo check` to verification.
- Added explicit source-lifecycle duplication risk and mitigation.
- Clarified that upstream `sources-view.tsx` remains the base while local conversion cleanup moves into `source-lifecycle.ts`.

### Critic Review

Verdict: **APPROVE**.

Quality checks:
- Principle-option consistency: passes; Option A directly serves feature-union and rollback principles.
- Alternatives fairness: passes; rebase and fresh-port alternatives are described with real advantages, not strawmen.
- Risk clarity: passes after adding Rust command wiring and source-lifecycle duplication risks.
- Testability: passes; acceptance criteria are observable through status checks, targeted tests, build, and Rust check.
- Execution handoff: passes; Ralph and Team lanes include staffing and verification paths.

Critic notes for execution:
- Do not treat the plan’s file-level policies as optional; the highest-risk files are `web-search-section.tsx`, `sources-view.tsx`, `source-lifecycle.ts`, `App.tsx`, `wiki-store.ts`, and Rust command registries.
- If typecheck failures cascade after resolving `wiki-store.ts`, pause and fix store/project-store types before touching UI files.
- If `source-lifecycle.ts` cannot absorb `deleteConvertedSourceCache` cleanly, stop and re-plan that slice rather than duplicating source delete logic in the UI component.

## Changelog for plan revisions

- Initial draft created from local/upstream diff evidence and merge-tree conflict prediction.
- Applied Architect/Critic review improvements: Rust verification gate, stricter source-lifecycle ownership, and explicit high-risk file notes.
