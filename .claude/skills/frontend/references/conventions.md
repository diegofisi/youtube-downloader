# Conventions — naming, i18n, theme, rules & anti-patterns

> **Read this when:** naming any file/type/function, touching i18n or theme,
> or doing a final review of a change. Ends with the complete DO/DON'T list —
> when in doubt, that list wins.

## Naming (full table)

| Element | Convention | Example |
|---|---|---|
| Feature folder | `kebab-case` | `{feature-name}/` |
| API subfolder | `kebab-case` | `api/get-entities/`, `api/set-preferences/` |
| DTO file | `kebab-case.ts` | `get-entities.dto.ts` |
| Hook file (RQ) | `camelCase.ts` | `useGetEntities.ts`, `useSetPreferences.ts` |
| Hook file (custom) | `camelCase.ts` | `useEntityFilters.ts` |
| Component file | `PascalCase.tsx` | `EntityCard.tsx` |
| Container file | `PascalCase.tsx` | `EntityListContainer.tsx` |
| Model file | `kebab-case.ts` | `entity.model.ts` |
| Store file | `camelCase.ts` | `useJobQueueStore.ts` |
| Helper file | `kebab-case.ts` | `parse-input.ts` |
| Schema file | `kebab-case.ts` | `entity-form.schema.ts` |
| Interface/Type | `PascalCase` | `Entity`, `EntityDTOResponse` |
| Mapper function | `camelCase` | `toEntity`, `toPreferences` |
| Constant | `UPPER_SNAKE_CASE` | `RECENT_KEY`, `MAX_CONCURRENCY` |
| Backend endpoint name (in the fetcher) | whatever the backend really uses | a Tauri command is `snake_case` (`'get_entities'`); an HTTP path is its real route |
| Push event name | `kebab-case` string | `'job-progress'` |

React Query hooks live in `api/[endpoint]/`; custom hooks in `hooks/`. Mappers
live inside their `.dto.ts`. Use the `@/` path alias for `shared/` and
`features/` imports.

## House rules (universal defaults — project.md may refine)

| Topic | Rule |
|---|---|
| Commit messages | **English**, conventional style `type(scope): description` |
| Code comments | **English**, concise, max ~2 lines; explain the *why* |
| UI text / user-facing errors | Always through the project's i18n layer — never raw literals when the app is multilingual |
| localStorage | Prefix every key with the app's namespace (`{app}.`) — the concrete prefix and legacy keys live in `project.md` |
| Backend error strings | If the backend returns user-facing error strings (no error codes), treat them as product copy: show them as the toast body |

## i18n — dictionary-less inline pattern (when the project uses one)

Some projects use a tiny inline helper instead of react-i18next: a function
`t(primary, secondary)` that returns the string for the current language. If
the project uses this scheme (check `project.md`):

- It is a **plain function call in JSX**: `<P>{t("...", "...")}</P>`. No provider, no keys, no JSON catalogs.
- Every user-visible string carries both language variants inline at the call site.
- **Language change re-renders live instead of reloading**: `lang` lives in the ui store and keys the app root:

```tsx
// main.tsx
const App = () => {
  const lang = useUiStore((s) => s.lang);
  // key remount re-evaluates every t() call — the cheapest correct live switch
  return <RouterProvider router={router} key={lang} />;
};
```

- `t()` reads a module cache; `setLang` updates both the cache and the store (persisting to the `{app}.lang` key) instead of reloading.
- DOM-attribute translation schemes (`data-*` attributes patched by a script) are dead in React — never port them.

## Theme — Tailwind `dark` class + CSS vars

- Keep the app palette as CSS variables in `shared/styles/globals.css` (`--bg`, `--panel`, `--accent`, `--danger`, soft variants, `--shadow`, ...) applied on `<html>`; a `data-theme` attribute may carry the active theme.
- Tailwind `darkMode: "class"`: the theme-apply helper also toggles `document.documentElement.classList.toggle("dark", theme === "dark")`.
- Map the vars into Tailwind theme colors once (`colors: { bg: "var(--bg)", panel: "var(--panel)", accent: "var(--accent)", ... }`) so JSX uses `bg-panel text-accent` instead of inline `style` — and Shadcn's semantic tokens (`background`, `foreground`, `primary`, `muted`, `destructive`) alias to the same vars.
- Theme toggle: ui store action → apply helper → components restyle via CSS vars without re-render; the toggle icon subscribes to the store.

## Const object + type pattern

For enums, always **const object + type extraction** — never TS `enum`:

```typescript
export const JobStatus = {
  Queued: "queued",
  Running: "running",
  Finalizing: "finalizing",
  Paused: "paused",
  Done: "done",
  Error: "error",
  Canceled: "canceled",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
```

Tree-shakeable, gives runtime value + type, consistent across
statuses/modes/unions. Always compare against the constant (`JobStatus.Done`),
not raw strings. (The canonical auth instance, `AuthStatus`, lives in
`web-app-patterns.md`.)

