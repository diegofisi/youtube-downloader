# Naming, comments, commits and test conventions (repo-wide)

Frontend-specific conventions (React file layout, component naming, facades, FE test style)
are specified by the stash-frontend skill. What follows applies repo-wide or to the backend.

## Naming table (all verified in the repo)

| Thing | Convention | Real examples |
|---|---|---|
| Rust files | fixed per slice | `commands.rs`, `service.rs`, `models.rs` (+ `webview.rs` in session) |
| Tauri commands | snake_case `verb_noun` | `start_download`, `get_session_status`, `delete_history_file` |
| Tauri events | kebab-case | `download-progress`, `cookies-extracted`, `setup-progress` |
| localStorage | `stash.` prefix for new keys | `stash.lang`, `stash.recentLinks` — dotless legacy NOT to rename: `stash-theme`, `stash-onboarded` |
| Constants | SCREAMING_SNAKE (TS and Rust) | `RADIO_CAP`, `AUTH_ERROR_MSG`, `BROWSER_UA`, `STATUS_META`, `PAGE` |
| Slices | English, singular or domain | `download`, `preview`, `queue`, `session`, `library`, `settings`, `setup`, `search`, `youtube-account` |

## Code comments (TS and Rust)

**In English, concise, max 1-2 lines.** Explain the why, not the what; no comment is better
than a redundant one. This applies to `//`, `/* */`, and doc comments alike.

UI-facing strings are NOT comments and follow their own rules:
- Rust error messages returned to the frontend (`Result<T, String>`) are user-visible text:
  the backend currently returns them in the app's default language (es) until backend i18n
  exists — treat them as product copy, not code style (see error-handling.md).
- Frontend user-facing texts go through the i18n layer `t(es, en)` specified by the
  stash-frontend skill.

## Commits

Commit messages in **English**, `type(scope): description` (conventional style). Types seen:
`feat`, `fix`, `refactor`, `chore`, `test` (combinable: `chore,test(fase4):`,
`fix,refactor(fase1):`). Scope = slice or phase:

```
feat(session): real logout + expired-session detection + fix My YouTube
fix(preview): radios/Mix -> cap 25; real playlists -> no cap
refactor(fase3): god-file cuts, view dedupe and unified Rust core
```
Body (when present): `-` bullets, dense, citing numbers ("descargar.ts 754->265") and the why.
Note: older log entries predate this rule and are not in English — do not imitate them.

## Rust test style

- `#[cfg(test)] mod tests { use super::*; … }` AT THE END of the same file.
- Test names in English snake_case, descriptive sentence style
  (e.g. `fn build_forces_utf8_encoding_and_closes_with_double_dash_before_url()`).
  Existing tests predate this rule and keep their original (non-English) names — do not
  mass-rename them; new tests are English.
- Sections separated with `// ---------- name ----------`.
- Helpers/fixtures local to the tests mod (e.g. `struct TempDir` with `Drop`, small builder fns).

Frontend (vitest) test style → stash-frontend skill.
See testing.md for what deserves a test and what doesn't.
