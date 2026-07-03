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
  they stay in **Spanish** until backend i18n exists (see error-handling.md).
- Frontend user-facing texts go through the i18n system specified by the stash-frontend skill.

## Commits (real git-log style)

`type(scope): description` — **in Spanish and WITHOUT accents** (the log uses "descripcion",
"nucleo", "tamanos"). This convention is intentionally kept in Spanish — do not switch it to
English. Types seen: `feat`, `fix`, `refactor`, `chore`, `test` (combinable: `chore,test(fase4):`,
`fix,refactor(fase1):`). Scope = slice or phase:

```
feat(session): logout real + deteccion de sesion caducada + fix Mi YouTube
fix(preview): radios/Mix -> tope 25; playlists reales -> sin tope
refactor(fase3): cortes de god-files, dedupe de vistas y nucleo Rust unificado
```
Body (when present): `-` bullets, dense, citing numbers ("descargar.ts 754->265") and the why.

## Rust test style

- `#[cfg(test)] mod tests { use super::*; … }` AT THE END of the same file.
- Test names in Spanish with snake_case:
  `fn build_fuerza_encoding_utf8_y_cierra_con_doble_guion_antes_de_la_url()`.
- Sections separated with `// ---------- name ----------`.
- Helpers/fixtures local to the tests mod: `fn linea(...)`, `struct TempDir` with `Drop`, `fn opciones(...)`.

Frontend (vitest) test style → stash-frontend skill.
See testing.md for what deserves a test and what doesn't.
