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

## Comments — sparse, why-not-what

Add a comment only when it says something the code cannot. Default to none.

- **Max 1–2 lines**, English, explain the **why** — never the what.
- **Cut redundancy**: a comment that restates the code, names the rule/identifier
  right above it, or narrates what a line does. Litmus: if deleting it loses no
  information a competent reader gets from the code, delete it.
- **Cut technical essays**: a multi-line walkthrough of how a system works belongs
  in the skill/docs, not inline — reference the concept, don't transcribe it.
- **Keep** the terse non-obvious reason: `// first match wins`, `// resume keeps
  progress (yt-dlp continues the .part file)`, `// StrictMode double-effect guard`.
- Never touch directive comments (`eslint-disable`, `@ts-expect-error`, region
  markers) — they are not prose.

## i18n — centralized keyed catalogs (when the project uses one)

A typed message **object** (`useTranslation`/Paraglide-style): `t.feature.key()` /
`t.feature.key({ params })`, where **every string lives in per-language catalogs**
keyed by a semantic key. No text and no raw key strings at the call site — object
access gives autocomplete, go-to-definition and find-references. If the project
uses this scheme (check `project.md`):

- **Semantic keys, namespaced by feature**: `t.entities.emptyTitle()`,
  `t.entity.title()`, `t.common.save()`. Cross-feature strings go under
  `common.*`; shell chrome under `shell.*`. The `t` object is generated from the
  typed key union, so a wrong path is a compile error.
- **All languages central**: `messages/{es,en,…}.ts`, each `Record<MessageKey,
  string>`. Change any language OR add one = edit/add a catalog file; **call sites
  never change**. This is the whole point.
- **Interpolation + plurals via ICU-lite templates** in the catalog value:
  `'{name}'` interpolation and `'{n, plural, one {# x} other {# xs}}'` (also `=0`
  cases, `#` = the number). The call passes **per-message typed params**, including
  computed ones: `t.entities.noResultsFor({ query, filter: filterLabel(filter) })`. This
  keeps conditional/dynamic strings fully centralized and decoupled from code.
- **Accessor name**: `t` here is the message *object*, not a function — pick a name
  with no local-variable collisions (`m` clashes with `const m` for minutes, etc.).
  The low-level engine is `translate()` in `i18n.ts`; call sites never use it.
- **Plain call in JSX**: `<Text variant="body">{t.feature.key()}</Text>`. No provider.
- **Language change re-renders live instead of reloading**: `lang` lives in the ui store and keys the app root:

```tsx
// main.tsx
const App = () => {
  const lang = useUiStore((s) => s.lang);
  // key remount re-evaluates every t() call — the cheapest correct live switch
  return <RouterProvider router={router} key={lang} />;
};
```

- `translate()` reads a module cache; `setLang` updates both the cache and the store (persisting to the `{app}.lang` key) instead of reloading.
- DOM-attribute translation schemes (`data-*` attributes patched by a script) are dead in React — never port them.
- The keyed-catalog scheme scales to N languages by adding catalog files. A future
  upgrade to **Paraglide JS** (typed message functions, JSON catalogs for external
  translators, per-locale tree-shaking) is now trivial — the keys already exist.

### File layout

- `shared/lib/i18n.ts` — the `translate(key, params)` engine + ICU-lite formatter +
  `getInitialLang`/`persistLang`. **Call sites never import this.**
- `shared/lib/messages/keys.ts` — the `MessageKey` union (every key).
- `shared/lib/messages/{es,en,…}.ts` — one catalog per language,
  `Record<MessageKey, string>` of ICU-lite templates.
- `shared/lib/messages/t.ts` — the typed `t` object (`t.feature.key()`); the ONLY
  i18n thing components import.

### Adding a string

1. Add the key to `keys.ts` (the union) and its text to every `messages/{lang}.ts`.
2. Add the leaf to `t.ts`: `key: () => translate('feature.key')` (static) or
   `key: (p: { n: number }) => translate('feature.key', p)` (dynamic — the leaf's
   param type is what makes the call site type-safe).
3. Use it: `t.feature.key()` / `t.feature.key({ n })`.

### Adding a language

Create `messages/{lang}.ts` (same keys as `es.ts`), then register it in `i18n.ts`'s
`CATALOGS`. **No call site changes.**

### Example (static + dynamic)

