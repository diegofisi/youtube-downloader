# Containers, pages & logic extraction

> **Read this when:** writing containers, pages, orchestrators, or deciding
> whether to extract a custom hook. Covers query/mutation containers, the
> composition-root page, orchestrator patterns, and page complexity patterns.

All examples use structural placeholder names (`Entity`, `{feature}`).

## The Container/Component boundary (universal rule)

Two rules remove all ambiguity about where code goes. The old "components are
props-only with zero hooks" rule is **retired** — it was over-rigid (the author
of the Container/Presentational pattern retracted the prescriptive version). The
real split is **data/business vs presentation**, not *all* state vs *no* state.

**Rule A — where state/logic lives.** One-sentence test: *if the state vanished on
remount and nothing outside the component would notice, it belongs in the
component; if anything external (server, store, a sibling, the URL, a toast)
depends on it, it belongs in the container/hook.* The question is binary — "does
anything external depend on this state?"

| In the **component** (local, ephemeral, presentational) | In the **container/hook** (data, business, external effects) |
|---|---|
| `useState` for open/hover/focus/expanded/active-visual-tab/own-input draft | Server data (React Query) |
| `useRef`, `useId` | Mutations / writes |
| Outside-click / Escape listener for **its own** popover | Shared/global state (Zustand) |
| CSS animation of its own UI | Business-derived data |
| | `toast`, navigation, `invoke`, any external effect |
| | Orchestrating multiple components |

So a dropdown owning its own `open` + outside-click listener is a correct
presentational component — do not hoist that into a container.

**Rule B — what a container's JSX may contain.** Only: (1) other components,
(2) conditional rendering (`&&`, early returns), (3) fragments, and passing
props/callbacks. **Forbidden inside a container's JSX:** layout primitives
(`Stack`/`Grid`/`Box`), icons, custom text layouts, styling
`className`/`style`/magic values, `<button>`/inputs/raw HTML. If substantial
markup appears, that JSX is a component — extract a `<FooView/>`.

*Carve-out — leaf confirm/dialog containers.* A tiny leaf container whose whole
job is "confirm + one mutation" may render the Shadcn `Dialog` shell + its
title/description/buttons directly (with the `t.*` strings): the dialog *is* the
component, and a separate view file for a 15-line confirm is over-engineering.
Extract a view only when the dialog body grows past a simple confirm or a short
form. So a leaf confirm-dialog container is fine as-is, but a list/section
container that fuses filter + pagination logic is not.

```tsx
// ✅ container JSX = components + conditionals + props only
return (
  <>
    {children}
    {gate.phase === Phase.Open && <OnboardingScreen {...gate} />}
  </>
);

// ❌ container containing raw markup → extract a <FooView/>
return (
  <Stack className="border-b bg-warn-soft px-4 py-2">
    <TriangleAlertIcon /> <Text variant="caption">{t('…','…')}</Text> <button>…</button>
  </Stack>
);
```

**Rule C — the container is THIN; logic ALWAYS lives in a hook.** A container is
NOT a "super component" — it is the *thinnest* smart unit: it calls a hook and
wires its result to (dumb) components. The **hook is the brain**; the container is
a wiring shell. If a container contains a `useMemo`, a `useEffect`, derived
business data, or multi-step handlers, **that logic belongs in a hook** (`hooks/`
or an `api/` hook). The failure mode is the fat 2015 container that fuses logic +
JSX — avoid it.

```tsx
// ✅ ideal container: get from a hook, render — nothing else
export const EntityListContainer = ({ onEdit }: Props) => {
  const { entities, isLoading } = useEntityList();      // ← brain is the hook
  if (isLoading) return <PageLoading message="…" />;
  return <EntityListTable entities={entities} onEdit={onEdit} />;
};
// ❌ logic fused in the container → move filter/effect/derivation into useEntityList
```

Litmus: a container should read like `const x = useX(); return <View {...x} />`.

### Container vs Component vs Page — the categories (no overlap)

This is a **4-layer** split, and the folders make the categories physical (more
signal than mixing them — the Feature-Sliced Design idea):

