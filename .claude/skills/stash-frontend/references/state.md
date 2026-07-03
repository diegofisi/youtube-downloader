# State — Zustand rules, the queue store, anti-race patterns

Absorbs base guideline §4.8 (Zustand Store) in full, plus the Stash-specific queue/live-process adaptation.

## General Zustand rules (§4.8, applies as-is)

- Stores hold **client-side UI state** (selections, filters, modals) and — Stash extension — **live-process state**; request/response server data belongs in React Query (see `data-flow.md` decision table).
- Stores work with Domain Models, never DTOs.
- Type the store interface explicitly — **separate State from Actions** for clarity.
- Always provide a `reset()` action to clear state.
- File name: `use[Domain]Store.ts`.
- **Derive initial state** from external sources via helper functions — never hardcode values that should be dynamic.
- Non-React contexts (event listeners, scheduler internals, other stores) use `useXStore.getState()` / `useXStore.setState()` — the desktop analogue of the guideline's `useAuthStore.getState().logout()` interceptor rule.

### Canonical shape (§4.8)

```typescript
// features/download/stores/useDownloadUiStore.ts
import { create } from "zustand";
import type { AnalyzedVideo } from "../models/video.model";

interface DownloadUiStore {
  // State
  selected: AnalyzedVideo | null;
  filters: { search: string; onlyPlaylists: boolean };
  // Actions
  setSelected: (v: AnalyzedVideo | null) => void;
  setFilters: (f: Partial<DownloadUiStore["filters"]>) => void;
  reset: () => void;
}

const initialState = {
  selected: null,
  filters: { search: "", onlyPlaylists: false },
};

export const useDownloadUiStore = create<DownloadUiStore>((set) => ({
  ...initialState,
  setSelected: (selected) => set({ selected }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  reset: () => set(initialState),
}));
```

### Derived initial state pattern (§4.8)

