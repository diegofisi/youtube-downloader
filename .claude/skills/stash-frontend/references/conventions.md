# Conventions — naming, rules, i18n, theme, Stash specifics

Absorbs base guideline §6 (Naming), §7 (Rules & Anti-patterns, complete), §10.2 (Const object + type pattern), §11 (AI-driven approach, deduplicated), plus Stash house rules.

## Naming (§6, full table)

| Element | Convention | Example |
|---|---|---|
| Feature folder | `kebab-case` | `youtube-account/` |
| API subfolder | `kebab-case` | `api/get-history/`, `api/set-settings/` |
| DTO file | `kebab-case.ts` | `get-settings.dto.ts` |
| Hook file (RQ) | `camelCase.ts` | `useGetHistory.ts`, `useSetSettings.ts` |
| Hook file (custom) | `camelCase.ts` | `useDescargarPrefill.ts` |
| Component file | `PascalCase.tsx` | `MediaCard.tsx` |
| Container file | `PascalCase.tsx` | `LibraryListContainer.tsx` |
| Model file | `kebab-case.ts` | `library-entry.model.ts` |
| Store file | `camelCase.ts` | `useQueueStore.ts` |
| Helper file | `kebab-case.ts` | `parse-urls.ts` |
| Schema file | `kebab-case.ts` | `settings.schema.ts` |
| Interface/Type | `PascalCase` | `LibraryEntry`, `SettingsDTOResponse` |
| Mapper function | `camelCase` | `toSettings`, `toLibraryEntry` |
| Constant | `UPPER_SNAKE_CASE` | `RECENT_KEY`, `MAX_CONCURRENCY` |
| Tauri command name (in `invoke`) | `snake_case` string | `'get_history'` — matches Rust |
| Tauri event name | `kebab-case` string | `'download-progress'` |

React Query hooks live in `api/[endpoint]/`; custom hooks in `hooks/`. Mappers live inside their `.dto.ts`. Path alias `@/` for `shared/`, `core/`, `features/` imports (§11.4).

## Stash house rules

| Topic | Rule | Grounded in |
|---|---|---|
| Commit messages | **Spanish**, conventional-commit style: `feat(session): logout real + deteccion de sesion caducada` | repo history |
| Code comments | **English**, concise, max ~2 lines; explain the *why* | current codebase style |
| UI text / user-facing errors | Always both languages via `t(es, en)` | `core/i18n.ts` |
| localStorage | Prefix `stash.` for new keys (`stash.lang`, `stash.recentLinks`); legacy `stash-theme`, `stash-onboarded` remain until migrated | `core/i18n.ts`, `recent-links.ts`, `theme.ts`, `onboarding.ts` |
| Rust-facing strings | User-facing backend errors arrive in Spanish (`Err(String)`); show them as the toast body | backend convention |

## Adaptation 5 — i18n & theme (OVERRIDES nothing in the guideline; it simply isn't covered there)

**Differs from the base guideline because** the guideline assumes a single-language app (it has no i18n section) and standard Shadcn theming; Stash already ships a dictionary-less bilingual scheme and a CSS-vars palette that must survive the React rewrite.

### i18n — inline `t(es, en)` (no react-i18next)

- Keep `t(es: string, en: string): string` from `core/i18n.ts`. In React it is a **plain function call in JSX**: `<P>{t("Cola vacía", "Queue is empty")}</P>`. No provider, no keys, no JSON catalogs.
- Every user-visible string carries its `(es, en)` pair inline at the call site.
- **Language change re-renders live instead of reloading** (today `setLang` calls `location.reload()`; the DOM-mutation `applyStaticI18n` dies with vanilla HTML). Put `lang` in a small ui store and key the app root:

```tsx
// main.tsx
const App = () => {
  const lang = useUiStore((s) => s.lang);
  // key remount re-evaluates every t() call — the cheapest correct live switch
  return <RouterProvider router={router} key={lang} />;
};
```

- `t()` keeps reading the module cache; `setLang` updates both the cache and the store (persisting to `stash.lang`) instead of reloading.
- `data-en` / `data-en-ph` / `data-en-title` attributes (static-HTML translation) are dead in React — never port them.

### Theme — Tailwind `dark` class + existing CSS vars

- Keep `core/theme.ts`'s palette: the full Stash var set (`--bg`, `--panel`, `--accent: #7C6BF0`, `--danger`, soft variants, `--shadow`, ...) applied on `<html>`, `data-theme` attribute preserved.
- Add Tailwind `darkMode: "class"`: `applyTheme` also toggles `document.documentElement.classList.toggle("dark", theme === "dark")`.
- Map the vars into Tailwind theme colors once (`colors: { bg: "var(--bg)", panel: "var(--panel)", accent: "var(--accent)", ... }`) so JSX uses `bg-panel text-accent` instead of inline `style` — and Shadcn's semantic tokens (`background`, `foreground`, `primary`, `muted`, `destructive`) alias to the same vars.
- Theme toggle: ui store action → `applyTheme` → components restyle via CSS vars without re-render; the toggle icon subscribes to the store (replaces the `theme:changed` bus event).

