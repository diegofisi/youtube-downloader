# Components — Shadcn, primitives, typography, size & organization rules

Absorbs base guideline §4.7 (Presentational Component), §4.14 (Responsive Table → Cards), §4.16 (Loading/Error without unmounting), §4.19 (Size limits & extraction), §4.20 (components/ organization), §4.21 (Shared state components), and §5 (Layout & Typography Primitives spec) in full.

## Presentational component (§4.7)

```typescript
// features/library/components/LibraryEntryCard.tsx
import type { LibraryEntry } from "../models/library-entry.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Stack } from "@/shared/components/layout/Stack";
import { P, Small } from "@/shared/components/ui/typography";

interface LibraryEntryCardProps {
  entry: LibraryEntry;
}

export const LibraryEntryCard = ({ entry }: LibraryEntryCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{entry.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <Stack gap="sm">
        <P>{entry.format}</P>
        <Small color="muted">{entry.folder}</Small>
      </Stack>
    </CardContent>
  </Card>
);
```

What makes a component presentational (§4.19): **zero business logic** — no `toast.error`, no `useMemo` with business rules, no API calls. Only `register`/`Controller`, layout, props forwarding. If it computes derived business data or shows toasts, it's a container disguised as a component — refactor it.

Shadcn components are installed via `npx shadcn@latest add`, never written by hand (§11.3). Use the existing design system before inventing new primitives.

## Layout primitives (§5.1) — replace raw `<div>`

**Never use raw `<div>`, `<p>`, `<span>`, or `<h1>`–`<h6>` in feature code.**

| Primitive | Replaces | Description | Key props | CSS basis |
|---|---|---|---|---|
| `Stack` | `<div>` with flex | Flex container for stacking | `gap`, `direction`, `align`, `justify`, `wrap` | Flexbox |
| `Grid` | `<div>` with grid | Grid container for layouts | `cols`, `gap` | CSS Grid |
| `Box` | generic `<div>` | Polymorphic semantic wrapper | `className`, `as` | Block/Flex |

## Typography primitives (§5.2) — from `@/shared/components/ui/typography`

| Primitive | Replaces | Key props | Fixed size |
|---|---|---|---|
| `H1`–`H6` | `<h1>`–`<h6>` | `color` | Each has its own fixed responsive size |
| `P` | `<p>` | `color` | `text-sm lg:text-base` + `leading-relaxed` |
| `Small` | `<small>` | `color` | `text-xs lg:text-sm` + `font-medium leading-none` |
| `Span` | `<span>` | `weight`, `color` | Inherits from parent |
| `Blockquote` | `<blockquote>` | `color` | `text-sm lg:text-base` + `italic border-l-4` |

One component = one fixed typographic level. **No `size` prop** — exceptional sizes go via `className`.

### Responsive strategy (§5.2)

Single step up at one breakpoint: `P`/`Small`/`Blockquote` are one step smaller on mobile, full size at `lg` (1024px). `H1`–`H6` step up at `md` (e.g. `H4` = `text-lg` mobile → `md:text-xl`). `Span` inherits size; it only controls `weight` and `color`.

### When to use P vs Small (§5.2)

| Content | Component | Stash example |
|---|---|---|
| Body text, paragraphs, messages | `P` | descriptions, error messages, loading text |
| Labels, annotations, compact data | `Small` | queue speed/ETA, card metadata, table labels |
| Inline emphasis inside P/Small | `Span` | `<Small>ETA: <Span weight="medium">2m</Span></Small>` |

### Color handling (§5.2)

Color is per-usage via the `color` prop: `default` (`text-foreground`), `muted` (`text-muted-foreground`), `primary` (`text-primary`), `inherit` (default). When nesting, set `color` explicitly to override inheritance:

```tsx
<Small color="muted">
  <Span weight="medium" color="default">Formato:</Span>{" "}
  value text inherits muted from Small
</Small>
```

> **Why wrappers instead of raw tags?** Centralizing defaults means one file (`typography.tsx`) changes font-size/line-height/breakpoints app-wide. One-off styles (`uppercase tracking-wide`) go via `className`; prefer the built-in `color`/`weight` props for common patterns.

### Usage examples (§5.3)

```tsx
<Stack gap="md" direction="col">
  <H2>{t("Cola de descargas", "Download queue")}</H2>
  <P color="muted">{t("Descripción", "Description")}</P>
</Stack>

<Stack gap="sm" direction="row" align="center">
  <Thumbnail />
  <P>{video.title}</P>
</Stack>

<Grid cols={3} gap="lg">
  <MediaCard /> <MediaCard /> <MediaCard />
</Grid>

<Box className="p-4 rounded-lg bg-panel">
  <Content />
</Box>
```

## Size limits & extraction (§4.19)

**One component per file.** Each `.tsx` exports exactly one component. Internal helper components go to their own file when they exceed ~20 JSX lines; smaller inline render helpers (no props interface) may stay as `const` in the file.

| Metric | Threshold | Action |
|---|---|---|
| JSX lines | > ~200 | Extract sections into sub-components |
| Props | > 10 | Group via a hook or split the component |
| Distinct visual blocks (Cards/sections) | 3+ | Each block is an extraction candidate |
| Internal sub-component | > ~20 JSX lines | Extract to own file in same folder |

Extraction strategy: (1) identify visual blocks (each `<Card>`/section); (2) create sub-components in the same folder named after the section (`VideoOptsQualityCard`, `VideoOptsAudioCard`); (3) props flow down — sub-components stay purely presentational; (4) the parent becomes pure composition (~100 lines of `<XCard form={form} />` blocks).

Shared pattern components (§4.19): when the same visual pattern repeats across features, promote it to `shared/components/ui/` (e.g. an integer-only `QuantityInput`). Feature-local first; promote when reused.

