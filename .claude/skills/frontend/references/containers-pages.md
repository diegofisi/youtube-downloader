# Containers, pages & logic extraction

> **Read this when:** writing containers, pages, orchestrators, or deciding
> whether to extract a custom hook. Covers query/mutation containers, the
> composition-root page, orchestrator patterns, and page complexity patterns.

All examples use structural placeholder names (`Entity`, `{feature}`).

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
      <H4>Preferences</H4>
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
