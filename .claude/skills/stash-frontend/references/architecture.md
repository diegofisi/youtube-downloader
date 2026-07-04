# Architecture — Core philosophy, directory structure, Stash React target

Absorbs base guideline §1 (Core Philosophy), §2 (Directory Structure) and §4.15 (Cross-Feature Data Access), applied to Stash.

## Core philosophy (§1)

We prioritize **Separation of Concerns**, **Domain Integrity**, and **Composition**.

- **No Div Soup:** strictly avoid raw `<div>` for layout. Use Layout Primitives (`Stack`, `Grid`, `Box`).
- **Smart vs. Dumb:** logic (Containers) != UI (Components).
- **Domain Integrity:** the UI layer **NEVER** consumes DTOs directly. It only consumes **Domain Models**.
- **Vertical Slicing:** features are self-contained domains (in Stash: `download`, `queue`, `library`, ...).
- **Co-location:** each Tauri command endpoint owns its DTO, mapper, and React Query hook in a single subfolder.

## Directory structure (§2)

Vertical slices + shared layer, mapped to Stash's real domains. The pre-cutover vanilla-TS slices (`download,library,preview,queue,search,session,settings,setup,youtube-account`) migrated 1:1 — except `preview`, which dissolved (see below).

## Directory tree (current)

```text
src/
 ├── shared/
 │    ├── components/
 │    │    ├── ui/            # Shadcn primitives + typography + PageLoading/PageError/PageEmpty
 │    │    └── layout/        # Stack, Grid, Box
 │    ├── hooks/              # useTauriEvent...
 │    ├── lib/                # tauri.ts (typed invoke + onEvent facade), window.ts (min/max/close),
 │    │                       #   i18n.ts (t(es,en)), query-client.ts, utils.ts (cn)
 │    ├── stores/             # useUiStore (lang + theme)
 │    ├── styles/             # globals.css (Tailwind + the Stash CSS-vars palette, formerly styles/stash.css)
 │    └── routes/             # SHELL layer: router.tsx, app-path.ts, AppShell/Sidebar/Titlebar (see routing-shell.md)
 │
 ├── features/
 │    ├── download/           # "Descargar" view: URL input, analysis, options, enqueue
 │    │    ├── api/
 │    │    │    ├── analyze-urls/        # useAnalyzeUrls (mutation — one-shot paste analysis)
 │    │    │    └── ...
 │    │    ├── components/    # url input, preview cards, video-opts dialog, recent links
 │    │    ├── containers/    # only if the page grows multiple operations
 │    │    ├── models/        # analyzed.model.ts, download-opts.model.ts (ports the vanilla opts-model)
 │    │    ├── helpers/       # opts.ts, parse-urls.ts, recent-links.ts, format.ts
 │    │    ├── hooks/
 │    │    ├── index.ts       # sanctioned facade (useDownloadPrefill — prefill contract)
 │    │    └── pages/         # DescargarPage.tsx
 │    ├── search/             # api/search-videos/ (local analyze_urls infinite hook), pages/BuscarPage.tsx
 │    ├── youtube-account/    # api/get-account-feed/ (local analyze_urls infinite hook), pages/YoutubePage.tsx
 │    ├── queue/              # stores/useQueueStore.ts (scheduler — see state.md), components/, pages/ColaPage.tsx,
 │    │                       #   index.ts facade (useQueueStore + EnqueueItem — enqueue contract)
 │    ├── library/            # api/get-history/, remove-history-item/, delete-history-file/,
 │    │                       #   clear-history/, open-history-folder/; models/library-entry.model.ts; pages/BibliotecaPage.tsx
 │    ├── session/            # api/get-session-status/, get-account-info/, open-youtube-login/,
 │    │                       #   refresh-session-silent/, logout/; index.ts facade (session hooks)
 │    ├── settings/           # api/get-settings/, set-settings/, get-download-folder/, set-download-folder/,
 │    │                       #   open-downloads-folder/; helpers/settings.schema.ts; pages/AjustesPage.tsx
 │    └── setup/              # api/check-dependencies/, download-dependencies/; components/OnboardingDialog
 │
 └── main.tsx                 # QueryClientProvider + RouterProvider + global event wiring
```

### Purpose of each folder inside a feature (§2 table)

| Folder | Purpose | Stash example |
|---|---|---|
| `api/` | **Subfolders per endpoint** (Tauri command). Each contains a `.dto.ts` (types + mapper) and a React Query hook. | `api/get-history/get-history.dto.ts`, `api/get-history/useGetHistory.ts` |
| `components/` | **Dumb/presentational**. Only receive props, no logic. | `MediaCard.tsx`, `QueueItemRow.tsx` |
| `containers/` | **Smart**. Connect hooks/stores to presentational components. Single responsibility: flat file. Multiple operations: folder with orchestrator + leaves (see `containers-pages.md`). | `AccountFeedContainer.tsx` |
| `interfaces/` | TS interfaces for props, events, feature contracts. | `MediaCardProps.ts` |
| `models/` | **Domain Models** optimized for the frontend (camelCase, clean types). | `library-entry.model.ts` |
| `pages/` | **Composition Root.** Orchestrates containers, manages inter-container state (dialogs, selections). Only layer that imports containers. | `BibliotecaPage.tsx` |
| `stores/` | Zustand stores. UI/live-process state using **Domain Models**. | `useQueueStore.ts` |
| `hooks/` | **Custom hooks only** (NOT React Query hooks — those live in `api/`). | `useDescargarPrefill.ts` |
| `helpers/` | **Zod schemas** and pure utility functions for the feature. | `settings.schema.ts` |
| `layout/` | Layout wrappers specific to the feature. | rarely needed in Stash |