| Layer | Folder | What it is | Owns |
|---|---|---|---|
| **Page** | `pages/` | A route's composition root | cross-unit state (which dialog is open, shared selection); composes containers. One per route. |
| **Container** | `containers/` | A thin, hook-backed **connected** unit | its concern's wiring (calls a hook, renders components). Reusable; not a route. |
| **Component** | `components/` | **Presentational** (dumb) | props + local ephemeral UI state only. Reusable, pure. |
| **Hook** | `hooks/` (or `api/`) | The **logic** | data, mutations, derived state, handlers. Testable without a tree. |

- **`components/` = only dumb.** If a component fetches/mutates/derives-business
  data, it is a container — move it to `containers/`. If a "container" holds no
  hook and just renders markup, it is a component — move it to `components/`.
- **Page ≠ Container.** A page is a route + cross-unit state. A container is one
  connected unit a page drops in. A page never *is* a container.

### When does a container exist? (this ends the "why no containers here?" confusion)

A `containers/` folder appears **only when a page places 2+ independent connected
units** (a list + dialogs, tabs). Rules:

- **1 operation → NO container.** The page uses a hook directly (Pattern A/C
  below). A `container` that a page wraps 1:1 is a thin-wrapper anti-pattern.
- **2+ operations → containers.** Each connected unit is a thin container; the page
  owns the state between them.

So a feature having **no `containers/` folder is correct, not an omission** — it
means every page there is single-operation.

## Container — Query

```typescript
// features/{feature}/containers/EntityListContainer.tsx
import { useGetEntities } from "../api/get-entities/useGetEntities";
import { EntityListTable } from "../components/EntityListTable";
import { PageLoading } from "@/shared/components/ui/PageLoading";

export const EntityListContainer = () => {
  // 'entities' is typed as Entity[] (Domain Model), NOT DTO
  const { data: entities, isLoading } = useGetEntities();

  if (isLoading) return <PageLoading message="Loading..." />;
  if (!entities) return null;

  return <EntityListTable entities={entities} />;
};
```

## Container — Mutation

**Strict rules:**
- Mutations use `mutate` with `onSuccess`/`onError` callbacks. **NEVER** `mutateAsync` with `try/catch`. Why: `mutate` + callbacks avoids unhandled promise rejections and co-locates success/error logic with the call site.
- Containers receive **navigation callbacks** from their parent page (e.g. `onDone`, `onOpenDetail`) instead of `<Link>` for intra-page navigation. Why: when multiple views live on the same page, navigation between them is **state-based** (managed by the parent page), not route-based. Components render `<button type="button">`, never `<Link>`, for these.
- Always use **path constants** (`AppPath.*`) for programmatic navigation. **NEVER** hardcode path strings. See `routing-shell.md` → Path constants.

```typescript
// features/preferences/containers/PreferencesFormContainer.tsx
export const PreferencesFormContainer = () => {
  const { data: preferences } = useGetPreferences();
  const { mutate, isPending } = useSetPreferences();

  const form = useForm<PreferencesForm>({
    resolver: zodResolver(preferencesSchema),
    values: preferences,           // RQ query feeds RHF
  });

  const onSubmit = form.handleSubmit((data) => {
    mutate(data, {
      onSuccess: () => toast.success("Preferences saved"),
      onError: (e) => toast.error(String(e)),
    });
  });

  return <PreferencesForm form={form} onSubmit={onSubmit} isLoading={isPending} />;
};
```

## Page — Composition Root

The page is the **only** layer that imports and renders multiple containers. It
manages inter-container state (dialog open/close, selected entities) and passes
callbacks down. **Containers NEVER import other containers.**

```typescript
// features/{feature}/pages/EntityListPage.tsx
export const EntityListPage = () => {
  // Inter-container state: which dialog is open, which entity is selected
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <EntityListContainer
        onDelete={setDeleteTarget}
        onImport={() => setImportOpen(true)}
      />
      {/* Dialog containers: independent, orchestrated by the page */}
      <DeleteEntityContainer
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        entity={deleteTarget}
      />
      <ImportEntitiesContainer open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};
```

> Each container is self-contained (fetches its own data, owns its mutations).
> The page only decides *which* container is visible and *which* entity is
> selected — this prevents "god components".

## Page Orchestrator Pattern

When one page manages **multiple views** (state-switched, not route-switched —
e.g. an input → preview → confirm sequence):

