# Stash

A desktop app to download YouTube videos, playlists and channels.
Sign in with your YouTube account to download from your subscriptions,
Watch Later, liked videos and members-only content. Includes a live
download queue, a history library, and a bilingual UI (Spanish / English).

Built with **Tauri 2** (Rust) and **React 19** (TypeScript).

## Requirements

- [Node.js 18+](https://nodejs.org)
- [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs)

yt-dlp and ffmpeg are downloaded automatically by the app on first run.

## Run in development

```bash
pnpm install
pnpm tauri dev
```

## Build the installer

```bash
pnpm tauri build
```

The Windows installer is generated at `src-tauri/target/release/bundle/nsis/`.

## Checks and tests

```bash
pnpm run check        # typecheck + lint + cargo check
pnpm run test         # frontend tests
pnpm run check:rust   # cargo check + clippy
cd src-tauri && cargo test
```

## Project structure

```
src/          React frontend (features + shared)
src-tauri/    Rust backend (features + core)
.dev-data/    Runtime data in dev mode (session, settings, history, binaries) — git-ignored
.claude/      AI skills: architecture doctrine for frontend and backend
```

More details: see `CLAUDE.md` and the skills under `.claude/skills/`.

## License

[MIT](LICENSE)