## Rules & anti-patterns (complete)

### DO

- Use Layout Primitives (`Stack`, `Grid`, `Box`) and Typography Primitives (`P`, `Span`, `Small`, `H1`–`H6`) — never raw layout/text tags.
- Set `color` explicitly on nested typography when the parent's color must not inherit.
- Transform every DTO into a Domain Model before the UI consumes it.
- Keep components **dumb** and containers **smart**.
- Use React Query's `select` for query data transformation; type hooks generically for the Adapter Pattern.
- Use canonical Tailwind spacing classes over arbitrary px values (`px-4.5`, not `px-[18px]`; 1 unit = 4px). Arbitrary only where no canonical form exists (`text-[13px]`, `rounded-[9px]`, non-quarter steps).
- Create feature folders only when needed.
- Zustand for client UI state + live processes; request/response server data in React Query.
- Zod for form validation; `z.infer` for types; compose schemas.
- Co-locate DTO + mapper + hook in `api/[endpoint]/`; separate `.dto.ts` always; mappers inside the DTO file.
- `mutate` + `onSuccess`/`onError` in containers.
- `hooks/` for custom hooks only.
- Path constants (`AppPath.*`) for all navigation.
- `if` + early returns for conditional rendering — no `else`, no `if-else` chains, no `switch/case` (object lookup tables are the alternative).
- `use{X}Store.getState()` in non-React contexts (schedulers, event listeners, interceptors).
- Derive Zustand initial state from `localStorage` via helpers.
- Navigation callbacks from pages to containers; `<button type="button">` in components for intra-page moves.
- Const-object enums for all status comparisons.
- Promote containers to folders at 3+ dialogs/operations (see `containers-pages.md` → Orchestrator Container).
- Responsive Table → Cards with labeled mobile fields (see `components.md` → Responsive Table → Cards).
- Local hooks for cross-feature data (see `architecture.md` → Cross-feature data access).
- Loading/error inside the content area when headers/filters must persist (see `components.md` → Loading & error without unmounting).
- Extract custom hooks at ~200 logic lines or 5+ memos/effects (see `containers-pages.md` → Custom-hook extraction).
- Presentational components under ~200 JSX lines; extract visual blocks (see `components.md` → Size limits).
- Semantic `components/` subfolders past ~8 files; sub-group past ~10; max 2 levels (see `components.md` → Folder organization).
- Shared state components for loading/error/empty/not-found (see `components.md` → Shared state components).

### DON'T

- **NEVER** pass DTOs to components.
- **NEVER** use raw `<div>` for layout or raw `<p>/<span>/<h*>` for text.
- **NEVER** put business logic in presentational components (no business `useMemo`, no `toast`, no API calls there).
- **NEVER** call the transport (HTTP client or `invoke`) from components/containers/pages — only `api/` hooks and stores.
- **NEVER** use `any`.
- **NEVER** mix feature concerns or import across features (local hooks instead; sole exception: the sanctioned facades listed in `project.md`, via `index.ts` only).
- **NEVER** use `mutateAsync` + `try/catch` in containers.
- **NEVER** create standalone mapper files or inline DTOs in hook files.
- **NEVER** put React Query hooks in `hooks/`.
- **NEVER** hardcode paths — `AppPath.*` only.
- **NEVER** use `switch/case` or `if-else` chains.
- **NEVER** use `window.location.href` for navigation — router navigation only. (The 401-interceptor variant of this rule lives in `web-app-patterns.md`.)
- **NEVER** use `<Link>` for intra-page view switching — callbacks + buttons.
- **NEVER** hardcode Zustand initial state that depends on runtime values.
- **NEVER** early-return loading/error when it unmounts context the user needs.
- **NEVER** show unlabeled data on mobile cards.
- **NEVER** use `useReducer` as a `useMemo`-chain substitute under RHF.
- **NEVER** use `useActionState`/`useFormStatus`/`useOptimistic` with RHF.
- **NEVER** nest component subfolders past 2 levels.
- **NEVER** write inline loading/error/empty `<P>` patterns.
- **NEVER** ship a user-visible string outside the i18n layer in a multilingual app.
- **NEVER** wrap store-driven process endpoints (start/cancel job) in React Query.

## AI-driven development ground rules

1. When creating a new feature, scaffold the folder structure first, then implement following the data-flow direction: DTO + Mapper → Model → Hook → Schema → Container → Component → Page.
2. Generate **all layers** when integrating a new endpoint — never a hook without its DTO/mapper/model.
3. Shadcn components via `npx shadcn@latest add`, never written manually.
4. Respect the path aliases `@/shared/...` and `@/features/...` in all imports.
5. Follow the naming table strictly. Everything else is the DO/DON'T list above, restated — when in doubt, that list wins.
