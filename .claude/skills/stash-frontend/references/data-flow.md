# Data flow — Adapter Pattern over `invoke()`

Absorbs base guideline §3 (Strict Data Flow), §4.1 (Models vs DTOs), §4.2 (API Subfolder Pattern), §4.3 (Query hook), §4.4 (Mutation hook), adapted to Tauri transport. §4.12 (HTTP client) is replaced — see Adaptation 1 and `web-app-patterns.md`.

## The Adapter Pattern flow (§3)

```
┌─────────────────────────────────┐     ┌──────────────┐     ┌──────────────┐
│       api/[endpoint]/           │────>│  Container   │────>│  Component   │
│  [endpoint].dto.ts              │     │  (UI logic)  │     │  (pure UI)   │
│    ├── DTO types (Rust mirror)  │     │  consumes    │     │  receives    │
│    └── Mappers (DTO→Model)      │     │  Domain      │     │  Domain      │
│  use[Action].ts                 │     │  Model       │     │  Model       │
│    └── RQ hook (returns Model)  │     │              │     │  via props   │
└─────────────────────────────────┘     └──────────────┘     └──────────────┘
```

### Layer responsibilities (§3, all six)

| Layer | Responsibility |
|---|---|
| 1. DTO + Mapper (`api/[endpoint]/[endpoint].dto.ts`) | Types that **mirror** the Rust struct's serialized JSON (`XDTOResponse`/`XDTORequest`) + **pure mapper functions** (`toModel`, `toDTO`) in the same file. |
| 2. Hook (`api/[endpoint]/use[Action].ts`) | React Query hook. Queries use `select` with the mapper; mutations map inside `mutationFn`. Imports DTOs/mappers from its sibling `.dto.ts`. |
| 3. Model (`models/*.model.ts`) | Types **optimized for the frontend**: camelCase, `Date` objects, clean booleans. Source of truth for the UI. |
| 4. Container (`containers/XContainer.tsx`) | Connects hooks/stores to presentational components. Works only with Models. `mutate` + callbacks. **Never imports/renders other containers** — cross-container orchestration belongs to the Page. See `containers-pages.md`. |
| 5. Component (`components/X.tsx`) | Pure UI. Receives Models via props. Zero knowledge of API or state management. |
| 6. Page (`pages/XPage.tsx`) | Composition Root — Pattern A (absorbs), B (orchestrates), or C (page + hook). See `containers-pages.md`. |

## Adaptation 1 — Transport (OVERRIDES guideline §4.12)

**Differs from the base guideline because** Stash is a Tauri desktop app with no HTTP backend: there is no axios, no `http-client.ts`, no JWT, no interceptors, no 401/refresh flow. Guideline §4.12 does not apply. The fetcher inside every React Query hook is the **typed `invoke()` wrapper** from `src/shared/lib/tauri.ts` (`@/shared/lib/tauri`). Errors are `Err(String)` from Rust commands — `invoke` rejects with that string; there is no status code.

Everything else in the guideline's Adapter Pattern (§3, §4.1–4.4) applies unchanged:

- **DTO** = the TS mirror of the Rust struct's serialized shape (the vanilla `*.types.ts` files played this role). Mirror the **actual serde casing**: new Rust structs use `#[serde(rename_all = "camelCase")]`, but legacy ones like `AppConfig` serialize snake_case — the DTO copies reality, the mapper cleans it.
- **Mapper** = pure `toModel` function co-located in the `.dto.ts` file (never a separate mapper file).
- **Model** = camelCase, `Date`/clean types, in `models/*.model.ts` — the only thing the UI sees.

## API subfolder pattern (§4.2)

```text
features/library/api/
  ├── get-history/
  │    ├── get-history.dto.ts       # LibraryEntryDTOResponse + toLibraryEntry mapper
  │    └── useGetHistory.ts         # useQuery hook
  ├── remove-history-item/
  │    └── useRemoveHistoryItem.ts  # id-only mutation → DTO-file exception applies
  └── delete-history-file/
       ├── delete-history-file.dto.ts
       └── useDeleteHistoryFile.ts
```