> Not every feature needs all folders. Only create the folders the feature actually uses.

## Feature → responsibility map

| Feature | Route/page | Data shape | Notes |
|---|---|---|---|
| `download` | `/descargar` | mutation (analyze) + queue store (enqueue) | Owns `DownloadOptions` model + options dialog. Recent links in `localStorage` (`stash.recentLinks`). |
| `search` | `/buscar` | infinite query over `analyze_urls` | Local hook; client-side filtering keeps raw-count logic in `select`. |
| `youtube-account` | `/youtube` | infinite query over `analyze_urls` (feeds) + session queries | Feed source tabs; "already downloaded" derives from the library query. |
| `queue` | `/cola` | Zustand store (scheduler) | NOT React Query. See `state.md`. Sidebar badge reads a store selector. |
| `library` | `/biblioteca` | query + mutations | `get_history` list, per-item mutations invalidate `['library']`. |
| `session` | (no page — banner + account card) | queries + mutations (no store; single-flight lives in the api module) | Status query with `refetchInterval: 10 * 60 * 1000` replaced the vanilla `setInterval`. |
| `settings` | `/ajustes` | query + mutations + RHF form | DTO is snake_case (Rust `AppConfig`) — mapper is mandatory, see data-flow.md. |
| `setup` | (dialog at startup, no route) | query + mutation + `setup-progress` event | Onboarding gate before the shell; `stash.onboarded` flag. |

## Cross-feature data access — no cross-imports (§4.15)

Features must **never** import from other features, with ONE sanctioned exception (enforced by `eslint.config.js`): the app-level contracts exposed by the `index.ts` **facades** of `@/features/queue` (useQueueStore + EnqueueItem — enqueue contract), `@/features/session` (status/account/login/logout/reconnect hooks) and `@/features/download` (useDownloadPrefill — prefill contract). Deep paths (`@/features/queue/stores/...`) always fail lint. For anything else, create a **local hook** inside the consuming feature that calls the command directly.

**Why not share the hook?** Cross-feature imports create coupling: if the source feature changes its DTO or model, it must not break consumers. Each feature owns its own adapter for the data it consumes.

Rules:
- The local hook maps only the **fields it needs** (not the source feature's full model).
- Use a **distinct `queryKey`** to avoid cache collisions with the source feature's hooks.
- The DTO/mapper can be minimal — only what the consuming feature actually uses.

```typescript
// features/search/api/search-videos/useSearchVideos.ts — calls analyze_urls but lives in search
export function useSearchVideos(query: string) {
  return useInfiniteQuery({
    queryKey: ["search", query],           // distinct key, no collision with other consumers
    queryFn: ({ pageParam }) =>
      invoke<VideoMetaDTO[]>("analyze_urls", { urls: [searchUrl(query)], ...pageParam }),
    select: toSearchResults,               // maps only the fields Search renders
    // ...
  });
}
```

### Where `preview` goes (§4.15 applied)

The vanilla `src/features/preview/` was a shared slice consumed by download, search and youtube-account. In React it **dissolved**: each consumer owns its **own local hook** in its own `api/` folder calling `analyze_urls`:

| Consumer | Local hook | Key |
|---|---|---|
| download | `api/analyze-urls/useAnalyzeUrls.ts` (mutation) | — |
| search | `api/search-videos/useSearchVideos.ts` (infinite) | `['search', query]` |
| youtube-account | `api/get-account-feed/useAccountFeed.ts` (infinite) | `['youtube-account', 'feed', source]` |

The analyzed-video DTO shape may be duplicated (trimmed) per consumer — that is the point: no feature imports another feature's DTOs, models, or hooks outside the three sanctioned facades. Ever.

## Dependency rules

Enforced by `eslint.config.js` (`eslint-plugin-boundaries`) with four element types — `main` (`src/main.tsx`), `shell` (`src/shared/routes` — the app composition layer), `shared`, `features`:

| From | May import | Never imports |
|---|---|---|
| `shared/` (except routes) | `shared/` only | anything in `features/` |
| `shell` (`shared/routes`) | `shared/`, `shell`, feature `index.ts` facades and `pages/*.tsx` | feature internals |
| `features/X` | `shared/`, own slice, `shared/routes/app-path.ts`, and the sanctioned `@/features/(queue\|session\|download)` `index.ts` facades | any other cross-feature path (deep paths always) |
| `main.tsx` | everything | — |

Within a feature, the guideline layering still applies: components stay props-only (models + `@/shared/lib/i18n`); containers connect hooks/stores to components; pages are the only layer that renders containers (guideline §3.6) — containers never render containers.

- **Tauri encapsulation** (`no-restricted-imports`): `invoke`/`onEvent` (via `@/shared/lib/tauri`) and `@tauri-apps/*` may only be used by `src/shared/lib/tauri.ts` itself, `src/shared/lib/window.ts`, `src/shared/hooks/useTauriEvent.ts`, and each feature's `api/` and `stores/` layers — never components/containers/pages.
- Cross-feature communication: the sanctioned facades above, React Query cache (invalidation), or route navigation with path constants — nothing else. The vanilla typed bus died with the cutover: its events map to store selectors and query invalidations (table in `state.md`).

## Layer summary (page / container / component)

| Layer | Knows about | Typical Stash example |
|---|---|---|
| Page | routes, dialog state, containers | `BibliotecaPage` owning the delete-confirm dialog state |
| Container | hooks + stores → props | `AccountFeedContainer` (feed query + enqueue action → `MediaGrid`) |
| Component | props only (Domain Models) | `MediaCard`, `QueueItemRow`, `SettingsForm` |

Not every feature needs all folders — create only what the feature uses (guideline §2 note).
