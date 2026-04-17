# BloomIQ — Frontend

Next.js **App Router** client for BloomIQ. This package renders the marketing shell, authentication flows, and the signed-in **app shell** (sidebar + main content). All JSON data is loaded from **`/api/*`**, which is **rewritten in development** to the separate backend app (see [API & backend coupling](#api--backend-coupling)).

---

## Stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| UI | React 18, [Tailwind CSS](https://tailwindcss.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Language | TypeScript (`strict`) |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) via `next/font` |

Path alias: `@/*` → `src/*` (see `tsconfig.json`).

---

## Folder layout

```text
frontend/
├── next.config.mjs      # Dev rewrites: /api → backend origin
├── tailwind.config.ts   # Design tokens (colors, shadows)
├── src/
│   ├── app/             # Routes, layouts, metadata
│   │   ├── layout.tsx   # Root: font, globals.css, viewport, <html>/<body>
│   │   ├── page.tsx     # Public landing (/)
│   │   ├── login/ …     # Auth (outside app shell)
│   │   ├── signup/
│   │   ├── forgot-password/   # Redirects to /login
│   │   ├── reset-password/    # Redirects to /login
│   │   └── (app)/       # Route group: signed-in chrome (no URL segment)
│   │       ├── layout.tsx    # AppShell (sidebar / mobile nav + main)
│   │       ├── dashboard/
│   │       ├── plants/…
│   │       ├── calendar/     # Full-viewport calendar (see page notes below)
│   │       └── …
│   ├── components/      # Feature UI (co-located by domain)
│   │   ├── auth/
│   │   ├── calendar/
│   │   ├── dashboard/
│   │   ├── insights/
│   │   ├── layout/      # AppShell.tsx, AppSidebar.tsx
│   │   ├── plants/      # Lists, detail shell, tabs, add flow
│   │   └── settings/
│   └── lib/
│       ├── api.ts              # fetch helpers + ApiEnvelope typing
│       └── backend-origin.ts   # Absolute URLs for <img> / binary APIs
```

**Convention:** Route files in `app/` stay thin (`page.tsx` imports a `*Content` or form component from `components/`). Heavy logic, forms, and data fetching live in client components under `components/`.

---

## Routing

### Route group `(app)`

Files under `src/app/(app)/` share a layout that mounts **`AppShell`**:

- **Desktop (`lg` and up):** fixed **`AppSidebar`** (~280px) and main content with **`lg:pl-[280px]`** so the column clears the sidebar.
- **Mobile / tablet (below `lg`):** a **top bar** (logo, notification, menu), **slide-in drawer** for the same nav as the sidebar, backdrop tap to close, and **safe-area** padding for notched devices. Main content has top padding for the bar height.

The `(app)` segment does **not** appear in the URL.

**Calendar page** (`src/app/(app)/calendar/page.tsx`) uses a **`fixed`** full-viewport `<main>` so the calendar can manage its own scroll regions. It uses **`pl-0` on small screens** and **`lg:pl-[280px]`** on desktop so it does not reserve sidebar gutter width on phones.

### Public vs authenticated surfaces

There is **no Next.js middleware** in this package. **Auth is enforced by the API** (cookies + 401s); pages under `(app)` assume a logged-in user for a good UX, while `login` and `signup` are standalone routes.

| URL | Purpose |
|-----|---------|
| `/` | Landing: links to sign in / sign up |
| `/login` | Sign in (`?registered=1` query flag supported) |
| `/signup` | Registration |
| `/forgot-password` | Redirects to **`/login`** (password changes happen in **Settings** while signed in) |
| `/reset-password` | Redirects to **`/login`** |

### Signed-in navigation (sidebar / drawer)

Primary nav is defined in `src/components/layout/AppSidebar.tsx`:

| Path | Page role |
|------|-----------|
| `/dashboard` | Home dashboard |
| `/plants` | Plant list |
| `/plants/add` | Add plant flow |
| `/calendar` | Care calendar |
| `/insights` | Insights and AI brief |
| `/settings` | Account & preferences (includes **change password** modal) |
| `/help` | Help center (linked from sidebar footer, not in the main `nav` array) |

### Plant detail (nested routes)

`/plants/[id]` uses a **nested layout** that wraps children in **`PlantDetailShell`** (tabs, header, `PlantDetailProvider` context).

| Path | Tab / view |
|------|------------|
| `/plants/[id]` | Redirects to **`/plants/[id]/overview`** |
| `/plants/[id]/overview` | Overview |
| `/plants/[id]/care-log` | Care chat |
| `/plants/[id]/gallery` | Gallery |
| `/plants/[id]/history` | History |

Tab segments are validated in `PlantDetailShell` against `overview`, `care-log`, `gallery`, `history`.

---

## API & backend coupling

### JSON requests (same-origin)

Client code calls **relative** paths such as `/api/plants`, `/api/auth/login`, etc. In development, `next.config.mjs` **rewrites** those to the backend:

```12:21:frontend/next.config.mjs
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
```

`backend` defaults to `process.env.API_PROXY_TARGET` or `http://localhost:3000`.

### Cookies

`src/lib/api.ts` uses `credentials: "include"` on `fetch` so **HTTP-only auth cookies** set by the backend are sent on API calls.

### Response shape

Typed helpers expect a consistent envelope:

```1:6:frontend/src/lib/api.ts
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
};
```

Use `apiGet`, `apiPost`, `apiPatch`, `apiPostFormData`, and `apiDelete` from `src/lib/api.ts` instead of ad-hoc `fetch` where possible.

### Images and binary URLs

Rewriting large/binary responses through the frontend dev server can be unreliable. For **`<img src>`** (plant photos, avatars), components use **`absoluteApiUrl()`** from `src/lib/backend-origin.ts`, which points at the **backend origin** in development (and can use `NEXT_PUBLIC_API_PROXY_TARGET` when set). Server-side rewrites still use **`API_PROXY_TARGET`** (no `NEXT_PUBLIC_` prefix).

---

## Styling & layout

- **Global styles:** `src/app/globals.css` (Tailwind layers + focus rules).
- **Theme:** `tailwind.config.ts` extends the palette (`cream`, `forest`, `olive`, `sidebar.*`, page-specific canvases like `plants-canvas`, `care-canvas`, etc.) and shadows (`card`, `soft`).
- **App shell:** Sidebar + padded main on large screens; **drawer + top bar** on small screens (`AppShell` + `AppSidebar`).
- **Responsive patterns:** `min-w-0` / `max-w-full` on flex children where needed, readable typography scales, and calendar/day layouts tuned for narrow viewports.

---

## Scripts & ports

| Script | Command |
|--------|---------|
| Dev | `npm run dev` → **http://localhost:3001** |
| Production build | `npm run build` |
| Start (after build) | `npm start` (also port **3001**) |
| Lint | `npm run lint` |

Ensure the **backend** is reachable at the origin configured for rewrites (default **3000**) when exercising APIs locally.

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `API_PROXY_TARGET` | `.env.local` (optional) | Backend base URL for **Next.js rewrites** (`next.config.mjs`) |
| `NEXT_PUBLIC_API_PROXY_TARGET` | `.env.local` (optional) | Backend origin for **browser** `absoluteApiUrl()`; in dev, code falls back to `http://localhost:3000` if unset |

Copy `.env.example` to `.env.local` and adjust if your API is not on the default host/port.

---

## Adding a new screen (checklist)

1. Add a folder under `src/app/(app)/your-route/` with `page.tsx` (or use a dynamic segment).
2. Implement UI in `src/components/…` and keep `page.tsx` as a thin entry.
3. If the link should appear in the sidebar, extend the `nav` array in `AppSidebar.tsx`.
4. Call the backend via **`/api/...`** and `apiGet` / `apiPost` / etc.
5. For new **remote image domains**, add `images.remotePatterns` in `next.config.mjs`.
6. Test **mobile width** (`<1024px`): confirm nothing assumes `pl-[280px]` unless scoped to `lg:`.

---

For full-stack setup (MongoDB, JWT secrets, Gemini, running both apps), see the **[root README](../README.md)** and **[backend README](../backend/README.md)**.
