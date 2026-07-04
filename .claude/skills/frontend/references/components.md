# Components — Shadcn, primitives, typography, size & organization rules

> **Read this when:** writing any JSX. Covers presentational components, layout
> and typography primitives, size limits and extraction, `components/` folder
> organization, shared state components, and the responsive table→cards pattern.

All examples use structural placeholder names (`Entity`, `{feature}`).
User-facing strings in examples are plain English — in real code, wrap them per
the project's i18n scheme (see `project.md` and `conventions.md` → i18n).

## Presentational component

```typescript
// features/{feature}/components/EntityCard.tsx
import type { Entity } from "../models/entity.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Stack } from "@/shared/components/layout/Stack";
import { Text } from "@/shared/components/ui/typography";

interface EntityCardProps {
  entity: Entity;
}

export const EntityCard = ({ entity }: EntityCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{entity.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <Stack gap="sm">
        <Text variant="body">{entity.status}</Text>
        <Text variant="small" color="muted">{entity.description}</Text>
      </Stack>
    </CardContent>
  </Card>
);
```

What makes a component presentational: **zero business logic** — no
`toast.error`, no `useMemo` with business rules, no API calls. Only
`register`/`Controller`, layout, props forwarding. If it computes derived
business data or shows toasts, it's a container disguised as a component —
refactor it.

Presentational components MAY own **local, ephemeral, presentation-only state** —
a disclosure/hover/focus toggle, an `open` flag for their own popover, `useRef`,
`useId`, and the outside-click listener of their own widget. What they must NOT do
is fetch, mutate, read/write stores, show toasts, or compute business-derived
data. 'Zero hooks in a component' is a smell, not a rule (see
`containers-pages.md` → The Container/Component boundary).

Shadcn components are installed via `npx shadcn@latest add`, never written by
hand. Use the existing design system before inventing new primitives.

## Layout primitives — replace raw `<div>`

**Never use raw `<div>`, `<p>`, `<span>`, or `<h1>`–`<h6>` in feature code.**

| Primitive | Replaces | Description | Key props | CSS basis |
|---|---|---|---|---|
| `Stack` | `<div>` with flex | Flex container for stacking | `gap`, `direction`, `align`, `justify`, `wrap` | Flexbox |
| `Grid` | `<div>` with grid | Grid container for layouts | `cols`, `gap` | CSS Grid |
| `Box` | generic `<div>` | Polymorphic semantic wrapper | `className`, `as` | Block/Flex |

## Typography — the single `<Text>` component

All text renders through ONE component from `@/shared/components/ui/typography`:
`<Text variant="..." as="..." color="..." weight="...">`. There are **no**
`H1`–`H6`/`P`/`Small`/`Span` wrappers (removed) and **never** raw `<h1>`/`<p>`/`<span>`.

