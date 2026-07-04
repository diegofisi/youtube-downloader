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

- **i18n**: typed message object — `t.search.emptyTitle()` / `t.queue.subtitle({ active, done })` from `shared/lib/messages/t.ts`; all languages live in `shared/lib/messages/{es,en}.ts` (typed by `messages/keys.ts`); engine `translate()` in `shared/lib/i18n.ts`. Semantic keys namespaced by feature (`common.*`/`shell.*` for shared). ICU-lite templates handle `{name}` + `{n, plural, …}`. Language change re-renders live (app root keyed by `lang`); `setLang` persists to `stash.lang`. See "Frontend system updates" below. Never port `data-en`/`data-en-ph`/`data-en-title` attributes.
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
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # eslint src (boundaries plugin enforces layer imports)
pnpm run test        # vitest run
pnpm run check       # typecheck + lint + cargo check
```

If a script fails for tooling reasons, check `package.json` for its current
form instead of assuming.

## Frontend system updates (2026-07)

- **Typography**: a single `<Text variant="..." as="..." color="..." weight="...">`
  component in `src/shared/components/ui/typography.tsx`. The `H1`–`H6`/`P`/`Small`/`Span`
  wrappers were removed. Sizes are `--text-*` tokens in
  `src/shared/styles/globals.css` (`@theme`): micro UI chrome
  (`micro`/`caption`/`small`/`body-sm`) is FIXED so labels don't shift ~1px on
  large windows; content (`body`/`lead` + headings) is FLUID `clamp()` that grows
  to ~1440px viewport then hard-caps. `cn` (`src/shared/lib/utils.ts`) extends
  `tailwind-merge` to register those tokens as `font-size` (else the size class is
  silently dropped). New size = new variant, never inline `text-[..px]`.
- **Tailwind v4**: CSS-first, no `tailwind.config.js`. The two-layer palette
  (`:root` raw vars + `@theme inline` re-exposing them) is the correct idiom for
  runtime dark-mode — do NOT collapse it. Notes: gradient utilities are
  `bg-linear-to-*` / `bg-radial` / `bg-conic` in v4 (NOT the v3 `bg-gradient-to-*`);
  use the `/opacity` modifier (`bg-warn/32`) over inline `color-mix` for static
  colors; dark-ink-on-color needs a token (`--color-warn-foreground`,
  `--color-success-foreground`) — never a raw `text-[#hex]`. The media grids
  already use an intrinsic `grid-cols-[repeat(auto-fill,minmax(216px,1fr))]` that
  reflows to the panel width — that is the correct responsive primitive here, so
  do NOT "upgrade" them to container queries.
- **Canonical classes**: prefer canonical/token forms over arbitrary values that
  have an exact equivalent (`rounded-t-[12px]`→`rounded-t-xl`, `text-[#241600]`→
  `text-warn-foreground`). BUT do **not** fix canonical-class warnings inside the
  vendored Shadcn primitives in `shared/components/ui/` (`button`/`dialog`/`select`/
  `switch`/`separator`/`label` — anything importing `@radix-ui`) — they are
  regenerated by the CLI; leave them as-is.
- **Shared primitives**: `IconButton` (`shared/components/ui/IconButton.tsx`) is the
  32px square bordered icon action, promoted to `shared/` because the same pattern
  recurs across features (which may not import each other).
- **i18n**: a typed message **object** `t` (`src/shared/lib/messages/t.ts`, generated
  from the key union), backed by per-language catalogs
  (`src/shared/lib/messages/{es,en}.ts`, typed by `messages/keys.ts`, 256 keys) and
  the `translate()` engine in `src/shared/lib/i18n.ts`. Call sites use object access
  — `t.queue.title()`, `t.download.minAgo({ m })`, `t.search.noResultsFor({ query,
  filter })` — never raw key strings (autocomplete + go-to-def + per-message typed
  params; a wrong path/param is a compile error). Every string, static and dynamic,
  is keyed with a semantic feature-namespaced key (`common.*`/`shell.*` for shared);
  NOTHING is inline at the call site. Catalog values are ICU-lite: `{name}`
  interpolation + `{n, plural, one {# x} other {# xs}}` (`=0` cases, `#` = number),
  rendered by a tiny dependency-free formatter in `i18n.ts`. Accessor is named `t`
  (not `m` — `m` collides with local minute vars). Add/edit a language = edit/add a
  `messages/{lang}.ts`; **call sites never change**. A later Paraglide upgrade is
  trivial (keys exist).
- **Barrels/facades**: keep the 3 sanctioned facades (`download`/`queue`/`session`
  `index.ts`) — they are the cross-feature encapsulation seam and cost ~nothing at
  this scale. Keep them PURE (only `export`/`export type … from`, no top-level
  side effects) and verify their re-exported components have no module-level side
  effects. Add `import/no-cycle` and a lint forbidding any OTHER `index.ts`. The
  `@/` alias is path-resolution only — it gives neither tree-shaking nor
  encapsulation. Vite never natively optimizes app-source barrels (Vite 8's
  `lazyBarrel` is opt-in/off by default).
- **Container/Component exemplar**: `features/session` — the banner was split into
  `containers/SessionExpiredBanner.tsx` (logic only) + `components/SessionExpiredBannerView.tsx`
  (dumb view). Follow that split; a container's JSX renders components, never raw markup.
