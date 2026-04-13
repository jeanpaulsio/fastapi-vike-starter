# Vike Patterns — Developer Reference

This project uses Vike (SSR framework on Vite) with **server-side rendering enabled** (`ssr: true` is the default). React 19, TypeScript, `vike-react` extension, deployed as an SSR Node.js service on Render via `server.js` (Express).

---

## 1. Project Config (Our Setup)

### Global config — `web/pages/+config.ts`

```ts
import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

export default {
  title: "My App",
  description: "A modern full-stack application",
  extends: [vikeReact],
} satisfies Config;
```

Key implications of SSR mode:
- Express server (`server.js`) handles all routes via `renderPage()`
- Guards run on BOTH server and client — must be isomorphic
- `typeof window === "undefined"` check required for browser-only APIs
- Cookies (not localStorage) for auth tokens — accessible in SSR via `pageContext.headers`
- Static assets served from `dist/client/`, SSR renders from `dist/server/`

### Production server — `web/server.js`

Express serves static assets and delegates all routes to Vike's `renderPage()`. Render runs `node server.js` as the start command.

---

## 2. File Structure

### The `+` prefix rule

Any file starting with `+` is a Vike config file. Regular component files do NOT use `+`.

### Special `+` filenames

| File | Purpose | Cumulative? |
|------|---------|------------|
| `+Page.tsx` | Root component for a route | No |
| `+Layout.tsx` | Layout wrapper | Yes (stacks) |
| `+config.ts` | Config/settings for this dir and below | Varies |
| `+guard.ts` | Auth/access guard hook (server + client) | No |
| `+data.ts` | Data fetching hook (server by default) | No |
| `+Head.tsx` | HTML head tags component | Yes (stacks) |
| `+route.ts` | Custom route string or function | No |

### Current directory structure

```
web/
  pages/
    +config.ts          <- global config (extends vikeReact)
    +Layout.tsx          <- global root layout (QueryClientProvider + CSS import)
    +Head.tsx            <- global <head> (viewport meta)
    tailwind.css         <- Tailwind v4 + design tokens
    index/
      +Page.tsx          <- landing page -> /
      +guard.ts          <- redirects to /app/dashboard if authed
    login/
      +Page.tsx          <- login page -> /login
      +guard.ts          <- redirects to /app/dashboard if authed
    app/
      +Layout.tsx        <- app shell (sidebar + auth check + React Query user fetch)
      +guard.ts          <- redirects to /login if no access_token
      dashboard/
        +Page.tsx        <- /app/dashboard
      projects/
        +Page.tsx        <- /app/projects
      settings/
        +Page.tsx        <- /app/settings
      team/
        +Page.tsx        <- /app/team
  components/
    layout/
      Sidebar.tsx        <- NOT a Vike file (no + prefix)
  services/
    auth.ts              <- login, getMe, refreshToken
    client.ts            <- Axios instance with interceptors
  hooks/
    useAuth.ts           <- useCurrentUser() + useLogout() via React Query
  lib/
    cookies.ts           <- isomorphic cookie helpers
    types.ts             <- User, TokenResponse types
    utils.ts             <- cn() tailwind merge
  tests/                 <- Vitest + React Testing Library
```

---

## 3. Auth Pattern (SSR + Cookies)

### CRITICAL: We use cookies, NOT localStorage

Tokens are stored in cookies so they're accessible during SSR. Guards read cookies isomorphically:

```ts
// pages/app/+guard.ts
import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { getCookie } from "@/lib/cookies";

export function guard(pageContext: PageContext): void {
  const cookieStr =
    typeof window === "undefined"
      ? ((pageContext.headers as Record<string, string> | undefined)?.["cookie"] ?? "")
      : document.cookie;

  if (!getCookie("access_token", cookieStr)) {
    throw redirect("/login");
  }
}
```

### Cookie helpers — `lib/cookies.ts`

