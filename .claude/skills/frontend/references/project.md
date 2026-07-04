# Project binding — Stash

> **Project binding — Stash. Replace or delete this file when reusing the
> skill in another project.** Everything project-specific lives here; the
> other reference files are project-agnostic doctrine.

Stash is a **single-user Tauri 2 desktop app** (YouTube downloader on
yt-dlp/ffmpeg): React 19 + TS + Tailwind + Shadcn + Zustand + React Query on
the frontend, Rust vertical slices on the backend. All the "When the backend is
Tauri (desktop)" sections in the doctrine files apply. `web-app-patterns.md`
does NOT apply to Stash code — ever.

Backend command contract: see the sibling `backend` skill
(`../backend/references/`).

## Feature map (real slices)

| Feature | Route/page | Data shape | Notes |
|---|---|---|---|
| `download` | `/descargar` → `DescargarPage` | mutation (analyze) + queue store (enqueue) | "Descargar" view: URL input, analysis, options dialog, recent links (`stash.recentLinks`). Owns `DownloadOptions` model. |
| `search` | `/buscar` → `BuscarPage` | infinite query over `analyze_urls` | Local hook; client-side filtering keeps raw-count logic in `select`. |
| `youtube-account` | `/youtube` → `YoutubePage` | infinite query over `analyze_urls` (feeds) + session queries | Feed source tabs; "already downloaded" derives from the library query. |
| `queue` | `/cola` → `ColaPage` | Zustand store (scheduler) | NOT React Query. Sidebar badge reads a store selector. |
| `library` | `/biblioteca` → `BibliotecaPage` | query + mutations | `get_history` list; per-item mutations invalidate `['library']`. Model: `library-entry.model.ts`. |
| `session` | (no page — banner + account card) | queries + mutations (no store; single-flight lives in the api module) | Status query with `refetchInterval: 10 * 60 * 1000` (cookie expiry has no event). |
| `settings` | `/ajustes` → `AjustesPage` | query + mutations + RHF form | DTO is snake_case (legacy Rust `AppConfig`) — mapper is mandatory. |
| `setup` | (dialog at startup, no route) | query + mutation + `setup-progress` event | Onboarding gate (blocking dialog before the shell); `stash-onboarded` flag. |

The pre-cutover vanilla-TS `preview` slice **dissolved**: each consumer owns
its own local hook calling `analyze_urls` (see the cross-feature doctrine in
`architecture.md`):

| Consumer | Local hook | Key |
|---|---|---|
| download | `api/analyze-urls/useAnalyzeUrls.ts` (mutation) | — |
| search | `api/search-videos/useSearchVideos.ts` (infinite) | `['search', query]` |
| youtube-account | `api/get-account-feed/useAccountFeed.ts` (infinite) | `['youtube-account', 'feed', source]` |

## Sanctioned facades (the ONLY legal cross-feature imports)

Enforced by `eslint.config.js`. Import via `index.ts` only; deep paths always
fail lint.

| Facade | Exports | Contract |
|---|---|---|
| `@/features/queue` | `useQueueStore` + `EnqueueItem` | enqueue contract |
| `@/features/session` | status/account/login/logout/reconnect hooks | session contract |
| `@/features/download` | `useDownloadPrefill` | prefill contract |

## Command decision table (all 21 commands)

Commands are registered in `src-tauri/src/main.rs` `generate_handler![]`.