Rules (§4.2, unchanged):
- Subfolder name: `kebab-case` matching the command action (`get-history/`, `set-settings/`).
- DTO file `[endpoint].dto.ts` contains DTO types **and** mapper functions. Hook file `use[Action].ts` contains the React Query hook.
- **Every API subfolder gets a separate `.dto.ts`**, even for tiny DTOs — never inline DTO interfaces in the hook file. Only exception: mutations with no request body and no response body (e.g. `clear_history`, or id-only calls like `remove_history_item`).
- A DTO **shared** by several endpoints lives in the most fundamental subfolder (e.g. `LibraryEntryDTOResponse` in `get-history/get-history.dto.ts`, imported by `add-history/`).
- Mappers always live inside the `.dto.ts` — **never** a standalone `helpers/*.mapper.ts`.

## Query hook (read command)

```typescript
// features/settings/api/get-settings/get-settings.dto.ts
import type { Settings } from "../../models/settings.model";

// Mirror of Rust AppConfig (serializes snake_case — copy reality, don't "fix" it here)
export interface SettingsDTOResponse {
  download_folder: string;
  default_quality: string;
  default_container: string;
  default_audio_format: string;
  default_concurrency: number;
  default_mode: string;
  default_template: string;
  default_subtitles: boolean;
  default_thumbnail: boolean;
  clear_links_after_preview: boolean;
}

export const toSettings = (dto: SettingsDTOResponse): Settings => ({
  downloadFolder: dto.download_folder,
  defaultQuality: dto.default_quality,
  // ... one camelCase field per DTO field
});
```

When a command **receives** data, the reverse mapper (Model → DTO, §4.1 `toXDTO`) also lives in the DTO file:

```typescript
// features/settings/api/set-settings/set-settings.dto.ts
// set_settings takes camelCase args (Tauri command params), so the request DTO is camelCase
export interface SetSettingsDTORequest {
  defaultQuality: string;
  defaultConcurrency: number;
  // ... mirrors the Rust command's parameters exactly
}

export const toSetSettingsDTO = (model: Settings): SetSettingsDTORequest => ({
  defaultQuality: model.defaultQuality,
  defaultConcurrency: model.defaultConcurrency,
  // ...
});
```

```typescript
// features/settings/api/get-settings/useGetSettings.ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { invoke } from "@/shared/lib/tauri";
import type { Settings } from "../../models/settings.model";
import { toSettings, type SettingsDTOResponse } from "./get-settings.dto";

export function useGetSettings(
  options?: Omit<
    UseQueryOptions<SettingsDTOResponse, Error, Settings>,
    "queryKey" | "queryFn" | "select"
  >,
) {
  return useQuery<SettingsDTOResponse, Error, Settings>({
    queryKey: ["settings"],
    queryFn: () => invoke<SettingsDTOResponse>("get_settings"),
    select: toSettings, // Adapter: DTO → Model
    ...options,
  });
}
```

## Mutation hook (write command)

```typescript
// features/library/api/delete-history-file/useDeleteHistoryFile.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@/shared/lib/tauri";

export type DeleteFileOutcome = "trash" | "permanent" | "no_file";

export function useDeleteHistoryFile() {
  const queryClient = useQueryClient();
  return useMutation<DeleteFileOutcome, Error, { id: string }>({
    mutationFn: ({ id }) => invoke<DeleteFileOutcome>("delete_history_file", { id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
}
```

Rules (guideline §4.3–4.6 apply as-is):
- **Generic typing (§4.3 strict rule):** query hooks are typed `<TQueryFnData, TError, TData>` (DTO, Error, Model) and accept external `options` via `Omit<..., "queryKey" | "queryFn" | "select">` — this is what makes the Adapter Pattern composable.
- **Mutations map in `mutationFn` (§4.4):** when a mutation sends/returns mapped data: `mutationFn: async (model) => toModel(await invoke<XDTOResponse>('cmd', toXDTO(model)))`.
- Command args go as the second `invoke` argument object; arg keys match the Rust command's parameter names (camelCase — Tauri converts).
- Containers/pages call `mutate` with `onSuccess`/`onError` callbacks. **Never** `mutateAsync` + try/catch.
- Query keys: `['{feature}', ...detail]` — `['settings']`, `['settings', 'downloadFolder']`, `['library']`, `['session', 'status']`, `['session', 'account']`, `['setup', 'dependencies']`, `['search', query]`, `['youtube-account', 'feed', source]`.
- Cache invalidation in the hook's `onSuccess` when it is intrinsic (a write that stales its own list); in the container's callback when it is contextual (navigation, toast).