```ts
// Works on both server (pass cookieStr) and client (reads document.cookie)
getCookie(name: string, cookieStr?: string): string | undefined
setCookie(name: string, value: string, maxAgeSeconds: number): void  // browser only
deleteCookie(name: string): void  // browser only
```

### Guard patterns

**Protect authenticated routes** (pages/app/+guard.ts):
```ts
if (!getCookie("access_token", cookieStr)) throw redirect("/login");
```

**Redirect authed users away** (pages/login/+guard.ts, pages/index/+guard.ts):
```ts
if (getCookie("access_token", cookieStr)) throw redirect("/app/dashboard");
```

### NEVER use localStorage for auth

```ts
// WRONG — breaks SSR, not available on server
if (!localStorage.getItem("access_token")) ...

// CORRECT — cookies work in both environments
if (!getCookie("access_token", cookieStr)) ...
```

### NEVER use `+guard.client.ts` in SSR mode

```
// WRONG — server won't run this, unauthenticated requests get through
+guard.client.ts

// CORRECT — runs on both server and client
+guard.ts
```

---

## 4. Routing

### Filesystem routing

- `pages/index/+Page.tsx` -> `/`
- `pages/login/+Page.tsx` -> `/login`
- `pages/app/dashboard/+Page.tsx` -> `/app/dashboard`
- `pages/(marketing)/about/+Page.tsx` -> `/about` (parenthetical dirs stripped)

### Parameterized routes

```
pages/clients/@id/+Page.tsx      -> /clients/123
```

Access: `usePageContext().routeParams.id`

---

## 5. Layouts

Layouts are **cumulative** — child layouts nest inside parent layouts:

```
<GlobalLayout>        <- pages/+Layout.tsx (QueryClientProvider)
  <AppLayout>         <- pages/app/+Layout.tsx (Sidebar + auth)
    <DashboardPage /> <- pages/app/dashboard/+Page.tsx
  </AppLayout>
</GlobalLayout>
```

Login page has no section layout, so only GlobalLayout wraps it.

### Data fetching in layouts

`+data` hooks are NOT cumulative. If a layout needs data, fetch in the component using React Query (as done in `pages/app/+Layout.tsx` with `useQuery` for `/me`).

---

## 6. Navigation & Redirects

### Decision matrix

| Situation | Use |
|-----------|-----|
| Inside `guard()` or `data()` | `throw redirect("/path")` |
| After form submission / event handler | `navigate("/path")` from `vike/client/router` |
| Show different page without URL change | `throw render("/login")` |

### NEVER use `window.location.href` for in-app navigation

```ts
// WRONG — full page reload, loses React state
window.location.href = "/app/dashboard"

// CORRECT — SPA navigation
import { navigate } from "vike/client/router"
await navigate("/app/dashboard")
```

---

## 7. Common Mistakes

1. **Using localStorage instead of cookies** — breaks SSR
2. **Using `+guard.client.ts` instead of `+guard.ts`** — server won't enforce auth
3. **Using `useEffect` for auth redirects** — causes flash of protected content, use `+guard.ts`
4. **Using `window.location.href`** — full reload, use `navigate()` from `vike/client/router`
5. **Importing from wrong package** — use `vike-react/usePageContext`, not `vike/usePageContext`
6. **Default exporting guard/data** — must be named exports: `export function guard()`, not `export default`
7. **Forgetting `typeof window` check** — any browser API in a guard or store init needs the check
8. **Mutating pageContext** — it's recreated per navigation, use Zustand/React Query for persistence

---

## 8. Quick Reference

### Imports

```ts
import { navigate } from "vike/client/router"
import { redirect, render } from "vike/abort"
import { usePageContext } from "vike-react/usePageContext"
import { useData } from "vike-react/useData"
import type { Config, PageContext } from "vike/types"
```

### pageContext properties

```ts
pageContext.urlPathname          // "/app/dashboard"
pageContext.routeParams          // { id: "123" }
pageContext.headers              // request headers (server only)
pageContext.isClientSide         // true in browser
```