- **`variant`** = role → size + default weight, from the fluid scale. Values:
  `h1 h2 h3 h4 h5 h6 lead body body-sm small caption code inline`. `inline`
  carries no size (inherits the parent's) — use it for inline emphasis.
- **`as`** = constrained polymorphic tag. Each variant maps to a default semantic
  tag (MUI `variantMapping` style); pass `as` only when the look must differ from
  the element: `<Text variant="h1" as="h2">` renders a styled h1 as an `<h2>`.
- **`color`**: `default | muted | primary | inherit`. **`weight`**: `normal | medium | semibold | bold`.
- The call site carries **zero size classes**: `<Text variant="body" color="muted">`.
  Need a new size? **Add a variant** — never an inline `text-[..px]`.

### Type scale (fixed micro + fluid content)

Sizes live ONLY as `--text-*` tokens in `globals.css` `@theme`. Two tiers:
- **Micro UI chrome is FIXED** — `micro` (10.5), `caption` (11.5), `small` (12.5),
  `body-sm` (13.5). Labels/badges must not scale; a fluid micro size would shift
  ~1px on large windows and stop "looking the same".
- **Content is FLUID** — `body`, `lead`, and headings `h1`–`h6` use
  `clamp(MIN, PREFERRED, MAX)`: grow with window width, then **hard-cap at MAX**
  (caps at a project-chosen design-max viewport width, static beyond; the exact
  interpolation window + sizes live in `project.md`). Rules for any fluid token:
- **Keep a `rem` term** in PREFERRED (pure `vw` fails WCAG 1.4.4 on zoom).
- **MAX ≤ 2.5 × MIN** per token (or the cap itself blocks 200% zoom).
- Generate values with the Utopia calculator; headings scale expressively, body
  gently.

### CRITICAL: register custom size tokens with tailwind-merge

Custom font-size utilities (`text-h1`, `text-body`, …) MUST be registered with
`tailwind-merge` in `cn` (`shared/lib/utils.ts`):
`extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: [...all --text-* names...] }] }}})`.
Otherwise tailwind-merge classifies `text-h1` as a text **color**, and when a
color class is merged (`text-h1` + `text-foreground`) it **silently drops the
size**, so text falls back to the preflight ~14px reset (tiny, non-fluid). Any new
`--text-*` token must be added to that list.

## Size limits & extraction

**One component per file.** Each `.tsx` exports exactly one component. Internal
helper components go to their own file when they exceed ~20 JSX lines; smaller
inline render helpers (no props interface) may stay as `const` in the file.

| Metric | Threshold | Action |
|---|---|---|
| JSX lines | > ~200 | Extract sections into sub-components |
| Props | > 10 | Group via a hook or split the component |
| Distinct visual blocks (Cards/sections) | 3+ | Each block is an extraction candidate |
| Internal sub-component | > ~20 JSX lines | Extract to own file in same folder |

Extraction strategy: (1) identify visual blocks (each `<Card>`/section);
(2) create sub-components in the same folder named after the section
(`EntityOptionsCard`, `EntityAdvancedCard`); (3) props flow down —
sub-components stay purely presentational; (4) the parent becomes pure
composition (~100 lines of `<XCard form={form} />` blocks).

Shared pattern components: when the same visual pattern repeats across
features, promote it to `shared/components/ui/` (e.g. an integer-only
`QuantityInput`). Feature-local first; promote when reused.

## components/ folder organization

Group by **consumer** (the page/container that uses them), subfolders in
`kebab-case`:

| Signal | Action |
|---|---|
| Components serve clearly different views (list vs detail vs form) | Group by consumer view |
| > 8 files in `components/` | Strongly consider subfolders |
| Flat folder mixes list, detail, and form components | Always split |
| > 10 files in a consumer subfolder | Sub-group by section/tab (`detail/{section}/`-style) |
| A tab has 2+ extracted sub-components | Move tab + subs into a sub-folder |
| Component used by multiple subfolders | Keep at `components/` root |

**Two nesting levels maximum.** `components/list/EntityListRow.tsx` (1) and
`components/list/row/EntityRowActions.tsx` (2) are fine; a third level is
never allowed.

```text
features/{feature}/components/
  StatusBadge.tsx             # shared across list/ and form/
  list/                       # → list view section
    EntityListTable.tsx
    EntityListFilters.tsx
  detail/                     # → detail view
    DetailHeaderCard.tsx
    DetailItemsTable.tsx
  form/                       # → create/edit dialog
    EntityFormDialog.tsx
    OptionsSection.tsx
    AdvancedSection.tsx
```

Import-path updates when moving files: inside level-1 subfolders `../models/` →
`../../models/`; inside level-2 `../../models/` → `../../../models/`; sibling
refs `./StatusBadge` → `../StatusBadge`; external consumers add the subfolder
path.

## Shared state components

Use these from `@/shared/components/ui/` for ALL loading/error/empty/not-found
states. **Never** write inline `<Text variant="body" color="muted" className="py-12 text-center">`
patterns.

| Component | Default message | Usage |
|---|---|---|
| `PageLoading` | "Loading..." | Data being fetched |
| `PageError` | "Something went wrong." | Endpoint error |
| `PageEmpty` | "No results." | List has zero items |
| `PageNotFound` | (message required) | Entity not found; **requires `onBack`** callback |

```tsx
{isLoading ? (
  <PageLoading message="Loading list..." />
) : isError ? (
  <PageError message="Failed to load the list." />
) : (
  <EntityListTable entities={data} />
)}

if (entities.length === 0) return <PageEmpty message="Nothing here yet." />;
```

Always pass a context-specific `message`. Use these from day one in new features.

## Loading & error without unmounting layout

Render loading/error **inside the content area** instead of early-returning, so
headers/filters/navigation stay mounted:

```tsx
// BAD: early return unmounts the header and the filter tabs
if (isLoading) return <PageLoading />;

// GOOD: header stays; states render in the content slot
return (
  <Stack gap="lg">
    <SourceTabs source={source} onChange={setSource} />
    {isLoading && <PageLoading message="Loading feed..." />}
    {isError && <PageError message="Failed to load." />}
    {data && <ResultsGrid items={data} />}
  </Stack>
);
```

Apply when: detail views with back/header, views with filters or search bars
above the data, any view where the user needs context while loading. Early
returns are OK when the whole component IS the loading state (no surrounding
layout yet).

## Responsive Table → Cards

Data tables: desktop `<Table>` (`hidden md:block`) + mobile `<Card>` list
(`md:hidden`). Apply to any list view — even desktop apps get narrow windows.

```tsx
// Desktop: table
<Box className="hidden md:block">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Title</TableHead>
        <TableHead>Format</TableHead>
        <TableHead className="text-right">Date</TableHead>
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
              <Text variant="small" color="muted">Title</Text>
              <Text variant="body" weight="medium">{e.title}</Text>
            </Stack>
          </Stack>
          <Separator />
          <Stack direction="row" gap="lg">
            <Stack gap="none">
              <Text variant="small" color="muted">Format</Text>
              <Text variant="body" weight="semibold">{e.format}</Text>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  ))}
</Stack>
```

Rules: **always show labels** on mobile cards (`<Text variant="small" color="muted">` above each
value); group related fields in `Stack direction="row"` rows with `Separator`
between logical groups; `flex-wrap` for long text.

## Do / Don't

| Do | Don't |
|---|---|
| `Stack`/`Grid`/`Box` for all layout | Raw `<div>` soup |
| `<Text variant>` for all text | Raw `<p>`/`<span>`/`<h*>` |
| Explicit `color` on nested typography | Rely on inheritance when parent is muted |
| Add a variant to the `<Text>` scale | Inline `text-[..px]` font sizes |
| Extract at ~200 JSX lines / 3+ blocks | 500-line mega-components |
| `PageLoading`/`PageError`/`PageEmpty`/`PageNotFound` | Inline muted-`<Text>` state markup |
| Keep states inside the content area | Early returns that unmount headers/filters |
| Shadcn via `npx shadcn@latest add` | Hand-written copies of Shadcn primitives |