## Const object + type pattern (§10.2)

For enums, always **const object + type extraction** — never TS `enum`:

```typescript
export const QueueStatus = {
  Queued: "queued",
  Downloading: "downloading",
  Merging: "merging",
  Paused: "paused",
  Done: "done",
  Error: "error",
  Canceled: "canceled",
} as const;

export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];
```

Tree-shakeable, gives runtime value + type, consistent across statuses/modes/unions. Always compare against the constant (`QueueStatus.Done`), not raw strings. (§10.1 `AuthStatus` — the guideline's concrete instance — is auth-only and lives in `web-app-patterns.md`.)

## Rules & anti-patterns (§7, complete — Stash-annotated)

### DO

- Use Layout Primitives (`Stack`, `Grid`, `Box`) and Typography Primitives (`P`, `Span`, `Small`, `H1`–`H6`) — never raw layout/text tags.
- Set `color` explicitly on nested typography when the parent's color must not inherit.
- Transform every DTO into a Domain Model before the UI consumes it.
- Keep components **dumb** and containers **smart**.
- Use React Query's `select` for query data transformation; type hooks generically for the Adapter Pattern.
- Create feature folders only when needed.
- Zustand for client UI state + live processes; request/response server data in React Query.
- Zod for form validation; `z.infer` for types; compose schemas.
- Co-locate DTO + mapper + hook in `api/[endpoint]/`; separate `.dto.ts` always; mappers inside the DTO file.
- `mutate` + `onSuccess`/`onError` in containers.
- `hooks/` for custom hooks only.
- Path constants (`AppPath.*`) for all navigation.
- `if` + early returns for conditional rendering — no `else`, no `if-else` chains, no `switch/case` (object lookup tables are the alternative).
- `useXStore.getState()` in non-React contexts (queue scheduler, event listeners) — Stash's version of the interceptor rule.
- Derive Zustand initial state from `localStorage` via helpers.
- Navigation callbacks from pages to containers; `<button type="button">` in components for intra-page moves.
- Const-object enums for all status comparisons (Stash: `QueueStatus`, `SessionStatus` — not `AuthStatus`, which is web-only).
- Promote containers to folders at 3+ dialogs/operations (§4.13).
- Responsive Table → Cards with labeled mobile fields (§4.14).
- Local hooks for cross-feature data (§4.15).
- Loading/error inside the content area when headers/filters must persist (§4.16).
- Extract custom hooks at ~200 logic lines or 5+ memos/effects (§4.18).
- Presentational components under ~200 JSX lines; extract visual blocks (§4.19).
- Semantic `components/` subfolders past ~8 files; sub-group past ~10; max 2 levels (§4.20).
- Shared state components for loading/error/empty/not-found (§4.21).

### DON'T

- **NEVER** pass DTOs to components.
- **NEVER** use raw `<div>` for layout or raw `<p>/<span>/<h*>` for text.
- **NEVER** put business logic in presentational components (no business `useMemo`, no `toast`, no API calls there).
- **NEVER** call Tauri commands from components/containers/pages — only `api/` hooks and stores invoke.
- **NEVER** use `any`.
- **NEVER** mix feature concerns or import across features (local hooks instead).
- **NEVER** use `mutateAsync` + `try/catch` in containers.
- **NEVER** create standalone mapper files or inline DTOs in hook files.
- **NEVER** put React Query hooks in `hooks/`.
- **NEVER** hardcode paths — `AppPath.*` only.
- **NEVER** use `switch/case` or `if-else` chains.
- **NEVER** use `window.location.href` for navigation (web-guideline auth flavor N/A, but the rule generalizes: router navigation only). ~~401-interceptor variants~~ → `web-app-patterns.md`.
- **NEVER** use `<Link>` for intra-page view switching — callbacks + buttons.
- **NEVER** hardcode Zustand initial state that depends on runtime values.
- **NEVER** early-return loading/error when it unmounts context the user needs.
- **NEVER** show unlabeled data on mobile cards.
- **NEVER** use `useReducer` as a `useMemo`-chain substitute under RHF.
- **NEVER** use `useActionState`/`useFormStatus`/`useOptimistic` with RHF.
- **NEVER** nest component subfolders past 2 levels.
- **NEVER** write inline loading/error/empty `<P>` patterns.
- Stash extra: **NEVER** ship a user-visible string without both `es` and `en`; **NEVER** wrap `start_download`/`cancel_download` in React Query.

## AI-driven development ground rules (§11, deduplicated)

Unique items not already covered above:

1. When creating a new feature, scaffold the folder structure first, then implement following the data-flow direction: DTO + Mapper → Model → Hook → Schema → Container → Component → Page (§11.6).
2. Generate **all layers** when integrating a new command — never a hook without its DTO/mapper/model (§11.2).
3. Shadcn components via `npx shadcn@latest add`, never written manually (§11.3).
4. Respect path aliases `@/shared/...`, `@/features/...`, `@/core/...` in all imports (§11.4).
5. Follow the naming table strictly (§11.5). Everything else in §11 is the DO/DON'T list above, restated — when in doubt, that list wins.
