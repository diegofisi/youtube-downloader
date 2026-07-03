# Forms — Zod v4 + react-hook-form

Absorbs base guideline §4.9 (Zod Validation Schemas) in full, plus the RHF wiring rules from §4.6, applied to where Stash actually needs forms.

## Zod rules (§4.9, unchanged)

- Import from `zod/v4` (Zod v4 API).
- Schemas live in the feature's `helpers/` folder: `[domain].schema.ts` or `[action]-[domain].schema.ts`.
- Always derive the form type with `z.infer<typeof schema>` — never duplicate the interface.
- Compose with `.partial()`, `.pick()`, `.omit()`, `.extend()` to avoid repetition.
- Validation messages are user-friendly strings (in Stash: Spanish via `t()` where surfaced, see below), not technical errors.
- Zod is for **forms and runtime validation only**. Domain Models and DTOs remain plain TS interfaces.

```typescript
// features/settings/helpers/settings.schema.ts
import { z } from "zod/v4";

export const settingsSchema = z.object({
  defaultQuality: z.enum(["auto", "max", "2160", "1440", "1080", "720", "480", "360"]),
  defaultContainer: z.enum(["mp4", "mkv", "webm"]),
  defaultAudioFormat: z.enum(["mp3", "m4a", "opus"]),
  defaultConcurrency: z.number().int().min(0, "Mínimo 0 (sin límite)").max(10, "Máximo 10"),
  defaultMode: z.enum(["video", "audio"]),
  defaultTemplate: z.string().min(1, "La plantilla no puede estar vacía"),
  defaultSubtitles: z.boolean(),
  defaultThumbnail: z.boolean(),
  clearLinksAfterPreview: z.boolean(),
});

export type SettingsForm = z.infer<typeof settingsSchema>;
```

```typescript
// Composition example (§4.9): the download-options dialog reuses the settings schema
export const downloadOptionsSchema = settingsSchema
  .pick({ defaultQuality: true, defaultContainer: true, defaultAudioFormat: true })
  .extend({
    mode: z.enum(["video", "videoonly", "audio"]),
    audioBitrate: z.number().int().min(0),      // 0 = auto
    subtitles: z.boolean(),
    subLangs: z.string(),
    embedThumbnail: z.boolean(),
    outputTemplate: z.string().optional(),
  });
```

## RHF wiring (§4.6 rules, unchanged)

```typescript
const form = useForm<SettingsForm>({
  resolver: zodResolver(settingsSchema),
  defaultValues: { /* or `values: settingsModel` when a query feeds the form */ },
});

const onSubmit = form.handleSubmit((data) => {
  mutate(data, {
    onSuccess: () => toast.success(t("Guardado", "Saved")),
    onError: (e) => toast.error(String(e)),
  });
});
```

- `mutate` + callbacks, never `mutateAsync` + try/catch.
- The presentational form component receives `form`, `onSubmit`, `isLoading` via props and only uses `register`/`Controller` — no logic (§4.19).
- Never mix React 19 native form hooks (`useActionState`, `useFormStatus`, `useOptimistic`) with RHF (§4.18).

### Validation messages and i18n

Stash surfaces messages in both languages via `t(es, en)`. Zod messages are evaluated at schema definition; since `t()` reads the current lang at call time and the app re-renders on language change (see `conventions.md`), build the schema inside a function when its messages must be bilingual:

```typescript
export const buildSettingsSchema = () =>
  z.object({
    defaultTemplate: z.string().min(1, t("La plantilla no puede estar vacía", "Template cannot be empty")),
    // ...
  });
```

For fixed-language projects the guideline's plain-const schema is fine; in Stash prefer the builder when a message is user-visible.

## Where Stash needs forms

| Form | Feature / file | Fields (grounded in current code) | Notes |
|---|---|---|---|
| Settings | `settings/helpers/settings.schema.ts` | the 9 `SettingsUpdate` fields (quality, container, audio format, concurrency, mode, template, subtitles, thumbnail, clear-links flag) | Query `['settings']` feeds RHF via `values:`; save = `set_settings` mutation. Download folder is NOT part of the form — it's its own picker flow (`plugin-dialog` `open()` + `set_download_folder`). |
| Download options ("plantilla" / video-opts dialog) | `download/helpers/download-options.schema.ts` | `DownloadOptions`: mode, quality, container, audioFormat, audioBitrate, subtitles, subLangs, embedThumbnail, outputTemplate | Defaults seeded from the settings query. Output = `DownloadOptions` model passed to the queue store's `enqueue`, never submitted to a mutation directly. `cookieMode` is injected by the session layer at enqueue time — not a form field. |
| Search ("búsqueda") | `search/` | single query string | Per §4.18: a single input + submit does NOT need RHF/Zod — `useState` + form `onSubmit` is correct. Don't over-engineer. |
| URL paste (Descargar) | `download/` | textarea of URLs | Same: not an RHF form. Light parsing/dedupe is a helper (`helpers/parse-urls.ts`), validation feedback via analysis results. |

## Do / Don't

| Do | Don't |
|---|---|
| `z.infer` for every form type | Hand-written duplicate interfaces |
| Compose schemas (`.pick`, `.extend`) | Copy-pasted field lists across schemas |
| Feed RHF from queries with `values:` | `useEffect` + `form.reset` sync dances |
| Keep trivial single-input forms as `useState` | Wrap the search box in RHF + Zod |
| Bilingual messages via schema builder + `t()` | Hardcoded single-language messages |
| Schemas in `helpers/`, one file per form | Schemas inline in components or hooks |