## Adaptation 2 — Tauri events (NEW pattern, not in the base guideline)

**Differs from the base guideline because** the guideline has no push channel at all; in Stash, Tauri events are the desktop equivalent of websockets. Rust emits progress/completion events that must feed Zustand stores or invalidate queries.

```typescript
// shared/hooks/useTauriEvent.ts
import { useEffect, useRef } from "react";
import { onEvent } from "@/shared/lib/tauri";

// Subscribes to a backend event for the component's lifetime.
// handler goes through a ref so re-renders never resubscribe.
export function useTauriEvent<T>(name: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onEvent<T>(name, (payload) => handlerRef.current(payload)).then((fn) => {
      // listen() resolves async: if we unmounted meanwhile, release immediately
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [name]);
}
```

### Event inventory and wiring

| Event | Payload (Rust contract) | Scope | Wire it |
|---|---|---|---|
| `download-progress` | `{ percent, speed, eta, status: 'downloading'\|'processing', url }` | **Global** — queue must advance even when `/cola` is not mounted | Module-level `onEvent` at queue store setup → `useQueueStore.getState().handleProgress(...)`. NOT `useTauriEvent`. |
| `cookies-extracted` | `boolean` (success) | **Global** — session can be renewed from any view | Module-level `onEvent` at session wiring → refetch `['session', 'status']` via `queryClient.invalidateQueries` |
| `setup-progress` | `{ step, percent, message }` | View-scoped (onboarding dialog) | `useTauriEvent('setup-progress', cb)` in the onboarding container |
| `preview-progress` | `[done, total]` tuple | View-scoped (Descargar analysis) | `useTauriEvent('preview-progress', cb)` in the Descargar page/hook |

Rules:
- **Global events** (must outlive any route) are wired once, in plain modules imported from `main.tsx`, using `onEvent` directly and `useXStore.getState()` / the exported `queryClient` singleton. A mounted component must not be a prerequisite for the queue to progress.
- **View-scoped events** use `useTauriEvent`; cleanup is automatic on unmount.
- Handlers either (a) call a store action or (b) invalidate/refetch a query. They never hold their own component state as the source of truth for cross-view data.
- Do not poll (`refetchInterval`) for anything an event already reports. Exception: `['session', 'status']` keeps `refetchInterval: 10 * 60 * 1000` because cookie expiry has no event (ports the vanilla `setInterval`).

## Adaptation 3 — Decision table: all 21 commands

**Differs from the base guideline because** the guideline assumes every server interaction is request/response. Stash has **live processes** (yt-dlp downloads driven by a scheduler): those commands are invoked by the Zustand queue store, not by React Query hooks. Full store spec in `state.md`.

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
| `refresh_session_silent` | Mutation (single-flight, see state.md) | `attemptSilentReconnect` plain fn (session facade export) | inv. `['session']` |
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

## Do / Don't

| Do | Don't |
|---|---|
| `queryFn: () => invoke<XDTOResponse>('command_name', args)` | Import axios/fetch or invent an http-client |
| Mirror the Rust struct's real casing in the DTO | "Fix" casing in the DTO and skip the mapper |
| `select: toModel` for queries; map inside `mutationFn` for mutations | Return DTOs from hooks or pass them to components |
| Wire global events at store/module level once | Subscribe to `download-progress` inside a component |
| `useTauriEvent` for view-scoped progress | Leak listeners (missing unlisten) or resubscribe every render |
| Check the decision table before writing a hook | Wrap `start_download`/`cancel_download` in `useMutation` |
