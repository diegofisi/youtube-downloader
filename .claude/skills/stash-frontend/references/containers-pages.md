# Containers, pages & logic extraction

Absorbs base guideline §4.5 (Container — Query), §4.6 (Container — Mutation), §4.10 (Page Composition Root), §4.11 (Page Orchestrator), §4.13 (Orchestrator Container), §4.17 (Page Complexity Patterns), §4.18 (Custom Hooks + React 19 note). Examples use Stash domains; the rules are the guideline's, unchanged.

## Container — Query (§4.5)

```typescript
// features/library/containers/LibraryListContainer.tsx
import { useGetHistory } from "../api/get-history/useGetHistory";
import { LibraryTable } from "../components/LibraryTable";
import { PageLoading } from "@/shared/components/ui/PageLoading";

export const LibraryListContainer = () => {
  // 'entries' is typed as LibraryEntry[] (Domain Model), NOT DTO
  const { data: entries, isLoading } = useGetHistory();

  if (isLoading) return <PageLoading message="Cargando biblioteca..." />;
  if (!entries) return null;

  return <LibraryTable entries={entries} />;
};
```

## Container — Mutation (§4.6)

**Strict rules:**
- Mutations use `mutate` with `onSuccess`/`onError` callbacks. **NEVER** `mutateAsync` with `try/catch`. Why: `mutate` + callbacks avoids unhandled promise rejections and co-locates success/error logic with the call site.
- Containers receive **navigation callbacks** from their parent page (e.g. `onDone`, `onOpenQueue`) instead of `<Link>` for intra-page navigation. Why: when multiple views live on the same page, navigation between them is **state-based** (managed by the parent page), not route-based. Components render `<button type="button">`, never `<Link>`, for these.
- Always use **path constants** (`AppPath.COLA`) for programmatic navigation. **NEVER** hardcode path strings.

```typescript
// features/settings/containers/SettingsFormContainer.tsx
export const SettingsFormContainer = () => {
  const { data: settings } = useGetSettings();
  const { mutate, isPending } = useSetSettings();

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    values: settings,              // RQ query feeds RHF
  });

  const onSubmit = form.handleSubmit((data) => {
    mutate(data, {
      onSuccess: () => toast.success(t("Ajustes guardados", "Settings saved")),
      onError: (e) => toast.error(String(e)),
    });
  });

  return <SettingsForm form={form} onSubmit={onSubmit} isLoading={isPending} />;
};
```

## Page — Composition Root (§4.10)

The page is the **only** layer that imports and renders multiple containers. It manages inter-container state (dialog open/close, selected entities) and passes callbacks down. **Containers NEVER import other containers.**

```typescript
// features/library/pages/BibliotecaPage.tsx
export const BibliotecaPage = () => {
  // Inter-container state: which dialog is open, which entity is selected
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <>
      <LibraryListContainer
        onDelete={setDeleteEntry}
        onClearAll={() => setClearOpen(true)}
      />
      {/* Dialog containers: independent, orchestrated by the page */}
      <DeleteEntryContainer
        open={!!deleteEntry}
        onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}
        entry={deleteEntry}
      />
      <ClearHistoryContainer open={clearOpen} onOpenChange={setClearOpen} />
    </>
  );
};
```

> Each container is self-contained (fetches its own data, owns its mutations). The page only decides *which* container is visible and *which* entity is selected — this prevents "god components".

## Page Orchestrator Pattern (§4.11)

When one page manages **multiple views** (state-switched, not route-switched — e.g. an empty/analyzed/selecting sequence in Descargar):

- Use `if` statements with early returns for conditional rendering. **No** `switch/case`, **no** `else`, **no** `if-else` chains — sequential `if` returns; the default view is the last unconditioned return.
- Define a union type for the views (`type DescargarView = "input" | "preview" | ...`).
- Pass navigation callbacks (`onBack`, `onAnalyzed`) down to containers; containers never `<Link>` between intra-page views.

