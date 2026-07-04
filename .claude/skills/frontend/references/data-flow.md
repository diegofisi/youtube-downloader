# Data flow — the Adapter Pattern

> **Read this when:** writing any hook that touches a backend endpoint or a
> push event. Covers DTO → mapper → model, the api/ subfolder pattern,
> query/mutation hooks, endpoint classification, and event wiring.

## The Adapter Pattern flow

```
┌─────────────────────────────────┐     ┌──────────────┐     ┌──────────────┐
│       api/[endpoint]/           │────>│  Container   │────>│  Component   │
│  [endpoint].dto.ts              │     │  (UI logic)  │     │  (pure UI)   │
│    ├── DTO types (wire mirror)  │     │  consumes    │     │  receives    │
│    └── Mappers (DTO→Model)      │     │  Domain      │     │  Domain      │
│  use[Action].ts                 │     │  Model       │     │  Model       │
│    └── RQ hook (returns Model)  │     │              │     │  via props   │
└─────────────────────────────────┘     └──────────────┘     └──────────────┘
```

### Layer responsibilities (all six)

| Layer | Responsibility |
|---|---|
| 1. DTO + Mapper (`api/[endpoint]/[endpoint].dto.ts`) | Types that **mirror** the backend's serialized shape (`XDTOResponse`/`XDTORequest`) + **pure mapper functions** (`toModel`, `toDTO`) in the same file. |
| 2. Hook (`api/[endpoint]/use[Action].ts`) | React Query hook. Queries use `select` with the mapper; mutations map inside `mutationFn`. Imports DTOs/mappers from its sibling `.dto.ts`. |
| 3. Model (`models/*.model.ts`) | Types **optimized for the frontend**: camelCase, `Date` objects, clean booleans. Source of truth for the UI. |
| 4. Container (`containers/XContainer.tsx`) | Connects hooks/stores to presentational components. Works only with Models. `mutate` + callbacks. **Never imports/renders other containers** — cross-container orchestration belongs to the Page. See `containers-pages.md`. |
| 5. Component (`components/X.tsx`) | Pure UI. Receives Models via props. Zero knowledge of API or state management. |
| 6. Page (`pages/XPage.tsx`) | Composition Root — Pattern A (absorbs), B (orchestrates), or C (page + hook). See `containers-pages.md`. |

The DTO always mirrors the **actual wire casing** — if the backend serializes
snake_case (legacy structs, external APIs), the DTO copies reality and the
mapper cleans it. Never "fix" casing in the DTO and skip the mapper.

## API subfolder pattern

```text
features/{feature}/api/
  ├── get-entities/
  │    ├── get-entities.dto.ts      # EntityDTOResponse + toEntity mapper
  │    └── useGetEntities.ts        # useQuery hook
  ├── remove-entity/
  │    └── useRemoveEntity.ts       # id-only mutation → DTO-file exception applies
  └── update-entity/
       ├── update-entity.dto.ts
       └── useUpdateEntity.ts
```

Rules:
- Subfolder name: `kebab-case` matching the endpoint action (`get-entities/`, `update-entity/`).
- DTO file `[endpoint].dto.ts` contains DTO types **and** mapper functions. Hook file `use[Action].ts` contains the React Query hook.
- **Every API subfolder gets a separate `.dto.ts`**, even for tiny DTOs — never inline DTO interfaces in the hook file. Only exception: mutations with no request body and no response body (e.g. a clear-all action, or id-only calls like `remove-entity`).
- A DTO **shared** by several endpoints lives in the most fundamental subfolder (e.g. `EntityDTOResponse` in `get-entities/get-entities.dto.ts`, imported by `add-entity/`).
- Mappers always live inside the `.dto.ts` — **never** a standalone `helpers/*.mapper.ts`.

## Query hook (read endpoint)

```typescript
// features/preferences/api/get-preferences/get-preferences.dto.ts
import type { Preferences } from "../../models/preferences.model";

// Mirror of a legacy backend struct (serializes snake_case — copy reality, don't "fix" it here)
export interface PreferencesDTOResponse {
  default_output_format: string;
  default_locale: string;
  items_per_page: number;
  compact_mode: boolean;
}

export const toPreferences = (dto: PreferencesDTOResponse): Preferences => ({
  defaultOutputFormat: dto.default_output_format,
  defaultLocale: dto.default_locale,
  itemsPerPage: dto.items_per_page,
  compactMode: dto.compact_mode,
});
```

When an endpoint **receives** data, the reverse mapper (Model → DTO, `toXDTO`)
also lives in the DTO file:

```typescript
// features/preferences/api/set-preferences/set-preferences.dto.ts
export interface SetPreferencesDTORequest {
  defaultOutputFormat: string;
  itemsPerPage: number;
  // ... mirrors the endpoint's parameters exactly (whatever casing it really takes)
}

export const toSetPreferencesDTO = (model: Preferences): SetPreferencesDTORequest => ({
  defaultOutputFormat: model.defaultOutputFormat,
  itemsPerPage: model.itemsPerPage,
  // ...
});
```

```typescript
// features/preferences/api/get-preferences/useGetPreferences.ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { fetchPreferences } from "./fetcher"; // transport-specific — see below
import type { Preferences } from "../../models/preferences.model";
import { toPreferences, type PreferencesDTOResponse } from "./get-preferences.dto";

export function useGetPreferences(
  options?: Omit<
    UseQueryOptions<PreferencesDTOResponse, Error, Preferences>,
    "queryKey" | "queryFn" | "select"
  >,
) {
  return useQuery<PreferencesDTOResponse, Error, Preferences>({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
    select: toPreferences, // Adapter: DTO → Model
    ...options,
  });
}
```