- Use `if` statements with early returns for conditional rendering. **No** `switch/case`, **no** `else`, **no** `if-else` chains — sequential `if` returns; the default view is the last unconditioned return.
- Define a union type for the views (`type ImportView = "input" | "preview" | ...`).
- Pass navigation callbacks (`onBack`, `onAnalyzed`) down to containers; containers never `<Link>` between intra-page views.

```typescript
export const ImportPage = () => {
  const [view, setView] = useState<ImportView>("input");

  if (view === "preview") {
    return <ImportPreviewContainer onBack={() => setView("input")} />;
  }

  return <ImportInputContainer onAnalyzed={() => setView("preview")} />;
};
```

## Orchestrator Container Pattern

When a detail view needs **3+ independent operations** (each with its own form
+ mutation), the container becomes a **folder**:

```text
containers/
  SimpleContainer.tsx               # single responsibility → flat file
  EntityDetailContainer/            # multiple operations → folder
    index.ts                        # re-exports ONLY the orchestrator
    EntityDetailContainer.tsx       # orchestrator: fetches data, manages dialog states, renders leaves
    EditSectionContainer.tsx        # leaf: form + update mutation
    DeleteEntityContainer.tsx       # leaf: confirm dialog + delete mutation
    ...
```

| Role | Responsibilities |
|---|---|
| Orchestrator | Fetches the main entity, manages dialog open/close states, renders the presentational layout + leaf containers. **Never owns forms or mutations directly.** |
| Leaf | Owns its form (`useForm` + zodResolver) and its mutation. Receives `open`, `onOpenChange`, entity data via props. Handles `onSuccess`/`onError` independently. **Never imports other leaves.** |

If a container has only 1–2 operations, keep it a flat file — no folder.

## Page complexity patterns

**Never create a page that is a thin wrapper around a single container** —
either absorb it or orchestrate several.

| Complexity | Pattern | Separate container? | Example |
|---|---|---|---|
| Single simple operation | **A — Page absorbs** | No | `PreferencesPage` (one form) |
| Single operation, heavy logic | **C — Page + custom hook** | No (hook yes) | `ImportPage` + `useImportAnalysis` |
| Multiple operations | **B — Page orchestrates** | Yes (leaf containers) | `EntityListPage` with dialogs |

**Pattern A — page absorbs:** page uses hooks directly and renders presentational components.

```typescript
export const PreferencesPage = () => {
  const { form, onSubmit, isPending } = /* hooks used directly */;
  return (
    <Stack gap="lg">
      <Text variant="h4">Preferences</Text>
      <PreferencesForm form={form} onSubmit={onSubmit} isLoading={isPending} />
    </Stack>
  );
};
```

**Pattern B — page orchestrates:** the JSX reads as composable blocks — if you blur the prop values, the structure still makes sense (`<Header/>, <Tabs/>, <EditDialog/>, <DeleteDialog/>`). Dialog states live in the page.

**Pattern C — page + custom hook:** heavy logic (many memos/handlers) moves to a hook in `hooks/`; the page stays pure composition.

Anti-pattern: `export const XPage = () => <XContainer />;` — if you write this, absorb the container or delete it.

## Custom-hook extraction

| Signal | Action |
|---|---|
| 5+ `useMemo`/`useEffect` in one file | Extract to hook |
| File exceeds ~200 lines of logic (excluding JSX) | Extract to hook |
| Logic reused across pages/containers | Extract to shared hook |
| Single `useState` + one handler | Keep inline — don't over-extract |

Pattern: the hook (`hooks/useX.ts`) owns form + mutations + memos + handlers and
returns `{ form, onSubmit, isPending, ... }`; the page/container consumes and
composes.

**When NOT to use:**
- **`useReducer` is not a substitute for `useMemo` chains.** With `react-hook-form` managing state, derived data are computed values, not state transitions. `useMemo` for derived data; `useReducer` only for genuine state machines.
- Don't extract a hook for 1–2 lines of logic.

### React 19 note

With React 19 under `@vitejs/plugin-react` (standard Babel transform) and the
**React Compiler NOT enabled**:
- `useMemo`/`useCallback` remain the standard memoization tools — use for expensive computations or referential stability (hook deps, `React.memo` props).
- If the React Compiler is enabled later, revisit — it auto-memoizes most expressions.
- **Never** use React 19 form hooks (`useActionState`, `useFormStatus`, `useOptimistic`) with `react-hook-form` — they are for native HTML form actions only. Do not mix.
