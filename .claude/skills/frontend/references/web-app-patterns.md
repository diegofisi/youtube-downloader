# Web-app patterns — HTTP client, auth, roles

> **Read this when:** the project is a multi-user **web** app (HTTP backend,
> login, roles). Never for single-user desktop apps — their transport lives in
> `data-flow.md` (Tauri section) and their routing in `routing-shell.md`.

## HTTP client & interceptors

`shared/lib/http-client.ts` uses axios with two interceptors: (1) request —
injects `Authorization` from `localStorage`; (2) response — unwraps the
backend's `{ success, message, data }` wrapper and handles 401 token refresh.

**Key pattern:** when a 401 occurs and refresh fails, call
`useAuthStore.getState().logout()` — never manually clear localStorage +
`window.location.href`. The store triggers reactive re-renders; route guards
redirect naturally. It is also a no-op when not logged in (prevents unwanted
reloads on failed login attempts).

```typescript
// shared/lib/http-client.ts
import axios from "axios";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

const API_BASE_URL = "http://localhost:3000/api";

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inject access token into every request
httpClient.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Unwrap { success, message, data } -> data + handle 401 refresh
httpClient.interceptors.response.use(
  (response) => {
    if (response.data && "success" in response.data && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        useAuthStore.getState().logout(); // no-op if not logged in
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const tokens = data.data;
        localStorage.setItem("accessToken", tokens.accessToken);
        localStorage.setItem("refreshToken", tokens.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return httpClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
```

The fetcher pattern with this client (see `data-flow.md` → Query/Mutation
hooks): `const { data } = await httpClient.get<XDTOResponse>("/path"); return
data;` inside `queryFn`/`mutationFn`, then `select: toModel`.

## Auth store with derived initial state

```typescript
// features/auth/stores/useAuthStore.ts
// Derive initial status from localStorage — token present → "idle" (pending
// validation), otherwise "unauthenticated". Hardcoding breaks page refresh.
const getInitialStatus = (): AuthStatus =>
  localStorage.getItem("accessToken") ? AuthStatus.Idle : AuthStatus.Unauthenticated;

const initialState = { user: null as User | null, status: getInitialStatus() };

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,
  setUser: (user) => set({ user, status: AuthStatus.Authenticated }),
  setStatus: (status) => set({ status }),
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null, status: AuthStatus.Unauthenticated });
  },
  reset: () => set(initialState),
}));
```

Login container rule set (mutation flavor of `containers-pages.md` → Container
— Mutation): on success store tokens in `localStorage`, `setUser(user)`, toast,
`navigate(AuthPath.ROOT, { replace: true })` — all inside `mutate`'s
`onSuccess`.

## Role-based routing

Routes live in `src/shared/routes/`, grouped by role. Each role gets a folder
with 4 files + a central router.

### Directory structure

```text
src/shared/
  ├── interfaces/router.ts       # Shared Route interface
  └── routes/
       ├── router.tsx            # Main router (createBrowserRouter)
       ├── RootLayout.tsx        # Auth initialization (token check, useMe, set store)
       ├── LayoutWrapper.tsx     # Wraps element with its assigned layout
       └── [RoleName]Routes/
            ├── role-path.ts     # Path constants (as const)
            ├── Role.tsx         # Guard (auth + permissions + <Outlet />)
            ├── RoleRoot.tsx     # Default redirect for the group
            └── RoleRoutes.tsx   # Route definitions object
```

### RootLayout — auth initialization

Top-level route component wrapping all groups: checks stored token, fetches the
user via `useMe({ enabled: hasToken && status === AuthStatus.Idle })`, sets the
store, shows a spinner while `status === Idle && hasToken`, then renders
`<Outlet />`. On `isError` → `setStatus(AuthStatus.Unauthenticated)`.

### The 4 files per group

| File | Responsibility |
|---|---|
| `role-path.ts` | Path constants — single source of truth for the group's URLs. |
| `Role.tsx` | Guard: checks auth/permissions, redirects if unauthorized, renders `<Outlet />` if valid. |
| `RoleRoot.tsx` | Default redirect: base path → default sub-route (`<Navigate to={UserPath.OVERVIEW} replace />`). |
| `RoleRoutes.tsx` | Typed route map: each path key → `{ path, element, label, layout }`. |

### Shared Route interface

```typescript
export interface Route {
  path: string;
  element: React.ReactNode;
  label?: string;
  layout?: React.ComponentType;
}
```

### Code patterns