```tsx
<Text variant="h1">{t.entity.title()}</Text>
<Text>{t.entities.noResultsFor({ query, filter: filterLabel(filter) })}</Text>
```
```ts
// messages/en.ts                          // messages/es.ts
'entity.title': 'Contact',                 'entity.title': 'Contacto',
'entities.noResultsFor':                   'entities.noResultsFor':
  'No results for "{query}" ({filter}).'     'Sin resultados para "{query}" ({filter}).'
```

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

## Effects — you might not need one

`useEffect` is ONLY for synchronizing with an **external system** (event
subscription, timer, DOM measurement, imperative widget, Tauri event). If no
external system is involved, you don't need an effect. Enforce with the ESLint
lint `react-hooks/set-state-in-effect`.

| Anti-pattern (don't) | Correct approach |
|---|---|
| Derived state via `setState` in an effect | Compute during render |
| Expensive derived value | `useMemo` |
| Reset *all* state when a prop changes | `key` prop to remount |
| Adjust *some* state on a prop change | Store minimal state, derive the rest during render (or the "prev value in render" pattern) |
| Logic that should run on a user action | Event handler, not an effect |
| Notifying a parent | Call the callback in the same handler that set the state |
| Subscribing to an external store | `useSyncExternalStore` |

**Legit effects still include** timers, DOM/event listeners, and **syncing one
external store into another** (e.g. seeding a Zustand working-copy from a React
Query result) — note React Query v5 has **no `onSuccess` on `useQuery`**, so an
effect (or `select`) is the correct RQ→store sync mechanism, not an anti-pattern.

## Animations — without effects

Never drive animation from `useEffect` (a class toggle after mount forces an
extra commit+repaint and, on lists, layout thrash). Preference order (Tauri ships
a known Chromium engine, so modern CSS is safe):
1. **CSS transitions/animations** for state toggles (open/close, hover).
2. **`@starting-style` + `transition-behavior: allow-discrete`** for mount/enter
   and animating out of `display:none` (the exact replacement for the
   "useEffect to animate on mount" pattern; Tailwind v4 `starting:` variant).
3. **`view-transition` / React `<ViewTransition>`** for reorders and shared-element morphs (FLIP without manual measuring).
4. **Motion (Framer)** only for spring physics / gestures / `layout` animation.
5. **`useLayoutEffect`** ONLY for pre-paint measurement (FLIP, tooltip positioning) — usually a library already does it.

## tailwind-merge + custom size tokens (gotcha)

Custom Tailwind font-size tokens (`text-h1`, `text-body`, …) MUST be registered
with tailwind-merge in `cn` via `extendTailwindMerge({ extend: { classGroups: {
'font-size': [{ text: [...] }] }}})`. Otherwise twMerge treats them as text
**color** and silently drops the size when a color class is merged — text falls
back to the ~14px preflight reset. This applies to any custom token that shares a
utility prefix with a built-in group.

## Rules & anti-patterns (complete)

### DO

- Use Layout Primitives (`Stack`, `Grid`, `Box`) and the `<Text variant="...">` component for all text — never raw layout/text tags.
- Set `color` explicitly on nested typography when the parent's color must not inherit.
- Transform every DTO into a Domain Model before the UI consumes it.
- Keep components **dumb** and containers **smart**.
- Use React Query's `select` for query data transformation; type hooks generically for the Adapter Pattern.
- Use canonical Tailwind spacing classes over arbitrary px values (`px-4.5`, not `px-[18px]`; 1 unit = 4px). Arbitrary Tailwind values ONLY where no canonical/token form exists (`rounded-[9px]` ok, `rounded-[12px]`→`rounded-xl` not ok; non-quarter steps).
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
- **NEVER** write inline loading/error/empty `<Text>` patterns.
- **NEVER** ship a user-visible string outside the i18n layer in a multilingual app.
- **NEVER** wrap store-driven process endpoints (start/cancel job) in React Query.
- **NEVER** inline `text-[..px]` font sizes — add a `<Text>` variant instead.

## AI-driven development ground rules

1. When creating a new feature, scaffold the folder structure first, then implement following the data-flow direction: DTO + Mapper → Model → Hook → Schema → Container → Component → Page.
2. Generate **all layers** when integrating a new endpoint — never a hook without its DTO/mapper/model.
3. Shadcn components via `npx shadcn@latest add`, never written manually.
4. Respect the path aliases `@/shared/...` and `@/features/...` in all imports.
5. Follow the naming table strictly. Everything else is the DO/DON'T list above, restated — when in doubt, that list wins.