## Mutation hook (write endpoint)

```typescript
// features/{feature}/api/remove-entity/useRemoveEntity.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeEntity } from "./fetcher";

export function useRemoveEntity() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => removeEntity(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["{feature}"] }),
  });
}
```

Rules:
- **Generic typing (strict rule):** query hooks are typed `<TQueryFnData, TError, TData>` (DTO, Error, Model) and accept external `options` via `Omit<..., "queryKey" | "queryFn" | "select">` — this is what makes the Adapter Pattern composable.
- **Mutations map in `mutationFn`:** when a mutation sends/returns mapped data: `mutationFn: async (model) => toModel(await callEndpoint(toXDTO(model)))`.
- Containers/pages call `mutate` with `onSuccess`/`onError` callbacks. **Never** `mutateAsync` + try/catch.
- Query keys: `['{feature}', ...detail]` — `['preferences']`, `['{feature}']`, `['{feature}', id]`, `['{feature}', 'list', filters]`. Record the project's real key map in `project.md`.
- Cache invalidation in the hook's `onSuccess` when it is intrinsic (a write that stales its own list); in the container's callback when it is contextual (navigation, toast).

## Endpoint classification (decision table)

Not every backend interaction is request/response. Classify **before** writing
a hook; the project's real endpoint-by-endpoint table lives in `project.md`.

| Archetype | Shape | Caller | Cache behavior |
|---|---|---|---|
| Fetch list / detail (`get-entities`) | Query | `useQuery` hook | keyed `['{feature}', ...]` |
| Paged feed / search | **Infinite query** | `useInfiniteQuery` hook | key includes the search/source param |
| Slow-changing status with no push signal | Query with `refetchInterval` | `useQuery` hook | poll ONLY when no event exists |
| Write (`update-entity`, `set-preferences`) | Mutation | `useMutation` hook | invalidates its list/detail keys |
| Fire-and-forget whose completion arrives as a push event | Mutation | `useMutation` hook + event listener | listener invalidates/refetches |
| OS / external side-effect (open folder, open browser) | Mutation | `useMutation` hook or plain fetcher call from a store action | no cache |
| Write performed BY a store during its process (e.g. record-completed) | Mutation-shaped, **called by the store** | plain fetcher call from the store | store invalidates the related query |
| **Long-running scheduler-driven process** (start/cancel jobs) | **Store-driven** | store internals only | NEVER a React Query hook |

Long-running processes (a job queue driving external work with pause / resume /
reorder and event-fed progress) are live state: caching, staleness and
refetching are meaningless for them. Their commands are invoked by the Zustand
store's scheduler, never wrapped in `useMutation`. Full spec in `state.md` →
Live-process stores.

## When the backend is Tauri (desktop)

These adaptations are **stack-specific** (they apply to any Tauri 2 project),
not project-specific.

### Transport: `invoke()` is the fetcher

There is no HTTP backend: no axios, no `http-client.ts`, no JWT, no
interceptors, no 401/refresh flow (that whole area lives in
`web-app-patterns.md` for web projects). The fetcher inside every React Query
hook is a **typed `invoke()` wrapper** from a single shared module
(`@/shared/lib/tauri`). Errors are `Err(String)` from Rust commands — `invoke`
rejects with that string; there is no status code.

- **DTO** = the TS mirror of the Rust struct's serialized shape. Mirror the **actual serde casing**: `#[serde(rename_all = "camelCase")]` structs serialize camelCase, legacy structs may serialize snake_case — the DTO copies reality, the mapper cleans it.
- `queryFn: () => invoke<XDTOResponse>('command_name', args)` — args go as the second `invoke` argument object; arg keys match the Rust command's parameter names (camelCase — Tauri converts).

### Push events replace websockets

Rust emits progress/completion events that must feed Zustand stores or
invalidate queries.

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

### Event wiring: global vs view-scoped

| Scope | Example archetype | Wire it |
|---|---|---|
| **Global** — must outlive any route (a scheduler must advance even when its page is not mounted) | `{job}-progress`, `{credentials}-renewed` | Module-level `onEvent` wired once, in plain modules imported from `main.tsx`, using `use{X}Store.getState()` / the exported `queryClient` singleton. NOT the React hook. |
| **View-scoped** — only meaningful while a view is mounted | `{setup}-progress` in an onboarding dialog, `{analysis}-progress` on an input page | `useTauriEvent(name, cb)` in the container/page/hook; cleanup is automatic on unmount. |

Rules:
- A mounted component must never be a prerequisite for a global process to progress.
- Handlers either (a) call a store action or (b) invalidate/refetch a query. They never hold their own component state as the source of truth for cross-view data.
- Do not poll (`refetchInterval`) for anything an event already reports. Polling is only for statuses with no event (e.g. credential expiry checked every N minutes).
- The project's real event inventory (names, payloads, scope) lives in `project.md`.

## Do / Don't

| Do | Don't |
|---|---|
| One fetcher module per transport (`invoke` wrapper or HTTP client) | Mix transports or invent ad-hoc fetchers per hook |
| Mirror the backend's real casing in the DTO | "Fix" casing in the DTO and skip the mapper |
| `select: toModel` for queries; map inside `mutationFn` for mutations | Return DTOs from hooks or pass them to components |
| Wire global events at store/module level once | Subscribe to a global progress event inside a component |
| The view-scoped event hook for view progress | Leak listeners (missing unlisten) or resubscribe every render |
| Check the classification table before writing a hook | Wrap store-driven process commands in `useMutation` |