```typescript
// user-path.ts — as const + keyof typeof = exhaustive key union
export const UserPath = {
  ROOT: "/main/",
  OVERVIEW: "/main/overview",
  REPORTS: "/main/reports",
  MY_ORGANIZATION: "/main/organization",
  ANY: "*",
} as const;
export type UserPath = keyof typeof UserPath;

// Auth.tsx — guard with early-return ifs (no else / if-else)
export const Auth: React.FC = () => {
  const { authStatus, userPermissions } = useUserInfo();
  if (authStatus === AuthStatus.Authenticated) {
    return userPermissions?.isAdmin()
      ? <Navigate to={AdminPath.ROOT} replace />
      : <Navigate to={UserPath.ROOT} replace />;
  }
  return <Outlet />;
};

// UserRoutes.tsx — exhaustive typed map: adding a UserPath key without a
// route definition is a compile error
export const UserRoutes: { [key in UserPath]: Route } = {
  ROOT: { path: UserPath.ROOT, element: <Navigate to={UserPath.OVERVIEW} replace /> },
  OVERVIEW: { path: UserPath.OVERVIEW, element: <Overview />, label: "OVERVIEW", layout: UserLayout },
  REPORTS: { path: `${UserPath.REPORTS}/*`, element: <Reports />, label: "REPORTS", layout: UserLayout },
  MY_ORGANIZATION: { path: UserPath.MY_ORGANIZATION, element: <Organization />, label: "MY_ORGANIZATION", layout: UserLayout },
  ANY: { path: UserPath.ANY, element: <Navigate to={UserPath.OVERVIEW} replace /> },
} as const;
```

### Main router & LayoutWrapper

```typescript
export const router = createBrowserRouter([
  {
    element: <RootLayout />,                    // auth init wrapper
    children: [
      { path: "/", element: <Auth />, children: mapGroup(AuthRoutes) },
      { path: "/admin", element: <Admin />, children: mapGroup(AdminRoutes) },
      { path: "/user", element: <User />, children: mapGroup(UserRoutes) },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
// mapGroup = Object.values(routes).map(({ path, element, layout }) =>
//   ({ path, element: <LayoutWrapper layout={layout} element={element} /> }))

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ layout: Layout, element }) => {
  if (Layout) return <Layout>{element}</Layout>;
  return <>{element}</>;
};
```

### Flow summary

`RootLayout` (token check → `useMe` → set store) → path constants → route map →
`router.tsx` → guard (`<Outlet />`) → `LayoutWrapper` → feature page.

### Rules

- One folder per role group; never mix roles.
- Paths are the single source of truth — `UserPath.OVERVIEW`, never `'/main/overview'`.
- Route map must be exhaustive (`{ [key in UserPath]: Route }`).
- Guards handle auth only; business logic belongs in containers.
- Layouts are assigned per route, not per group.
- `RootLayout` wraps all groups; auth init happens once at the top.

## Roles & permissions

### Role definition

```typescript
// shared/types/roles.ts
export const Role = {
  SuperAdmin: "super_admin",
  Admin: "admin",
  User: "user",
} as const;
export type RoleType = (typeof Role)[keyof typeof Role];

// Domain models reference RoleType instead of duplicating string unions:
// features/auth/models/user.model.ts
export type UserRole = RoleType;
export interface User { id: string; role: UserRole; /* ... */ }
```

### Permission system — config-driven, granular CRUD per feature

```typescript
// shared/helpers/permissions.ts
const permissionConfig = {
  isAdmin: [Role.SuperAdmin, Role.Admin],
  isUser: [Role.User],
  // Granular CRUD per feature as needed:
  // users: { create: [Role.SuperAdmin], read: [Role.SuperAdmin, Role.Admin], ... },
} as const;

export const userPermissions = (currentRole: RoleType) => {
  const hasPermission = (roles: readonly RoleType[]) => roles.includes(currentRole);
  return {
    isAdmin: () => hasPermission(permissionConfig.isAdmin),
    isUser: () => hasPermission(permissionConfig.isUser),
    // users: { create: () => hasPermission(permissionConfig.users.create), ... },
  };
};
export type UserPermissions = ReturnType<typeof userPermissions>;
```

### useUserInfo hook — central auth info

```typescript
// features/auth/hooks/useUserInfo.ts
export const useUserInfo = () => {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const permissions: UserPermissions | null = user ? userPermissions(user.role) : null;
  return {
    authStatus: status,           // 'idle' | 'authenticated' | 'unauthenticated'
    userPermissions: permissions, // UserPermissions | null
    userInfoLoading: status === "idle",
  };
};

// Usage in guards/containers:
// const { userPermissions } = useUserInfo();
// if (userPermissions?.isAdmin()) { /* admin-only */ }
```

### Adding permissions for a new feature

1. Add the CRUD config to `permissionConfig` in `shared/helpers/permissions.ts`.
2. Add the corresponding methods to the `userPermissions` return object.
3. Consume via `useUserInfo().userPermissions?.feature.action()` in guards or containers.

## AuthStatus

```typescript
// shared/types/status.ts
export const AuthStatus = {
  Idle: "idle",                    // token exists, pending validation
  Authenticated: "authenticated",
  Unauthenticated: "unauthenticated",
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];
```

Always compare against `AuthStatus.Authenticated`, never raw strings
(autocomplete, refactoring safety, single source of truth). This is the
canonical instance of the const-object pattern (see `conventions.md` → Const
object + type pattern).