| Command | Shape | Hook / caller | Key / invalidates |
|---|---|---|---|
| `get_settings` | Query | `useGetSettings` | `['settings']` |
| `get_download_folder` | Query | `useGetDownloadFolder` | `['settings', 'downloadFolder']` |
| `get_session_status` | Query (poll 10 min) | `useSessionStatus` | `['session', 'status']` |
| `get_account_info` | Query | `useAccountInfo` | `['session', 'account']` |
| `get_history` | Query | `useGetHistory` | `['library']` |
| `check_dependencies` | Query | `useCheckDependencies` | `['setup', 'dependencies']` |
| `analyze_urls` (paste, Descargar) | Mutation | `useAnalyzeUrls` | — (result feeds page state) |
| `analyze_urls` (Search / My YouTube feeds) | **Infinite query** (`start`/`end` = 1-based page range) | `useSearchVideos` / `useAccountFeed` | `['search', q]` / `['youtube-account', 'feed', src]` |
| `set_settings` | Mutation | `useSetSettings` | inv. `['settings']` |
| `set_download_folder` | Mutation | `useSetDownloadFolder` | inv. `['settings', 'downloadFolder']` |
| `open_youtube_login` | Mutation (fire-and-forget; completion = `cookies-extracted`) | `useOpenYoutubeLogin` | — |
| `refresh_session_silent` | Mutation (single-flight) | `attemptSilentReconnect` plain fn (session facade export) | inv. `['session']` |
| `logout` | Mutation | `useLogout` | inv. `['session']` |
| `add_history` | Mutation-shaped, but **called by the queue store** on completion | plain `invoke` from store | store invalidates `['library']` |
| `remove_history_item` | Mutation | `useRemoveHistoryItem` | inv. `['library']` |
| `delete_history_file` | Mutation | `useDeleteHistoryFile` | inv. `['library']` |
| `clear_history` | Mutation | `useClearHistory` | inv. `['library']` |
| `open_history_folder` | Mutation (OS side-effect, no cache) | `useOpenHistoryFolder` or plain invoke from store (queue "open folder" action) | — |
| `open_downloads_folder` | Mutation (OS side-effect) | `useOpenDownloadsFolder` | — |
| `download_dependencies` | Mutation + `setup-progress` events | `useDownloadDependencies` | inv. `['setup', 'dependencies']` on success |
| `start_download` | **Store-driven** — scheduler only | `useQueueStore` internals | NEVER a React Query hook |
| `cancel_download` | **Store-driven** — pause/cancel actions | `useQueueStore` internals | NEVER a React Query hook |

## Event inventory

| Event | Payload (Rust contract) | Scope | Wire it |
|---|---|---|---|
| `download-progress` | `{ percent, speed, eta, status: 'downloading'\|'processing', url }` | **Global** — queue must advance even when `/cola` is not mounted | Module-level `onEvent` at queue store setup → `useQueueStore.getState().handleProgress(...)`. NOT `useTauriEvent`. |
| `cookies-extracted` | `boolean` (success) | **Global** — session can be renewed from any view | Module-level `onEvent` at session wiring → invalidate `['session', 'status']` via the `queryClient` singleton |
| `setup-progress` | `{ step, percent, message }` | View-scoped (onboarding dialog) | `useTauriEvent('setup-progress', cb)` in the onboarding container |
| `preview-progress` | `[done, total]` tuple | View-scoped (Descargar analysis) | `useTauriEvent('preview-progress', cb)` in the Descargar page/hook |

Do not poll for anything an event reports. Sole poll: `['session', 'status']`
keeps `refetchInterval: 10 * 60 * 1000` (cookie expiry has no event).

## Queue store — Stash specifics

The doctrine spec is `state.md` → Live-process stores. Stash's
`src/features/queue/stores/useQueueStore.ts` ported the vanilla framework-
agnostic `queue.state.ts` module verbatim; preserve exactly:

- `QItem`/`QStatus`/`EnqueueItem` types port as-is (become models). Status union includes `merging` (`download-progress` `status === 'processing'` maps to it); only patch items in `downloading`/`merging`.
- `enqueue`: dup-check on pending statuses + "Ya esta en la cola / Already in the queue" toast.
- `pump()`: fills slots while `activeCount() < concurrency`; `setConcurrency(n <= 0 ? Infinity : n)`.
- `runSeq` guard: stale settlements (fast pause→resume) are ignored.
- Resume keeps `progress` (yt-dlp continues the `.part` file); reset only on `retry`.
- `errorKind === 'auth'`: pause item + all queued (`pausedByAuth`), then silent reconnect; `authReconnectInFlight` single-flight (one attempt no matter how many items fail).
- Actions: `pause/resume/retry/cancel/remove/folder`; pause/cancel call `cancel_download`; folder resolves `filePath` dir → `folder` → `get_download_folder`.
- `move(id, dir)`, `retryAllFailed()`, `clearFinished()` (removes only `done`/`canceled`).
- Sidebar badge: `selectActiveCount = (s) => s.items.filter(i => ['downloading','queued','paused','merging'].includes(i.status)).length`.
- On completion: store calls `add_history` (plain invoke, try/catch — history failure must not break the flow) then invalidates `['library']`.

Session single-flight: `silentReconnectInFlight` shared promise lives in
`session/api/refresh-session-silent/attemptSilentReconnect.ts`. The download
slice derives `cookieMode` with its local `useCookieMode` query (`'none'` if no
session, else `'file'`); `cookieMode` is injected at enqueue time — not a form
field.