When initial state depends on external sources (`localStorage`), derive it via a helper. **NEVER** hardcode initial values that should be dynamic — hardcoding breaks app restart (the Stash equivalents of the guideline's auth example are lang/theme/onboarded flags):

```typescript
// Stash example: ui store seeded from localStorage keys
const getInitialLang = (): Lang => {
  try {
    return localStorage.getItem("stash.lang") === "en" ? "en" : "es";
  } catch {
    return "es";
  }
};

const initialState = { lang: getInitialLang(), theme: getInitialTheme() };
```

> The base guideline's auth-flavored version of this pattern (token → `AuthStatus.Idle`) is preserved in `web-app-patterns.md`.

## Adaptation 3 (detail) — The queue is a live process, not a query

**Differs from the base guideline because** the guideline's "server state → React Query" rule assumes request/response. Stash's download queue is a **scheduler driving long-lived yt-dlp processes** with pause/resume/reorder and event-fed progress: caching, staleness and refetching are meaningless for it. The existing framework-agnostic `src/features/queue/queue.state.ts` (already DOM-free, subscribe-based, unit-tested) is **wrapped in / ported to a Zustand store**, preserving its semantics verbatim.

### `features/queue/stores/useQueueStore.ts` — spec

State and actions map 1:1 to today's module:

| Today (`queue.state.ts`) | Store equivalent | Preserve exactly |
|---|---|---|
| `items: QItem[]`, `concurrency` | state fields | `QItem`/`QStatus`/`EnqueueItem` types port as-is (become models) |
| `subscribe(fn)` / `notify()` | Zustand's built-in subscription | notifications stay synchronous (Zustand is) |
| `getItems()` | selectors: `(s) => s.items` | components select narrowly (per-item where possible) |
| `enqueue(list)` | action | dup check on pending statuses + "Ya está en la cola / Already in the queue" toast |
| `pump()` (internal) | internal fn using `get()`/`set()` | fills slots while `activeCount() < concurrency`; `setConcurrency(n <= 0 ? Infinity : n)` |
| `run(it)` → `startDownload` | internal fn; **plain `invoke` via the feature's api fetcher, NOT useMutation** | `runSeq` guard: stale settlements (fast pause→resume) are ignored |
| resume keeps `progress` | keep | yt-dlp continues the `.part` file — don't reset on resume; reset only on `retry` |
| `errorKind === 'auth'` → pause item + all queued, `pausedByAuth`, then silent reconnect | keep | protects the batch from burning on expired cookies |
| `authReconnectInFlight` single-flight | module-level flag or store field | one reconnect attempt no matter how many items fail at once |
| `handleProgress(url, ...)` | action, called by the **global** `download-progress` listener (see data-flow.md) | `status === 'processing'` → `merging`; only match items in `downloading`/`merging` |
| `action(id, 'pause'|'resume'|'retry'|'cancel'|'remove'|'folder')` | actions (may split into named actions) | pause/cancel call `cancel_download`; folder resolves `filePath` dir → `folder` → `get_download_folder` |
| `move(id, dir)`, `retryAllFailed()`, `clearFinished()` | actions | clearFinished removes only `done`/`canceled` — `error` items keep their own retry |
| `bus.emit('queue:count')` | **dies** → derived selector | `selectActiveCount = (s) => s.items.filter(i => ['downloading','queued','paused','merging'].includes(i.status)).length`; sidebar badge subscribes to it |
| `bus.emit('download:completed')` | **dies** → on completion the store calls `add_history` (plain invoke) then `queryClient.invalidateQueries({ queryKey: ['library'] })` | history failure must not break the flow (try/catch kept); consumers read the library query instead of listening to a bus |

The store imports: its own api fetcher functions (plain `invoke` wrappers), the exported `queryClient` singleton (`shared/lib/query-client.ts`), `t()` and `showToast` — never React.

```typescript
// Sketch — internals stay functions over get()/set(), like today's module
export const useQueueStore = create<QueueStore>((set, get) => ({
  items: [],
  concurrency: 5,
  enqueue: (list) => { /* dup-check, push, */ notifyPump(get) },
  handleProgress: (p) => set((s) => ({ items: patchProgress(s.items, p) })),
  // pause/resume/retry/cancel/remove/move/retryAllFailed/clearFinished...
}));
```

## Session state

| Today | React target |
|---|---|
| `session.state.ts` module var `status` + bus events | `['session', 'status']` query (poll 10 min) is the source of truth for UI; a thin `useSessionStore` keeps only what non-React code needs synchronously: `getCookieMode()` for enqueue (`'none'` if no session, else `'file'`) |
| `silentReconnectInFlight` shared-promise single-flight | **survives** as-is (module-level promise in the session api/store). React Query dedupes queries, not imperative mutations — keep the shared promise |
| `session:expired` / `session:connected` bus events | die → shell banner derives from the status query (`status === 'expired' && !dismissed`); `dismissed` is local shell state |
| `onCookiesExtracted` → refresh | global `cookies-extracted` listener → invalidate `['session']` |

## What dies vs. what survives (anti-race audit)

| Pattern (today) | Fate | Why |
|---|---|---|
| `loadSeq` in `shared/ui/paged-loader.ts` (stale loads discarded on new source/search) | **Dies** | `useInfiniteQuery` keyed by `['search', q]` / `['youtube-account','feed',src]` discards stale results by key change; `isFetching` replaces `loadingMore` |
| `appendUnique` cross-page dedupe (feed may shift between requests) | **Survives** inside `select` of the infinite query — dedupe pages by `VideoMeta.id` when flattening | React Query appends pages verbatim; the feed-shift problem is domain-specific |
| `begin()/loadFirst()` token protocol | **Dies** | changing the query key IS the new load |
| `runSeq` per queue item | **Survives** in the queue store | React Query never owns downloads; the fast pause→resume race is still real |
| `authReconnectInFlight` (queue) | **Survives** | imperative single-flight, no RQ equivalent |
| `silentReconnectInFlight` shared promise (session) | **Survives** | same |
| `setInterval(refreshSession, 10 min)` | **Dies** | `refetchInterval` on the status query |
| Typed bus (`core/bus/event-bus.ts`) | **Mostly dies** | see table below |

### Bus event migration

| Bus event | React replacement |
|---|---|
| `queue:count` | queue store selector (sidebar badge) |
| `download:completed` | `['library']` invalidation from the queue store |
| `session:expired` / `session:connected` / `session:changed` | `['session','status']` query + shell-local dismissed state |
| `theme:changed` | theme store/state in shell (see conventions.md) |
| `nav:changed` / `nav:goto` | react-router navigation with path constants |
| `descargar:prefill` | navigate to `AppPath.DESCARGAR` with router state (`navigate(AppPath.DESCARGAR, { state: { urls } })`) — the page consumes `location.state` and triggers analysis |

## Do / Don't

| Do | Don't |
|---|---|
| Keep scheduler logic inside the queue store, testable without React (like today's `queue.state.test.ts`) | Move pump/run logic into components or effects |
| Use `queryClient` singleton from stores for invalidation | Import React hooks into a store file |
| Preserve `runSeq`, auth-pause, single-flight semantics verbatim | "Simplify" races away — each guard exists for a reproduced bug |
| Narrow selectors (`useQueueStore(s => s.items)`, count selector for the badge) | Subscribe whole components to the entire store |
| `reset()` on every store | Hardcode initial state that mirrors `localStorage` |
