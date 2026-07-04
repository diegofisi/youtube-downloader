# Stash

Stash is a desktop YouTube downloader (videos, playlists, subscriptions) built on yt-dlp/ffmpeg,
with session login, a download queue, history library, and a bilingual (es/en) UI.

## Stack

- **Backend**: Tauri 2 + Rust, vertical slices (`src-tauri/src/features/*` + `src-tauri/src/core/`).
- **Frontend**: React 19 + Tailwind + Shadcn + Zustand + React Query (`src/`),
  vertical slices (`src/features/*` + `src/shared/`). The vanilla-TS UI is gone —
  the stack is React only.

## Verification (golden commands)

```
pnpm run check                 # tsc --noEmit + eslint src + cargo check
pnpm run test                  # vitest run
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo test
```

## Where to look before writing code

- New **backend** work (Tauri command, Rust service, backend event, FE↔BE contract change)
  → skill `backend`.
- New **frontend** work (view, component, state, data fetching, i18n)
  → skill `frontend`.
- Frontend architecture doctrine lives in the frontend skill (loaded on demand);
  backend/contract doctrine in backend. Do not duplicate skill content here.

## Iron rules (transcend any skill)

1. **Never break the FE↔BE serde contract**: new structs use `rename_all = "camelCase"`;
   legacy snake_case models (`AppConfig`, `VideoMeta`) are untouchable without a migration.
   The contract table lives in the backend skill (`references/project.md`).
2. **User-facing strings go through the i18n layer** `t(es, en)` (frontend); the backend
   currently returns user-facing error strings in the app's default language (es) — treat
   them as product copy, not code style. Code, file names, and identifiers: English.
3. **Comments in English, max 1-2 lines**, explaining the why — never the what.
4. **Commit messages in English**: `type(scope): description`
   (e.g. `feat(session): real logout`).
