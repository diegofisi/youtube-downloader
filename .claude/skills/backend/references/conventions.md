# Naming, comments, commits and test conventions (backend)

Frontend-specific conventions (file layout, component naming, facades, FE test style) are
specified by the frontend skill. What follows applies repo-wide or to the backend.
Project-specific names (real slices, storage keys, legacy exceptions) live in project.md.

## Naming table

| Thing | Convention | Examples |
|---|---|---|
| Rust files | fixed per slice | `commands.rs`, `service.rs`, `models.rs` (+ extra modules only when a slice truly needs them) |
| Tauri commands | snake_case `verb_noun` | `start_{task}`, `get_{entity}_status`, `delete_{entity}_file` |
| Tauri events | kebab-case | `{feature}-progress`, `{feature}-completed` |
| Constants | SCREAMING_SNAKE (TS and Rust) | `{THING}_CAP`, `{KIND}_ERROR_MSG`, `STATUS_META` |
| Slices | English, singular or domain noun | `{feature}` — the project's real slice list is in project.md |

## Code comments (TS and Rust)

**In English, concise, max 1-2 lines.** Explain the why, not the what; no comment is better
than a redundant one. This applies to `//`, `/* */`, and doc comments alike.

UI-facing strings are NOT comments and follow their own rules:
- Rust error messages returned to the frontend (`Result<T, String>`) are user-visible text:
  the backend returns them in the app's default language until backend i18n exists — treat
  them as product copy, not code style (see error-handling.md → product-copy rule).
- Frontend user-facing texts go through the i18n layer specified by the frontend skill.

## Commits

Commit messages in **English**, `type(scope): description` (conventional style). Types:
`feat`, `fix`, `refactor`, `chore`, `test` (combinable: `chore,test({scope}):`). Scope =
slice or phase:

```
feat({feature}): real logout + expired-session detection
fix({feature}): cap dynamic lists at N; real lists uncapped
refactor({phase}): god-file cuts and unified Rust core
```

Body (when present): `-` bullets, dense, citing numbers ("{file} 754->265") and the why.
If older log entries predate this rule (wrong language, other formats), do not imitate them.

## Rust test style

- `#[cfg(test)] mod tests { use super::*; … }` AT THE END of the same file.
- Test names in English snake_case, descriptive sentence style
  (e.g. `fn build_forces_utf8_encoding_and_closes_with_double_dash_before_url()`).
  If existing tests predate this rule and keep legacy names, do not mass-rename them;
  new tests are English.
- Sections separated with `// ---------- name ----------`.
- Helpers/fixtures local to the tests mod (e.g. a `TempDir` struct with `Drop`, small
  builder fns).

Frontend test style → frontend skill.
See testing.md for what deserves a test and what doesn't.
