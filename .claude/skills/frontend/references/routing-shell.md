# Routing & Shell — path constants, flat router, app shell

> **Read this when:** adding or changing routes, the sidebar/nav, the app
> shell, or (on desktop) the titlebar and window controls. Covers the
> path-constants rule, the flat single-shell router, and Tauri shell specifics.

For **role-based routing, guards, and permissions** (multi-user web apps), see
`web-app-patterns.md`. A single-user app has no login, no roles, no route
groups, no guards — one flat route list under one shell. What always applies,
in every project: the **path constants rule** and exhaustive route-map typing.

## Path constants (universal rule)

```typescript
// shared/routes/app-path.ts — placeholder paths; the real map lives in project.md
export const AppPath = {
  ROOT: "/",
  HOME: "/home",
  ENTITIES: "/entities",
  PREFERENCES: "/preferences",
  ANY: "*",
} as const;

export type AppPath = keyof typeof AppPath;
```

- Always `navigate(AppPath.ENTITIES)` / `<NavLink to={AppPath.PREFERENCES}>`. **NEVER** hardcode `"/entities"`.
- `as const` + `keyof typeof` gives the key union; use `{ [key in AppPath]: Route }` if you keep a typed route map, so adding a path without a route is a compile error.

## Router — flat, one layout (single-user apps)

```typescript
// shared/routes/router.tsx
import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AppPath } from "./app-path";

export const router = createHashRouter([
  {
    element: <AppShell />,                       // nav + (titlebar) + <Outlet />
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.HOME} replace /> },
      { path: AppPath.HOME, element: <HomePage /> },
      { path: AppPath.ENTITIES, element: <EntityListPage /> },
      { path: AppPath.PREFERENCES, element: <PreferencesPage /> },
      { path: AppPath.ANY, element: <Navigate to={AppPath.HOME} replace /> },
    ],
  },
]);
```

- No `LayoutWrapper`, no per-route layouts: one `AppShell` for everything.
- A first-run/onboarding gate is a **blocking dialog rendered by the shell** (gated on a readiness query + a persisted flag), not a route users could navigate away from.
- Cross-view intents ("open view X prefilled with this data") are **router state**: `navigate(AppPath.X, { state: { ... } })`; the target page reads `location.state` and acts. Never a global bus event.
- **Keep live-process wiring out of routes**: global listeners and live-process stores live above the router (see `data-flow.md` → Event wiring), so navigation never interrupts running work.

### Route registry vs router assembly (+ lazy pages)

Split the **registry** ("what routes exist") from the **assembly** ("how the
router is built"), and code-split each page. The registry is the single source of
truth — add a page by adding one line.

```tsx
// shared/routes/app-routes.tsx — the registry (data)
import { lazy, Suspense, type ComponentType } from "react";
import { PageLoading } from "@/shared/components/ui/PageLoading";
import { AppPath } from "./app-path";

type LoadPage = () => Promise<{ default: ComponentType }>;

function route(path: string, load: LoadPage) {
  const Page = lazy(load);
  return { path, element: <Suspense fallback={<PageLoading />}><Page /></Suspense> };
}

export const appRoutes = [
  route(AppPath.HOME, () => import("@/features/home/pages/HomePage").then((m) => ({ default: m.HomePage }))),
  route(AppPath.ENTITIES, () => import("@/features/entities/pages/EntityListPage").then((m) => ({ default: m.EntityListPage }))),
  // one line per page; `.then` picks the named export (type-checked)
];
```

```tsx
// shared/routes/router.tsx — the assembly (thin)
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.HOME} replace /> },
      ...appRoutes,
      { path: AppPath.ANY, element: <Navigate to={AppPath.HOME} replace /> },
    ],
  },
]);
```

- **Do split registry from assembly** — decoupling "what routes exist" from "how
  they mount" is a real separation of concerns; lazy pages keep the initial bundle small.
- **Don't fragment the registry into a file/folder per route.** A route entry is
  pure data (path → page); the page and its logic already live in its feature
  slice — there is no concern to decouple. One readable list beats N one-line files.
- **More structure DOES pay off when a real concern appears**: guards/permissions,
  multiple layouts, or role-based route groups each become their own files
  (`guards/`, `layouts/`, route-group modules) — that is `web-app-patterns.md`
  territory (multi-user apps).

## AppShell

Lives in `src/shared/routes/` (the eslint "shell" layer — see
`architecture.md` → Dependency rules).

```text
AppShell
 ├── Titlebar          # desktop only: drag region + window controls
 ├── Sidebar           # nav + live badges + status banner
 └── <main><Outlet /></main>
```

### Sidebar

| Element | Source of truth |
|---|---|
| Nav items | static list `{ path: AppPath.X, label, icon }`, rendered with `<NavLink>` (active style from `isActive`) |
| Section title | derive from the matched route (or per-page heading) — never a manual "current view" variable |
| Live badge (e.g. active jobs count) | a store selector (`useJobQueueStore(selectActiveCount)`) — hidden when 0 |
| Status banner (e.g. "session expired") | derives from a status query + local dismissed state |
| Theme toggle | ui store action (see `conventions.md` → Theme) |

## When the backend is Tauri (desktop)

### Hash router

A Tauri app is served from a local `index.html` — use `createHashRouter` so
routing never depends on server-side route resolution.

### Titlebar

```tsx
// shared/routes/Titlebar.tsx
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "@/shared/lib/window";

export const Titlebar = () => (
  <Box data-tauri-drag-region className="flex h-10 items-center justify-between select-none">
    {/* data-tauri-drag-region makes the bar draggable; it only applies to THIS
        element, not children — buttons inside remain clickable. */}
    <Text variant="small" color="muted" data-tauri-drag-region>{APP_NAME}</Text>
    <Stack direction="row" gap="none">
      <WindowButton onClick={() => void minimizeWindow()} icon="minimize" />
      <WindowButton onClick={() => void toggleMaximizeWindow()} icon="maximize" />
      <WindowButton onClick={() => void closeWindow()} icon="close" />
    </Stack>
  </Box>
);
```

- `data-tauri-drag-region` must sit on the bar itself (and any large empty child area); interactive children must NOT have it.
- Window controls only via a shared wrapper module (`shared/lib/window.ts`: `minimizeWindow`, `toggleMaximizeWindow`, `closeWindow`) — never import `@tauri-apps/api/window` in features (the transport-encapsulation lint rule enforces this, see `architecture.md`).

## Do / Don't

| Do | Don't |
|---|---|
| `AppPath` constants everywhere | Hardcoded path strings |
| One flat route list under one `AppShell` (single-user) | Role folders/guards in a single-user app |
| Router state for cross-view intents (prefill) | A global bus event for navigation |
| `data-tauri-drag-region` on the titlebar element | Drag region on buttons/inputs |
| Window ops via `shared/lib/window.ts` | `getCurrentWindow()` calls inside features |
| Onboarding as a shell-level blocking dialog | An onboarding route users could navigate away from |
