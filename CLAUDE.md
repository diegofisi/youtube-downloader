# Stash

Stash is a desktop YouTube downloader (videos, playlists, subscriptions) built on yt-dlp/ffmpeg,
with session login, a download queue, history library, and a bilingual (es/en) UI.

## Stack

- **Backend**: Tauri 2 + Rust, vertical slices (`src-tauri/src/features/*` + `src-tauri/src/core/`).
- **Frontend**: React 19 + Tailwind + Shadcn + Zustand + React Query (`src/`).
  **UI migration from vanilla TS to React in progress** — expect mixed code until it is done.

## Verification (golden commands)

```
npm run check                 # tsc --noEmit + eslint src + cargo check
npm run test                  # vitest run
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo test
```

## Where to look before writing code

- New **backend** work (Tauri command, Rust service, backend event, FE↔BE contract change)
  → skill `stash-backend`.
- New **frontend** work (view, component, state, data fetching, i18n)
  → skill `stash-frontend`.
- Frontend architecture doctrine lives in the stash-frontend skill (loaded on demand);
  backend/contract doctrine in stash-backend. Do not duplicate skill content here.

## Iron rules (transcend any skill)

1. **Never break the FE↔BE serde contract**: new structs use `rename_all = "camelCase"`;
   legacy snake_case models (`AppConfig`, `VideoMeta`) are untouchable without a migration.
   The contract table lives in the stash-backend skill (`references/tauri-commands.md`).
2. **User-facing strings go through the i18n layer** `t(es, en)` (frontend); the backend
   currently returns user-facing error strings in the app's default language (es) — treat
   them as product copy, not code style. Code, file names, and identifiers: English.
3. **Comments in English, max 1-2 lines**, explaining the why — never the what.
4. **Commit messages in English**: `type(scope): description`
   (e.g. `feat(session): real logout`).
