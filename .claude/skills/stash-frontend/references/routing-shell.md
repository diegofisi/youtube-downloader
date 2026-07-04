# Routing & Shell — flat routes, sidebar, titlebar

## Adaptation 4 — No roles, no guards (OVERRIDES guideline §8–9)

**Differs from the base guideline because** Stash is a single-user desktop app: there is no login, no roles, no permissions, therefore no role-based route groups, no `Auth.tsx` guards, no `RootLayout` auth initialization, no `useUserInfo`/permissions config. Guideline §8 (role-based routing) and §9 (roles & permissions) do not apply — their full content is preserved in `web-app-patterns.md` for web projects. What **survives** from §8: the **path constants rule** (§8.5/§8.9: paths are the single source of truth, never hardcode strings) and the exhaustive route-map typing.

## Path constants (kept rule)

```typescript
// shared/routes/app-path.ts
export const AppPath = {
  ROOT: "/",
  DESCARGAR: "/descargar",
  BUSCAR: "/buscar",
  YOUTUBE: "/youtube",
  COLA: "/cola",
  BIBLIOTECA: "/biblioteca",
  AJUSTES: "/ajustes",
  ANY: "*",
} as const;

export type AppPath = keyof typeof AppPath;
```

- Always `navigate(AppPath.COLA)` / `<NavLink to={AppPath.BIBLIOTECA}>`. **NEVER** hardcode `"/cola"`.
- `as const` + `keyof typeof` gives the key union; use `{ [key in AppPath]: Route }` if you keep a typed route map, so adding a path without a route is a compile error (§8.5 exhaustiveness, kept).

## Router — flat, one layout

The six sections (`descargar | buscar | youtube | cola | biblioteca | ajustes`) are defined by `AppPath` in `src/shared/routes/app-path.ts`; `/` and any unknown path redirect to `/descargar`.

```typescript
// shared/routes/router.tsx
import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AppPath } from "./app-path";

// Hash router: a Tauri app is served from a local index.html — hash routing
// avoids any dependence on server-side route resolution.
export const router = createHashRouter([
  {
    element: <AppShell />,                       // sidebar + titlebar + <Outlet />
    children: [
      { path: AppPath.ROOT, element: <Navigate to={AppPath.DESCARGAR} replace /> },
      { path: AppPath.DESCARGAR, element: <DescargarPage /> },
      { path: AppPath.BUSCAR, element: <BuscarPage /> },
      { path: AppPath.YOUTUBE, element: <YoutubePage /> },
      { path: AppPath.COLA, element: <ColaPage /> },
      { path: AppPath.BIBLIOTECA, element: <BibliotecaPage /> },
      { path: AppPath.AJUSTES, element: <AjustesPage /> },
      { path: AppPath.ANY, element: <Navigate to={AppPath.DESCARGAR} replace /> },
    ],
  },
]);
```

- No `LayoutWrapper`, no per-route layouts: one `AppShell` for everything. The onboarding/setup gate is a dialog rendered by the shell (blocking until `check_dependencies` reports ready + `stash.onboarded`), not a route.
- Cross-view intents that used the bus (`descargar:prefill` from Search/My YouTube "download this") become router state: `navigate(AppPath.DESCARGAR, { state: { urls } })`; `DescargarPage` reads `location.state` and triggers analysis.
- **Keep queue/session wiring out of routes**: global listeners and the queue store live above the router (see `data-flow.md`), so navigation never interrupts downloads.

## AppShell

Lives in `src/shared/routes/` (AppShell + Sidebar + Titlebar — the eslint "shell" layer), on top of the `src/shared/lib/window.ts` helpers.

```text
AppShell
 ├── Titlebar          # data-tauri-drag-region + window controls
 ├── Sidebar           # nav + queue badge + session banner trigger
 └── <main><Outlet /></main>
```

### Titlebar

```tsx
// shared/routes/Titlebar.tsx
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "@/shared/lib/window";

export const Titlebar = () => (
  <Box data-tauri-drag-region className="flex h-10 items-center justify-between select-none">
    {/* data-tauri-drag-region makes the bar draggable; it only applies to THIS
        element, not children — buttons inside remain clickable. */}
    <Small color="muted" data-tauri-drag-region>Stash</Small>
    <Stack direction="row" gap="none">
      <WindowButton onClick={() => void minimizeWindow()} icon="minimize" />
      <WindowButton onClick={() => void toggleMaximizeWindow()} icon="maximize" />
      <WindowButton onClick={() => void closeWindow()} icon="close" />
    </Stack>
  </Box>
);
```

- `data-tauri-drag-region` must sit on the bar itself (and any large empty child area); interactive children must NOT have it.
- Window controls only via `shared/lib/window.ts` (`minimizeWindow`, `toggleMaximizeWindow`, `closeWindow`) — never import `@tauri-apps/api/window` in features (the eslint Tauri-encapsulation rule enforces this).

### Sidebar

| Element | Source of truth | Replaces (vanilla) |
|---|---|---|
| Nav items | static list `{ path: AppPath.X, label: t(es,en), icon }`, rendered with `<NavLink>` (active style from `isActive`) | `NAV` array + manual `navStyle` repaint |
| Section title | derive from the matched route (or per-page heading) | `TITLES[view]` + `nav:changed` |
| Queue badge (on "Cola") | `useQueueStore(selectActiveCount)` — hidden when 0, monospace count | `bus 'queue:count'` + `router.setBadge` |
| Session banner ("session expired") | `['session','status']` query `=== 'expired'` && not dismissed (local state) | `bus 'session:expired'` + hidden toggling |
| Theme toggle | ui store action (see `conventions.md`) | `theme:changed` bus event |
| "Connect YouTube" action | `useOpenYoutubeLogin` mutation | direct `openYouTubeLogin()` call |

## Do / Don't

| Do | Don't |
|---|---|
| `AppPath` constants everywhere | Hardcoded `"/cola"` strings |
| One flat route list under one `AppShell` | Role folders, guards, `RootLayout` auth init |
| Router state for cross-view intents (prefill) | A global bus event for navigation |
| `data-tauri-drag-region` on the titlebar element | Drag region on buttons/inputs |
| Window ops via `shared/lib/window.ts` | `getCurrentWindow()` calls inside features |
| Onboarding as a shell-level blocking dialog | An `/onboarding` route users could navigate away from |
