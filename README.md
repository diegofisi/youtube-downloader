<div align="center">

<img src="src-tauri/icons/128x128.png" alt="Stash logo" width="110" />

# Stash

**Your YouTube downloads, organized.**

Download videos, playlists and entire channels. Sign in to grab your subscriptions,
Watch Later, liked videos and members-only content — with a live queue and a personal library.

[![Release](https://img.shields.io/github/v/release/diegofisi/youtube-downloader?style=for-the-badge&color=7C6BF0&labelColor=1e1b2e)](https://github.com/diegofisi/youtube-downloader/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/diegofisi/youtube-downloader/total?style=for-the-badge&color=7C6BF0&labelColor=1e1b2e)](https://github.com/diegofisi/youtube-downloader/releases)
[![License](https://img.shields.io/github/license/diegofisi/youtube-downloader?style=for-the-badge&color=7C6BF0&labelColor=1e1b2e)](LICENSE)

[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/diegofisi/youtube-downloader/releases/latest)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-backend-CE412B?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-19-58C4DC?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

<br />

### [⬇️ &nbsp;Download the latest release](https://github.com/diegofisi/youtube-downloader/releases/latest)

*No prerequisites. yt-dlp and ffmpeg are set up automatically on first run.*

</div>

---

## ✨ Features

|     | Feature | Details |
| --- | ------- | ------- |
| 🎞️ | **Videos, playlists & channels** | Paste any link and preview everything before downloading |
| 🎚️ | **Quality & format control** | Global defaults plus per-video overrides — MP4/MKV/WebM, up to 4K, or audio-only (MP3/M4A/Opus) |
| 👤 | **Your YouTube account** | One-click sign-in: subscriptions, Watch Later, liked videos, playlists and members-only content |
| 🔎 | **Built-in search** | Search YouTube without leaving the app — filter by All / Videos / Shorts |
| 📥 | **Live queue** | Concurrent downloads with pause / resume / retry, reordering and real-time progress |
| 📚 | **Library** | Every download remembered — search it, reopen the file's folder, or send files to the Recycle Bin |
| 🔄 | **Session self-healing** | Expired session mid-batch? Downloads pause, the session renews silently and the queue resumes itself |
| 🌗 | **Polished UI** | Dark & light themes, Spanish & English, duplicate-safe file naming (`title (1).mp4`) |

## 📸 Screenshots

<!--
  Drop your PNGs into docs/screenshots/ with these names, then delete this comment
  and un-comment the table below. Recommended: dark theme, ~1400px wide window.

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/download.png" alt="Download & preview" /><br /><sub>Download & preview</sub></td>
    <td align="center"><img src="docs/screenshots/queue.png" alt="Live queue" /><br /><sub>Live queue</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/youtube.png" alt="My YouTube" /><br /><sub>My YouTube</sub></td>
    <td align="center"><img src="docs/screenshots/library.png" alt="Library" /><br /><sub>Library</sub></td>
  </tr>
</table>
-->

> 🚧 Screenshots coming soon.

## 🚀 Install (users)

1. Download **`Stash_x64-setup.exe`** from the [latest release](https://github.com/diegofisi/youtube-downloader/releases/latest).
2. Run it. Windows 10/11 x64 — nothing else to install.
3. First launch downloads yt-dlp & ffmpeg automatically (needs internet, ~1 min).

> **Note**: Windows SmartScreen may warn about an unsigned app.
> Click **More info → Run anyway**.

## 🛠️ Development

Requirements: [Node.js 18+](https://nodejs.org) · [pnpm](https://pnpm.io) · [Rust](https://rustup.rs)

```bash
pnpm install
pnpm tauri dev        # desktop app with hot reload
pnpm tauri build      # installer → src-tauri/target/release/bundle/nsis/
```

<details>
<summary><b>Checks & tests</b></summary>

```bash
pnpm run check        # typecheck + lint + cargo check
pnpm run test         # frontend tests (vitest)
pnpm run check:rust   # cargo check + clippy -D warnings
cd src-tauri && cargo test
```

</details>

<details>
<summary><b>Project structure</b></summary>

```
src/          React frontend  — vertical slices (features/ + shared/)
src-tauri/    Rust backend    — vertical slices (features/ + core/)
.dev-data/    Dev-mode runtime data (session, settings, history, binaries) — git-ignored
.claude/      AI skills: architecture doctrine for frontend and backend
```

Architecture doctrine lives in the skills under [`.claude/skills/`](.claude/skills) —
start at [`CLAUDE.md`](CLAUDE.md).

</details>

## ⚖️ Legal

For personal use. Download only content you have the right to download,
and respect YouTube's Terms of Service.

## 📄 License

[Apache-2.0](LICENSE)
