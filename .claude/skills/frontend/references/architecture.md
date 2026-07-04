# Architecture — Core philosophy, directory structure, dependency rules

> **Read this when:** creating a feature slice, deciding where a new file goes,
> or importing anything across features. Covers the vertical-slice layout, the
> purpose of every folder, and the import-boundary rules.

## Core philosophy

We prioritize **Separation of Concerns**, **Domain Integrity**, and **Composition**.

- **No Div Soup:** strictly avoid raw `<div>` for layout. Use Layout Primitives (`Stack`, `Grid`, `Box`).
- **Smart vs. Dumb:** logic (Containers) != UI (Components).
- **Domain Integrity:** the UI layer **NEVER** consumes DTOs directly. It only consumes **Domain Models**.
- **Vertical Slicing:** features are self-contained domains — one slice per business domain.
- **Co-location:** each backend endpoint owns its DTO, mapper, and React Query hook in a single subfolder.

## Directory structure

Vertical slices + a shared layer. The tree below uses structural placeholder
names (`{feature}`, `Entity`) — the real feature map for the current project
lives in `project.md`.

```text
src/
 ├── shared/
 │    ├── components/
 │    │    ├── ui/            # Shadcn primitives + typography + PageLoading/PageError/PageEmpty
 │    │    └── layout/        # Stack, Grid, Box
 │    ├── hooks/              # shared custom hooks (e.g. the push-event subscription hook)
 │    ├── lib/                # transport wrapper, i18n helper, query-client.ts, utils.ts (cn)
 │    ├── stores/             # app-wide UI stores (e.g. useUiStore: lang + theme)
 │    ├── styles/             # globals.css (Tailwind + the app's CSS-vars palette)
 │    └── routes/             # SHELL layer: router.tsx, app-path.ts, AppShell (see routing-shell.md)
 │
 ├── features/
 │    ├── {feature}/          # example slice: list + detail + mutations
 │    │    ├── api/
 │    │    │    ├── get-entities/       # get-entities.dto.ts + useGetEntities.ts
 │    │    │    └── update-entity/      # update-entity.dto.ts + useUpdateEntity.ts
 │    │    ├── components/    # EntityCard.tsx, EntityListTable.tsx (dumb)
 │    │    ├── containers/    # EntityListContainer.tsx (smart) — only if the page grows multiple operations
 │    │    ├── models/        # entity.model.ts
 │    │    ├── helpers/       # entity-form.schema.ts, pure utils
 │    │    ├── hooks/         # custom hooks (NOT React Query hooks — those live in api/)
 │    │    ├── index.ts       # only if this slice exposes a sanctioned facade (see below)
 │    │    └── pages/         # EntityListPage.tsx
 │    └── {other-feature}/    # one folder per vertical slice
 │
 └── main.tsx                 # QueryClientProvider + RouterProvider + global wiring
```

### Purpose of each folder inside a feature

| Folder | Purpose | Example |
|---|---|---|
| `api/` | **Subfolders per endpoint.** Each contains a `.dto.ts` (types + mapper) and a React Query hook. | `api/get-entities/get-entities.dto.ts`, `api/get-entities/useGetEntities.ts` |
| `components/` | **Dumb/presentational.** Only receive props, no logic. | `EntityCard.tsx`, `EntityListRow.tsx` |
| `containers/` | **Smart.** Connect hooks/stores to presentational components. Single responsibility: flat file. Multiple operations: folder with orchestrator + leaves (see `containers-pages.md`). | `EntityListContainer.tsx` |
| `interfaces/` | TS interfaces for props, events, feature contracts. | `EntityCardProps.ts` |
| `models/` | **Domain Models** optimized for the frontend (camelCase, clean types). | `entity.model.ts` |
| `pages/` | **Composition Root.** Orchestrates containers, manages inter-container state (dialogs, selections). Only layer that imports containers. | `EntityListPage.tsx` |
| `stores/` | Zustand stores. UI/live-process state using **Domain Models**. | `useJobQueueStore.ts` |
| `hooks/` | **Custom hooks only** (NOT React Query hooks — those live in `api/`). | `useEntityFilters.ts` |
| `helpers/` | **Zod schemas** and pure utility functions for the feature. | `entity-form.schema.ts` |
| `layout/` | Layout wrappers specific to the feature. | rarely needed |

