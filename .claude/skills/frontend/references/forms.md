# Forms — Zod v4 + react-hook-form

> **Read this when:** building or modifying any form. Covers Zod schema rules,
> schema composition, RHF wiring, localized validation messages, and when NOT
> to use RHF at all.

## Zod rules

- Import from `zod/v4` (Zod v4 API).
- Schemas live in the feature's `helpers/` folder: `[domain].schema.ts` or `[action]-[domain].schema.ts`.
- Always derive the form type with `z.infer<typeof schema>` — never duplicate the interface.
- Compose with `.partial()`, `.pick()`, `.omit()`, `.extend()` to avoid repetition.
- Validation messages are user-friendly strings (localized per the project's i18n scheme, see below), not technical errors.
- Zod is for **forms and runtime validation only**. Domain Models and DTOs remain plain TS interfaces.

```typescript
// features/{feature}/helpers/entity-form.schema.ts
import { z } from "zod/v4";

export const entityFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mode: z.enum(["basic", "advanced", "custom"]),
  limit: z.number().int().min(0, "Minimum 0").max(100, "Maximum 100"),
  retentionDays: z.number().int().min(1),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export type EntityForm = z.infer<typeof entityFormSchema>;
```

```typescript
// Composition example: a quick-edit dialog reuses part of the main schema
export const entityQuickEditSchema = entityFormSchema
  .pick({ mode: true, limit: true })
  .extend({
    reason: z.string().min(1),
  });
```

## RHF wiring

```typescript
const form = useForm<EntityForm>({
  resolver: zodResolver(entityFormSchema),
  defaultValues: { /* or `values: entityModel` when a query feeds the form */ },
});

const onSubmit = form.handleSubmit((data) => {
  mutate(data, {
    onSuccess: () => toast.success("Saved"),
    onError: (e) => toast.error(String(e)),
  });
});
```

- `mutate` + callbacks, never `mutateAsync` + try/catch (see `containers-pages.md` → Container — Mutation).
- The presentational form component receives `form`, `onSubmit`, `isLoading` via props and only uses `register`/`Controller` — no logic (see `components.md` → Presentational component).
- When a query feeds the form, pass the model via `values:` — never a `useEffect` + `form.reset` sync dance.
- Never mix React 19 native form hooks (`useActionState`, `useFormStatus`, `useOptimistic`) with RHF (see `containers-pages.md` → React 19 note).

## Validation messages and i18n

Zod messages are evaluated at schema definition time. If the project localizes
messages with a runtime helper that reads the current language at call time
(see `conventions.md` → i18n), build the schema inside a function so messages
re-evaluate when the app re-renders on language change:

```typescript
export const buildEntityFormSchema = () =>
  z.object({
    name: z.string().min(1, t("name required, primary language", "Name is required")),
    // ...
  });
```

For fixed-language projects a plain-const schema is fine; prefer the builder
whenever a message is user-visible and the app is multilingual.

## When NOT to use RHF

Don't over-engineer trivial inputs:

| Input | Correct tool |
|---|---|
| Single search box + submit | `useState` + form `onSubmit` — no RHF, no Zod |
| Free-text paste box whose validation is really an analysis step | `useState` + a parsing helper in `helpers/`; feedback comes from the analysis result |
| Multi-field form with validation rules | RHF + Zod, always |

The project's real form inventory (which forms exist, which schemas feed them)
lives in `project.md`.

## Do / Don't

| Do | Don't |
|---|---|
| `z.infer` for every form type | Hand-written duplicate interfaces |
| Compose schemas (`.pick`, `.extend`) | Copy-pasted field lists across schemas |
| Feed RHF from queries with `values:` | `useEffect` + `form.reset` sync dances |
| Keep trivial single-input forms as `useState` | Wrap a search box in RHF + Zod |
| Localized messages via schema builder + the i18n helper | Hardcoded single-language messages |
| Schemas in `helpers/`, one file per form | Schemas inline in components or hooks |
