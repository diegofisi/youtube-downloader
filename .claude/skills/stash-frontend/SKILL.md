---
name: stash-frontend
description: >
  Builds React 19 UI for Stash (Tauri 2 desktop) following the project's frontend
  architecture: React + TS + Tailwind + Shadcn UI + Zustand + React Query, vertical
  slices, Container/Presentational, Adapter Pattern over Tauri invoke(). Use when
  asked to create or modify a view, page, component, hook, store, form, route, or
  any React UI work.
---

# Stash Frontend (React 19)

This skill **fully absorbs** the former `FRONTED_ARCHITECTURE_GUIDELINE.md` (v3.0) and applies it to Stash, a **single-user Tauri 2 desktop app**. Every section of that guideline lives in a reference file here (navigation table below); sections not applicable to a desktop app are preserved in `references/web-app-patterns.md` for web projects. Where desktop reality conflicts with the webapp-oriented doctrine, the 5 adaptations below win. Backend command contract: see `../stash-backend`.

## Navigation table — old guideline section → new home

| Guideline § | Topic | New home |
|---|---|---|
| §1 | Core philosophy | `references/architecture.md` § Core philosophy |
| §2 | Directory structure + folder table | `references/architecture.md` § Directory structure |
| §3 | Strict data flow (Adapter Pattern, 6 layers) | `references/data-flow.md` § The Adapter Pattern flow |
| §4.1 | Models vs DTOs (+ mappers) | `references/data-flow.md` § Adaptation 1 / DTO examples |
| §4.2 | API subfolder pattern | `references/data-flow.md` § API subfolder pattern |
| §4.3 | React Query hook — query | `references/data-flow.md` § Query hook |
| §4.4 | React Query hook — mutation | `references/data-flow.md` § Mutation hook |
| §4.5 | Container — query | `references/containers-pages.md` § Container — Query |
| §4.6 | Container — mutation (mutate, callbacks, path constants) | `references/containers-pages.md` § Container — Mutation |
| §4.7 | Presentational component | `references/components.md` § Presentational component |
| §4.8 | Zustand store + derived initial state | `references/state.md` § General Zustand rules (auth flavor → `web-app-patterns.md`) |
| §4.9 | Zod validation schemas | `references/forms.md` |
| §4.10 | Page (composition root) | `references/containers-pages.md` § Page — Composition Root |
| §4.11 | Page orchestrator pattern | `references/containers-pages.md` § Page Orchestrator Pattern |
| §4.12 | HTTP client & interceptors | `references/web-app-patterns.md` (replaced in Stash by `data-flow.md` Adaptation 1) |
| §4.13 | Orchestrator container pattern | `references/containers-pages.md` § Orchestrator Container |
| §4.14 | Responsive table → cards | `references/components.md` § Responsive Table → Cards |
| §4.15 | Cross-feature data access | `references/architecture.md` § Cross-feature data access |
| §4.16 | Loading/error without unmounting | `references/components.md` § Loading & error without unmounting |
| §4.17 | Page complexity patterns A/B/C | `references/containers-pages.md` § Page complexity patterns |
| §4.18 | Custom-hook extraction + React 19 note | `references/containers-pages.md` § Custom-hook extraction |
| §4.19 | Component size limits & extraction | `references/components.md` § Size limits & extraction |
| §4.20 | components/ folder organization | `references/components.md` § components/ folder organization |
| §4.21 | Shared state components | `references/components.md` § Shared state components |
| §5 | Layout & typography primitives spec | `references/components.md` § Layout / Typography primitives |
| §6 | Naming conventions | `references/conventions.md` § Naming |
| §7 | Rules & anti-patterns (full DO/DON'T) | `references/conventions.md` § Rules & anti-patterns |
| §8 | Role-based routing | `references/web-app-patterns.md` (Stash routing → `references/routing-shell.md`) |
| §9 | Roles & permissions | `references/web-app-patterns.md` |
| §10.1 | AuthStatus | `references/web-app-patterns.md` |
| §10.2 | Const object + type pattern | `references/conventions.md` § Const object + type |
| §11 | AI-driven development approach | `references/conventions.md` § AI-driven ground rules (deduplicated into DO/DON'T) |

## The 5 desktop adaptations (override the base guideline)

| # | Topic | Adaptation | Detail in |
|---|---|---|---|
| 1 | Transport | No axios/JWT interceptors (guideline §4.12 N/A). Fetcher inside React Query hooks = typed `invoke()` from `@/shared/lib/tauri`. DTO = TS mirror of the Rust struct. | `references/data-flow.md` |
| 2 | Events | Tauri events (`download-progress`, `setup-progress`, `cookies-extracted`, `preview-progress`) replace websockets. New `useTauriEvent(name, cb)` pattern. | `references/data-flow.md` |
| 3 | Live processes | Download queue scheduler is store-driven (Zustand), NOT query-shaped. React Query only for request/response commands. Decision table for all 21 commands. | `references/state.md`, `references/data-flow.md` |
| 4 | Routing/auth | No roles, no guards, no route groups (guideline §8–9 N/A). Flat sidebar shell + one route per section. Path constants rule kept. | `references/routing-shell.md` |
| 5 | i18n/theme | Inline `t(es, en)` stays (no react-i18next). Theme = Tailwind `dark` class + existing CSS vars. | `references/conventions.md` |

## References

| File | Read before |
|---|---|
| `references/architecture.md` | Creating a feature slice, placing any file, importing across features. |
| `references/data-flow.md` | Writing any hook that touches a Tauri command or event. |
| `references/containers-pages.md` | Writing containers, pages, orchestrators, or extracting custom hooks. |
| `references/components.md` | Writing any JSX (primitives, size limits, extraction, states). |
| `references/state.md` | Touching Zustand stores, the queue, or anti-race logic. |
| `references/forms.md` | Any form (settings, download options, template, search). |
| `references/routing-shell.md` | Routes, sidebar, titlebar, window controls. |
| `references/conventions.md` | Naming, commits, comments, i18n, theme, localStorage, full DO/DON'T. |
| `references/web-app-patterns.md` | Only when reusing this doctrine in a web project (auth, roles, axios). Never for Stash code. |

## Workflow A — New feature slice

1. Scaffold `src/features/{name}/` with only the folders needed (`api/`, `models/`, `components/`, `pages/`, plus `containers/`, `stores/`, `hooks/`, `helpers/` on demand) — tree in `references/architecture.md`.
2. Implement in data-flow order: DTO + mapper → Model → hook → (schema) → container → component → page.
3. Register the page route in `shared/routes/` (path constant first) — `references/routing-shell.md`.
4. Never import from another feature; duplicate a minimal local hook instead (guideline §4.15). Sole exception: the sanctioned `@/features/(queue|session|download)` facades via their `index.ts` (enforced by eslint.config.js).

## Workflow B — New endpoint hook (invoke adapter)

1. Confirm the command exists in `src-tauri/src/main.rs` `generate_handler![]` (contract: `../stash-backend`).
2. Classify it with the decision table in `references/data-flow.md`: query / mutation / infinite query / store-driven. Store-driven commands NEVER get a React Query hook.
3. Create `features/{feature}/api/{endpoint}/`:
   - `{endpoint}.dto.ts` — TS mirror of the Rust struct (respect its real serde casing) + `to{Model}` mapper.
   - `use{Action}.ts` — `queryFn: () => invoke<XDTOResponse>('command_name', args)`, `select: toModel` (queries) or mapper inside `mutationFn` (mutations).
4. If completion/progress arrives via a Tauri event, wire `useTauriEvent` per `references/data-flow.md` — never poll.

## Workflow C — New page (guideline §4.17 patterns)

| Situation | Pattern |
|---|---|
| One operation (one form / one list) | **A — page absorbs**: page uses hooks directly, no container. |
| One operation, heavy logic | **C — page + custom hook** in `hooks/`. |
| Several operations (dialogs, tabs) | **B — page orchestrates** leaf containers; page owns dialog state. |

Never a thin wrapper page around a single container. Register route + path constant + sidebar entry (`references/routing-shell.md`).

## Workflow D — New component

1. Presentational only: props in (Domain Models, never DTOs), JSX out. No API calls, no toasts, no business `useMemo`.
2. Layout with `Stack`/`Grid`/`Box`; text with `H1–H6`/`P`/`Small`/`Span`. No raw `div/p/span/h*` (guideline §5).
3. Size limits (§4.19): >~200 JSX lines → extract sub-components; >10 props → regroup; internal helper >~20 JSX lines → own file.
4. `components/` >~8 files → semantic subfolders by consumer view; max 2 nesting levels (§4.20).
5. Loading/error/empty → shared `PageLoading`/`PageError`/`PageEmpty` components (§4.21), never inline `<P>` states.

## Workflow E — New store

1. Only client/UI state or live-process state. Server snapshots belong to React Query — check the decision table first.
2. `features/{feature}/stores/use{Domain}Store.ts`: typed State + Actions, `reset()`, derived initial state via helper (never hardcode values that come from `localStorage`) — guideline §4.8.
3. Non-React callers (queue scheduler, event listeners) use `useXStore.getState()` / `.setState()`; React Query cache access from stores goes through the exported `queryClient` singleton.
4. Queue-specific rules (scheduler, runSeq, single-flight): `references/state.md`.

## Validation checklist (before finishing any task)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src (boundaries plugin enforces layer imports)
npm run test        # vitest run
npm run check       # typecheck + lint + cargo check
```

If a script fails for tooling reasons, check `package.json` for its current form instead of assuming.

Also verify: no cross-feature imports, no DTO reaching a component, no raw HTML layout tags, no hardcoded route strings, all new user-facing text has both `es` and `en`.