> Not every feature needs all folders. Only create the folders the feature actually uses.

## Cross-feature data access — no cross-imports

Features must **never** import from other features, with ONE sanctioned
exception (enforce it with `eslint-plugin-boundaries`): **app-level shared
contracts** exposed via a feature's `index.ts` **facade** — e.g. a job-queue
store other features enqueue into, a session/auth status hook, or a prefill
contract. **List the sanctioned facades in `project.md`.** Deep paths
(`@/features/{feature}/stores/...`) always fail lint, even into a facade
feature. For anything else, create a **local hook** inside the consuming
feature that calls the endpoint directly.

**Why not share the hook?** Cross-feature imports create coupling: if the
source feature changes its DTO or model, it must not break consumers. Each
feature owns its own adapter for the data it consumes.

Rules:
- The local hook maps only the **fields it needs** (not the source feature's full model).
- Use a **distinct `queryKey`** to avoid cache collisions with the source feature's hooks.
- The DTO/mapper can be minimal — only what the consuming feature actually uses.

```typescript
// features/{feature-b}/api/get-entity-options/useEntityOptions.ts
// Calls the same backend endpoint {feature-a} uses, but lives in {feature-b}.
export function useEntityOptions() {
  return useQuery({
    queryKey: ["{feature-b}", "entityOptions"], // distinct key, no collision
    queryFn: fetchEntities,                     // this feature's own fetcher
    select: toEntityOptions,                    // maps only the fields this feature renders
  });
}
```

When several features consume the same endpoint, there is no "shared preview
slice": each consumer owns its **own local hook** in its own `api/` folder, with
its own trimmed DTO. That duplication is the point — no feature imports another
feature's DTOs, models, or hooks outside the sanctioned facades. Ever.

## Dependency rules

Enforced by `eslint.config.js` (`eslint-plugin-boundaries`) with four element
types — `main` (`src/main.tsx`), `shell` (`src/shared/routes` — the app
composition layer), `shared`, `features`:

| From | May import | Never imports |
|---|---|---|
| `shared/` (except routes) | `shared/` only | anything in `features/` |
| `shell` (`shared/routes`) | `shared/`, `shell`, feature `index.ts` facades and `pages/*.tsx` | feature internals |
| `features/{feature}` | `shared/`, own slice, `shared/routes/app-path.ts`, and the sanctioned facades (per `project.md`) via `index.ts` only | any other cross-feature path (deep paths always) |
| `main.tsx` | everything | — |

Within a feature, the layering still applies: components stay props-only
(models + the shared i18n helper); containers connect hooks/stores to
components; pages are the only layer that renders containers — containers never
render containers.

Cross-feature communication: the sanctioned facades, React Query cache
(invalidation), or route navigation with path constants — nothing else. Never a
global event bus for app logic (see `state.md` → Migrating off an event bus).

### When the backend is Tauri (desktop)

Add a **transport-encapsulation lint rule** (`no-restricted-imports`): the typed
`invoke`/`onEvent` wrappers (from `@/shared/lib/tauri`) and `@tauri-apps/*` may
only be used by the shared tauri/window lib files, the shared event hook, and
each feature's `api/` and `stores/` layers — never components/containers/pages.
The same principle applies to any transport (an HTTP client should not be
imported by components either).

## Layer summary (page / container / component)

| Layer | Knows about | Typical example |
|---|---|---|
| Page | routes, dialog state, containers | `EntityListPage` owning the delete-confirm dialog state |
| Container | hooks + stores → props | `EntityListContainer` (list query + row actions → `EntityListTable`) |
| Component | props only (Domain Models) | `EntityCard`, `EntityListRow`, `EntityForm` |

Not every feature needs all folders — create only what the feature uses.
