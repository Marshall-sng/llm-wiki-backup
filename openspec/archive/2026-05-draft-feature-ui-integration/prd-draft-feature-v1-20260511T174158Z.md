# PRD: Draft / 底稿 v1

## Goal
Implement first-stage Drafts so users can explicitly turn assistant Chat replies into project-local, editable bottom drafts while preserving references and normal Chat behavior.

## In scope
- Draft store and project-local persistence at `.llm-wiki/drafts.json`.
- Assistant-only "Set as Draft" action copying content, references, conversation source, timestamp, and content hash.
- Left-rail Drafts entry and Drafts view for list/select/edit/delete/reference viewing.
- Project open/reset/autosave safety.
- i18n parity and tests.

## Out of scope
- Template matching, DOCX/PDF export, long document workflow, diff guard, version history UI.

## Acceptance
- Drafts are explicit user-created artifacts.
- Drafts survive project reopen and do not leak across projects.
- Existing Chat behavior remains unchanged.