Legacy bus-event mapping (the vanilla typed bus died at the React cutover):
`queue:count` → store selector; `download:completed` → `['library']`
invalidation; `session:expired/connected/changed` → `['session','status']`
query + shell-local dismissed state; `theme:changed` → ui store;
`nav:*` → router navigation; `descargar:prefill` →
`navigate(AppPath.DESCARGAR, { state: { urls } })`.

## Routes & shell

```typescript
// shared/routes/app-path.ts (real)
export const AppPath = {
  ROOT: "/",
  DESCARGAR: "/descargar",
  BUSCAR: "/buscar",
  YOUTUBE: "/youtube",
  COLA: "/cola",
  BIBLIOTECA: "/biblioteca",
  AJUSTES: "/ajustes",
  ANY: "*",
} as const;
```

`/` and any unknown path redirect to `/descargar`. Hash router, one `AppShell`
(Titlebar + Sidebar + Outlet) in `src/shared/routes/`. The onboarding/setup
gate is a shell-level blocking dialog (gated on `check_dependencies` +
`stash-onboarded`), not a route. Titlebar label: "Stash".

## Forms inventory

| Form | Schema file | Notes |
|---|---|---|
| Settings | `settings/helpers/settings.schema.ts` | The 9 `SettingsUpdate` fields (quality, container, audio format, concurrency, mode, template, subtitles, thumbnail, clear-links flag). Query `['settings']` feeds RHF via `values:`; save = `set_settings`. Download folder is NOT part of the form — separate picker flow (`plugin-dialog` `open()` + `set_download_folder`). |
| Download options (video-opts dialog) | `download/helpers/download-options.schema.ts` | `DownloadOptions`: mode, quality, container, audioFormat, audioBitrate, subtitles, subLangs, embedThumbnail, outputTemplate. Defaults seeded from the settings query. Output goes to the queue store's `enqueue`, never to a mutation. |
| Search box | `search/` | Single input — `useState`, no RHF/Zod. |
| URL paste (Descargar) | `download/helpers/parse-urls.ts` | Textarea — not an RHF form; parsing/dedupe helper, feedback via analysis results. |

## Stash conventions

- **i18n**: dictionary-less inline `t(es, en)` from `shared/lib/i18n.ts` — Spanish first (es is the app's default language), English second. Every user-visible string carries both. Language change re-renders live (app root keyed by `lang`); `setLang` persists to `stash.lang`. Never port `data-en`/`data-en-ph`/`data-en-title` attributes.
- **Backend error strings**: Rust commands return `Err(String)` product copy in Spanish (no backend i18n yet) — show as the toast body (contract: backend skill, error-handling reference).
- **localStorage**: prefix `stash.` for new keys (`stash.lang`, `stash.recentLinks`); legacy `stash-theme`, `stash-onboarded` remain until migrated.
- **Theme**: CSS-vars palette in `shared/styles/globals.css` (`--bg`, `--panel`, `--accent: #7C6BF0`, `--danger`, soft variants, `--shadow`, ...), `data-theme` attribute, Tailwind `darkMode: "class"`, committed by `shared/stores/useUiStore.ts`.
- **Serde casing**: new Rust structs use `#[serde(rename_all = "camelCase")]`; legacy `AppConfig`, `VideoMeta` serialize snake_case — DTOs copy reality, mappers clean it. Never break this contract.
- **Commits**: English, `type(scope): description` (e.g. `feat(session): real logout`). Comments: English, max ~2 lines, explain the why.
- **Const-object enums in use**: `QueueStatus`, `SessionStatus` (not `AuthStatus` — that is web-only).

## Grounding pointers (real files)

| What | Where |
|---|---|
| Typed invoke + onEvent facade | `src/shared/lib/tauri.ts` |
| Window helpers | `src/shared/lib/window.ts` |
| i18n helper | `src/shared/lib/i18n.ts` |
| queryClient singleton | `src/shared/lib/query-client.ts` |
| Event hook | `src/shared/hooks/useTauriEvent.ts` |
| Router / paths / shell | `src/shared/routes/` (`router.tsx`, `app-path.ts`, AppShell/Sidebar/Titlebar) |
| Queue store (+ tests) | `src/features/queue/stores/useQueueStore.ts` |
| Command registration | `src-tauri/src/main.rs` (`generate_handler![]`) |
| Lint boundaries | `eslint.config.js` (boundaries plugin + Tauri encapsulation rule) |

## Verification commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src (boundaries plugin enforces layer imports)
npm run test        # vitest run
npm run check       # typecheck + lint + cargo check
```

If a script fails for tooling reasons, check `package.json` for its current
form instead of assuming.
