# State — Zustand rules, live-process stores, anti-race patterns

> **Read this when:** touching a Zustand store, a scheduler/live process, or
> any anti-race logic (stale results, single-flight, run-sequence guards).
> Covers general store rules plus the live-process store spec.

## General Zustand rules

- Stores hold **client-side UI state** (selections, filters, modals) and **live-process state**; request/response server data belongs in React Query (see `data-flow.md` → Endpoint classification).
- Stores work with Domain Models, never DTOs.
- Type the store interface explicitly — **separate State from Actions** for clarity.
- Always provide a `reset()` action to clear state.
- File name: `use[Domain]Store.ts`.
- **Derive initial state** from external sources via helper functions — never hardcode values that should be dynamic.
- Non-React contexts (event listeners, scheduler internals, other stores) use `use{X}Store.getState()` / `use{X}Store.setState()` — the same rule that lets an HTTP interceptor call `useAuthStore.getState().logout()` in web apps (see `web-app-patterns.md`).

### Canonical shape

```typescript
// features/{feature}/stores/useEntityUiStore.ts
import { create } from "zustand";
import type { Entity } from "../models/entity.model";

interface EntityUiStore {
  // State
  selected: Entity | null;
  filters: { search: string; onlyActive: boolean };
  // Actions
  setSelected: (e: Entity | null) => void;
  setFilters: (f: Partial<EntityUiStore["filters"]>) => void;
  reset: () => void;
}

const initialState = {
  selected: null,
  filters: { search: "", onlyActive: false },
};

export const useEntityUiStore = create<EntityUiStore>((set) => ({
  ...initialState,
  setSelected: (selected) => set({ selected }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  reset: () => set(initialState),
}));
```

### Derived initial state

When initial state depends on external sources (`localStorage`), derive it via
a helper. **NEVER** hardcode initial values that should be dynamic —
hardcoding breaks app restart (typical cases: language, theme, onboarding
flags; the project's real keys live in `project.md`):

```typescript
// ui store seeded from localStorage keys ({app} = the project's storage prefix)
const getInitialLang = (): Lang => {
  try {
    return localStorage.getItem("{app}.lang") === "en" ? "en" : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
};

const initialState = { lang: getInitialLang(), theme: getInitialTheme() };
```

> The auth-flavored version of this pattern (stored token → `AuthStatus.Idle`)
> lives in `web-app-patterns.md`.

## Choosing: useState / useReducer / Zustand / React Query

Escalate only as needed:
- **`useState`** — simple local state (a couple of independent primitives).
- **`useReducer`** — complex *local* state where several handlers drive related
  transitions, or you keep hitting bugs from bad updates. Not a substitute for
  `useMemo` chains, and never for derived data under react-hook-form.
- **Zustand** — state shared across components / surviving unmount / living
  outside the tree. Don't lift a reducer through context for this.
- **React Query** — server state. Never model server data in `useState`/`useReducer`/Zustand.

## Live-process stores — a scheduler is not a query

The "server state → React Query" rule assumes request/response. Some apps drive
**long-running processes** — e.g. a job queue driving external work with
pause/resume/reorder and event-fed progress. For those, caching, staleness and
refetching are meaningless: the process state lives in a Zustand store, and the
store's scheduler invokes the start/cancel endpoints directly (plain fetcher
calls, **never `useMutation`** — see `data-flow.md` → Endpoint classification).

### Job-queue store spec (archetype)

```typescript
// features/jobs/stores/useJobQueueStore.ts
// Sketch — internals stay plain functions over get()/set(), testable without React
export const useJobQueueStore = create<JobQueueStore>((set, get) => ({
  items: [],
  concurrency: 5,
  enqueue: (list) => { /* dup-check, push, */ pump(get) },
  handleProgress: (p) => set((s) => ({ items: patchProgress(s.items, p) })),
  // pause/resume/retry/cancel/remove/move/retryAllFailed/clearFinished...
}));
```