## components/ folder organization (§4.20)

Group by **consumer** (the page/container that uses them), subfolders in `kebab-case`:

| Signal | Action |
|---|---|
| Components serve clearly different views (list vs detail vs form) | Group by consumer view |
| > 8 files in `components/` | Strongly consider subfolders |
| Flat folder mixes list, detail, and form components | Always split |
| > 10 files in a consumer subfolder | Sub-group by section/tab (`detail/payments/`-style) |
| A tab has 2+ extracted sub-components | Move tab + subs into a sub-folder |
| Component used by multiple subfolders | Keep at `components/` root |

**Two nesting levels maximum.** `components/queue/QueueItemRow.tsx` (1) and `components/queue/item/QueueItemActions.tsx` (2) are fine; a third level is never allowed.

```text
features/download/components/
  MediaBadge.tsx              # shared across preview/ and opts/
  url-input/                  # → DescargarPage input section
    UrlTextarea.tsx
    RecentLinksMenu.tsx
  preview/                    # → analysis results
    PreviewGrid.tsx
    PreviewCard.tsx
    PlaylistGroup.tsx
  video-opts/                 # → download options dialog
    VideoOptsDialog.tsx
    QualitySection.tsx
    AudioSection.tsx
```

Import-path updates when moving files (§4.20): inside level-1 subfolders `../models/` → `../../models/`; inside level-2 `../../models/` → `../../../models/`; sibling refs `./MediaBadge` → `../MediaBadge`; external consumers add the subfolder path.

## Shared state components (§4.21)

Use these from `@/shared/components/ui/` for ALL loading/error/empty/not-found states. **Never** write inline `<P color="muted" className="py-12 text-center">` patterns.

| Component | Default message | Usage |
|---|---|---|
| `PageLoading` | "Cargando..." | Data being fetched |
| `PageError` | "Ha ocurrido un error." | Command error |
| `PageEmpty` | "Sin resultados." | List has zero items |
| `PageNotFound` | (message required) | Entity not found; **requires `onBack`** callback |

```tsx
{isLoading ? (
  <PageLoading message={t("Cargando biblioteca...", "Loading library...")} />
) : isError ? (
  <PageError message={t("Error al cargar la biblioteca.", "Failed to load the library.")} />
) : (
  <LibraryTable entries={data} />
)}

if (entries.length === 0) return <PageEmpty message={t("Sin descargas.", "No downloads yet.")} />;
```

Always pass a context-specific `message`. Use these from day one in new features.

## Loading & error without unmounting layout (§4.16)

Render loading/error **inside the content area** instead of early-returning, so headers/filters/navigation stay mounted:

```tsx
// BAD: early return unmounts the header and the source tabs
if (isLoading) return <PageLoading />;

// GOOD: header stays; states render in the content slot
return (
  <Stack gap="lg">
    <FeedSourceTabs source={source} onChange={setSource} />
    {isLoading && <PageLoading message={t("Cargando feed...", "Loading feed...")} />}
    {isError && <PageError message={t("Error al cargar.", "Failed to load.")} />}
    {data && <MediaGrid items={data} />}
  </Stack>
);
```

Apply when: detail views with back/header, views with filters or search bars above the data (Stash: Search, My YouTube, Library), any view where the user needs context while loading. Early returns are OK when the whole component IS the loading state (no surrounding layout yet).

## Responsive Table → Cards (§4.14)

Data tables: desktop `<Table>` (`hidden md:block`) + mobile `<Card>` list (`md:hidden`). Stash is desktop-first but windows get narrow — apply it to Library and Queue lists.

```tsx
// Desktop: table
<Box className="hidden md:block">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>{t("Título", "Title")}</TableHead>
        <TableHead>{t("Formato", "Format")}</TableHead>
        <TableHead className="text-right">{t("Fecha", "Date")}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {entries.map((e) => (
        <TableRow key={e.id}>
          <TableCell>{e.title}</TableCell>
          <TableCell>{e.format}</TableCell>
          <TableCell className="text-right">{formatDate(e.date)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Box>

// Mobile: cards — ALWAYS labeled values
<Stack gap="sm" className="md:hidden">
  {entries.map((e) => (
    <Card key={e.id}>
      <CardContent className="p-3">
        <Stack gap="sm">
          <Stack direction="row" gap="lg" className="flex-wrap">
            <Stack gap="none" className="flex-1 min-w-0">
              <Small color="muted">{t("Título", "Title")}</Small>
              <P className="text-sm font-medium">{e.title}</P>
            </Stack>
          </Stack>
          <Separator />
          <Stack direction="row" gap="lg">
            <Stack gap="none">
              <Small color="muted">{t("Formato", "Format")}</Small>
              <P className="text-sm font-semibold">{e.format}</P>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  ))}
</Stack>
```

Rules: **always show labels** on mobile cards (`Small color="muted"` above each value); group related fields in `Stack direction="row"` rows with `Separator` between logical groups; `flex-wrap` for long text.

## Do / Don't

| Do | Don't |
|---|---|
| `Stack`/`Grid`/`Box` for all layout | Raw `<div>` soup |
| `P`/`Small`/`Span`/`H1–H6` for all text | Raw `<p>`/`<span>`/`<h*>` |
| Explicit `color` on nested typography | Rely on inheritance when parent is muted |
| Extract at ~200 JSX lines / 3+ blocks | 500-line mega-components |
| `PageLoading`/`PageError`/`PageEmpty`/`PageNotFound` | Inline muted-`<P>` state markup |
| Keep states inside the content area | Early returns that unmount headers/filters |
| Shadcn via `npx shadcn@latest add` | Hand-written copies of Shadcn primitives |