```typescript
export const DescargarPage = () => {
  const [view, setView] = useState<DescargarView>("input");

  if (view === "preview") {
    return <PreviewContainer onBack={() => setView("input")} />;
  }

  return <UrlInputContainer onAnalyzed={() => setView("preview")} />;
};
```

## Orchestrator Container Pattern (§4.13)

When a detail view needs **3+ independent operations** (each with its own form + mutation), the container becomes a **folder**:

```text
containers/
  SimpleContainer.tsx               # single responsibility → flat file
  LibraryEntryContainer/            # multiple operations → folder
    index.ts                        # re-exports ONLY the orchestrator
    LibraryEntryContainer.tsx       # orchestrator: fetches data, manages dialog states, renders leaves
    DeleteFileContainer.tsx         # leaf: confirm dialog + delete_history_file mutation
    RemoveEntryContainer.tsx        # leaf: remove_history_item mutation
    ...
```

| Role | Responsibilities |
|---|---|
| Orchestrator | Fetches the main entity, manages dialog open/close states, renders the presentational layout + leaf containers. **Never owns forms or mutations directly.** |
| Leaf | Owns its form (`useForm` + zodResolver) and its mutation. Receives `open`, `onOpenChange`, entity data via props. Handles `onSuccess`/`onError` independently. **Never imports other leaves.** |

If a container has only 1–2 operations, keep it a flat file — no folder.

## Page complexity patterns (§4.17)

**Never create a page that is a thin wrapper around a single container** — either absorb it or orchestrate several.

| Complexity | Pattern | Separate container? | Stash example |
|---|---|---|---|
| Single simple operation | **A — Page absorbs** | No | `AjustesPage` (one form) |
| Single operation, heavy logic | **C — Page + custom hook** | No (hook yes) | `DescargarPage` + `useDescargarAnalysis` |
| Multiple operations | **B — Page orchestrates** | Yes (leaf containers) | `BibliotecaPage` with dialogs |

**Pattern A — page absorbs:** page uses hooks directly and renders presentational components.

```typescript
export const AjustesPage = () => {
  const { form, onSubmit, isPending } = /* hooks used directly */;
  return (
    <Stack gap="lg">
      <H4>{t("Ajustes", "Settings")}</H4>
      <SettingsForm form={form} onSubmit={onSubmit} isLoading={isPending} />
    </Stack>
  );
};
```

**Pattern B — page orchestrates:** the JSX reads as composable blocks — if you blur the prop values, the structure still makes sense (`<Header/>, <Tabs/>, <EditDialog/>, <DeleteDialog/>`). Dialog states live in the page.

**Pattern C — page + custom hook:** heavy logic (many memos/handlers) moves to a hook in `hooks/`; the page stays pure composition.

Anti-pattern (§4.17): `export const XPage = () => <XContainer />;` — if you write this, absorb the container or delete it.

## Custom-hook extraction (§4.18)

| Signal | Action |
|---|---|
| 5+ `useMemo`/`useEffect` in one file | Extract to hook |
| File exceeds ~200 lines of logic (excluding JSX) | Extract to hook |
| Logic reused across pages/containers | Extract to shared hook |
| Single `useState` + one handler | Keep inline — don't over-extract |

Pattern: the hook (`hooks/useX.ts`) owns form + mutations + memos + handlers and returns `{ form, onSubmit, isPending, ... }`; the page/container consumes and composes.

**When NOT to use:**
- **`useReducer` is not a substitute for `useMemo` chains.** With `react-hook-form` managing state, derived data are computed values, not state transitions. `useMemo` for derived data; `useReducer` only for genuine state machines.
- Don't extract a hook for 1–2 lines of logic.

### React 19 note (§4.18, applies to Stash)

React 19 with `@vitejs/plugin-react` (standard Babel transform); **React Compiler NOT enabled**:
- `useMemo`/`useCallback` remain the standard memoization tools — use for expensive computations or referential stability (hook deps, `React.memo` props).
- If the React Compiler is enabled later, revisit — it auto-memoizes most expressions.
- **Never** use React 19 form hooks (`useActionState`, `useFormStatus`, `useOptimistic`) with `react-hook-form` — they are for native HTML form actions only. Do not mix.