| Concern | Rule |
|---|---|
| State | `items: JobItem[]` (Domain Models with a status union), `concurrency` |
| Subscription | Zustand's built-in subscription; components select narrowly (per-item where possible) |
| `enqueue(list)` | dup-check against pending statuses; toast on duplicates |
| `pump()` (internal) | fills slots while `activeCount() < concurrency`; treat `concurrency <= 0` as unlimited if the domain wants it |
| `run(item)` | internal fn calling the start endpoint via a **plain fetcher**, not `useMutation` |
| **Run-sequence guard** | each run gets a `runSeq`; settlements from a stale run (fast pause→resume) are ignored |
| Resume semantics | if the backend can continue partial work, keep `progress` on resume; reset only on `retry` |
| Credential expiry | on an auth-type error: pause the failing item AND all queued items (protects the batch), flag them, then trigger ONE silent reconnect |
| **Single-flight reconnect** | a module-level flag/promise ensures one reconnect attempt no matter how many items fail at once |
| `handleProgress(...)` | action called by the **global** push-event listener (see `data-flow.md` → Event wiring); only patch items in active statuses |
| Item actions | `pause`/`resume`/`retry`/`cancel`/`remove`/`open-output`; pause/cancel call the cancel endpoint |
| Bulk actions | `move(id, dir)`, `retryAllFailed()`, `clearFinished()` — clearFinished removes only terminal-success/canceled items; errored items keep their own retry |
| Derived counts | expose selectors (`selectActiveCount = (s) => s.items.filter(...).length`); nav badges subscribe to the selector — never a bus event |
| Completion | the store records completion via a plain fetcher call (e.g. add-to-history endpoint), then `queryClient.invalidateQueries({ queryKey: [...] })` for the affected list; recording failure must not break the flow (try/catch) |
| Imports | its own api fetcher functions, the exported `queryClient` singleton, the i18n helper and the toast lib — **never React** |

## Session/credentials state (when the app has a renewable session)

| Concern | Pattern |
|---|---|
| Status source of truth | a `['session', 'status']`-style query (poll only if expiry has no push event) — usually **no session store** is needed |
| Silent reconnect | module-level **shared-promise single-flight** in the api module. React Query dedupes queries, not imperative mutations — keep the shared promise |
| "Session expired" banner | derives from the status query + local dismissed state in the shell — not a global event |
| Credentials-renewed push event | global listener → invalidate the session keys |

## Anti-race patterns — what React Query replaces vs what survives

When migrating imperative code (or designing new flows), audit every guard:

| Pattern | Fate under React Query | Why |
|---|---|---|
| Manual load-sequence tokens discarding stale list loads | **Dies** | keying the (infinite) query by `[feature, searchOrSource]` discards stale results on key change; `isFetching` replaces manual loading flags |
| Cross-page dedupe of shifting feeds | **Survives** inside `select` — dedupe pages by item id when flattening | React Query appends pages verbatim; feed shift is a domain problem |
| Per-item run-sequence guard in a live-process store | **Survives** | React Query never owns the process; the fast pause→resume race is still real |
| Single-flight shared promise for imperative reconnect | **Survives** | imperative mutations have no RQ dedupe |
| `setInterval` polling for a status | **Dies** | `refetchInterval` on the status query (and only where no push event exists) |
| Global typed event bus | **Mostly dies** | see below |

### Migrating off an event bus

| Bus event archetype | React replacement |
|---|---|
| "count changed" (nav badge) | store selector |
| "work completed" | query invalidation from the store |
| "session expired/connected" | status query + shell-local dismissed state |
| "theme changed" | ui store subscription |
| "navigate to X" | router navigation with path constants |
| "prefill view Y with data" | `navigate(AppPath.X, { state: {...} })` — the target page consumes `location.state` |

## Do / Don't

| Do | Don't |
|---|---|
| Keep scheduler logic inside the store, testable without React (`stores/useJobQueueStore.test.ts`) | Move pump/run logic into components or effects |
| Use the `queryClient` singleton from stores for invalidation | Import React hooks into a store file |
| Preserve run-sequence, batch-pause, single-flight semantics verbatim | "Simplify" races away — each guard exists for a reproduced bug |
| Narrow selectors (`useJobQueueStore(s => s.items)`, count selector for badges) | Subscribe whole components to the entire store |
| `reset()` on every store | Hardcode initial state that mirrors `localStorage` |
