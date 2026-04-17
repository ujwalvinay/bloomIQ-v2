# BloomIQ — Backend

HTTP **JSON API** and **binary media** endpoints for BloomIQ, implemented as [Next.js 14](https://nextjs.org/) **Route Handlers** under `src/app/api/`. Data lives in **MongoDB** via **Mongoose**. Authentication is **cookie-based** (JWT access + refresh tokens, HTTP-only).

This package is designed to run as a **standalone server** (default **http://localhost:3000**). The web app typically proxies `/api` to it in development; see the [root README](../README.md) and [frontend README](../frontend/README.md).

---

## Contents

1. [Stack](#stack)
2. [Repository layout](#repository-layout)
3. [Configuration](#configuration)
4. [Running locally](#running-locally)
5. [Architecture](#architecture)
6. [Authentication & sessions](#authentication--sessions)
7. [API conventions](#api-conventions)
8. [HTTP API reference](#http-api-reference)
9. [Data model](#data-model)
10. [Domain libraries](#domain-libraries)
11. [Seeding demo data](#seeding-demo-data)
12. [Operational notes](#operational-notes)

---

## Stack

| Concern | Technology |
|---------|------------|
| Runtime & routing | Next.js 14 (App Router), Route Handlers |
| Database | MongoDB + Mongoose 8 |
| Validation | Zod (`src/lib/validators/`) |
| Passwords | bcryptjs |
| Tokens | jsonwebtoken |
| Dates / timezones | date-fns, date-fns-tz |
| AI (optional) | Google **Gemini** HTTP API (`GEMINI_API_KEY` / `GOOGLE_API_KEY`) — plant profiles, care chat, insights brief |
| Email (optional) | [Resend](https://resend.com) for **legacy** forgot-password emails if you call that API outside the current app UI |

TypeScript **`strict`** mode, path alias `@/*` → `src/*`.

---

## Repository layout

```text
backend/
├── scripts/
│   └── seed.ts              # Demo user + plants (npm run seed)
├── src/
│   ├── app/
│   │   ├── api/             # All HTTP endpoints (…/route.ts)
│   │   ├── layout.tsx       # Minimal root layout
│   │   └── page.tsx         # Non-API surface (not required for API clients)
│   ├── lib/                 # Shared logic
│   │   ├── api.ts           # successResponse, errorResponse, parseJsonBody, …
│   │   ├── auth.ts          # JWT sign/verify, requireAuth, safe user shape
│   │   ├── cookies.ts       # Cookie names + set/clear helpers
│   │   ├── db.ts            # Mongoose connect (HMR-safe singleton)
│   │   ├── env.ts           # Zod-validated env (Mongo + JWT + NODE_ENV)
│   │   ├── mail.ts          # Legacy password-reset URL + Resend delivery
│   │   ├── gemini-plant-profile.ts, gemini-care-chat.ts, gemini-insights-brief.ts
│   │   ├── insights-fingerprint.ts
│   │   ├── serializers.ts   # Lean docs → API-friendly JSON
│   │   ├── care-utils.ts    # Care schedules, due dates, user TZ helpers
│   │   ├── calendar-tasks.ts
│   │   ├── plant-image.ts   # MIME sniffing, size limits, normalization
│   │   └── validators/      # Zod schemas per resource
│   ├── models/              # User, Plant, CarePlan, Task, ActivityLog, InsightAiBrief
│   └── types/               # Shared TS types (auth, api, plant, …)
├── .env.example
└── package.json
```

---

## Configuration

### Required (validated at runtime)

`getEnv()` in `src/lib/env.ts` parses and caches:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | HMAC secret for access JWT |
| `JWT_REFRESH_SECRET` | HMAC secret for refresh JWT (must differ from access) |
| `NODE_ENV` | `development` \| `production` \| `test` (defaults to `development`) |

If any required value is missing, the first call that loads env will **throw** with a JSON summary of field errors.

### Optional / feature-specific

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google AI / Gemini — plant profile inference, `/api/plants/[id]/care-chat`, `/api/insights/ai-brief` generation |
| `GEMINI_MODEL` | Optional model override (see `.env.example`) |
| `APP_ORIGIN` | Base URL for **legacy** password-reset links from `forgot-password` (default `http://localhost:3001`) |
| `RESEND_API_KEY` | Resend API key — only needed if you use **email** reset flows |
| `MAIL_FROM` | Verified sender — use with Resend |

In **development**, if Resend is not configured, `sendPasswordResetEmail` **logs** the reset URL to the server console instead of sending mail.

Copy `.env.example` to `.env` and fill values before `npm run dev`.

---

## Running locally

```bash
cd backend
npm install
cp .env.example .env   # then edit
npm run dev            # http://localhost:3000
```

| Script | Description |
|--------|-------------|
| `npm run dev` | Next dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run lint` | ESLint |
| `npm run seed` | Idempotent demo dataset (needs `MONGODB_URI`) |

---

## Architecture

- **Route handlers** live next to each other under `src/app/api/**/route.ts`. Most export `GET`, `POST`, `PATCH`, or `DELETE`.
- **`export const dynamic = "force-dynamic"`** is used on routes that must not be statically cached (auth, user data, etc.).
- **`connectToDatabase()`** is called per request where persistence is needed; the helper **reuses** one Mongoose connection across invocations (and across Next dev HMR via `globalThis`).
- **Authorization** for protected routes uses `requireAuth(request)` (`src/lib/auth.ts`), which reads the **access** JWT from a cookie and returns `401` JSON if invalid or absent.
- **User scoping**: queries include `userId` (or join through owned `Plant`) so one user cannot read another’s documents.

---

## Authentication & sessions

### Cookies (`src/lib/cookies.ts`)

| Name | Content | Max-Age |
|------|---------|---------|
| `bloomiq_access` | JWT access token | 15 minutes |
| `bloomiq_refresh` | JWT refresh token | 7 days |

Attributes: **`httpOnly: true`**, **`path: /`**, **`sameSite: lax`**, **`secure`** when `NODE_ENV === "production"`.

### JWT (`src/lib/auth.ts`)

- **Access** payload: `sub` (user id), `email`.
- **Refresh** payload: `sub`, `tv` (`refreshTokenVersion` on the user document). If the DB version does not match `tv`, refresh fails and cookies are cleared — useful for **logout-all** or after password change (if you bump the version).

### Public vs protected endpoints

- **Public**: signup, login, refresh, logout, forgot-password, reset-password (no access cookie required; forgot/reset are **legacy** email flows).
- **Protected**: everything that reads or mutates user-owned data (plants, tasks, care plans, dashboard, me, avatars, plant images, activities), plus **`POST /api/auth/change-password`** (requires access cookie + current password) and **`/api/insights/ai-brief`** (GET/POST/PATCH).

Clients should send **`credentials: "include"`** on `fetch` so cookies attach to API calls.

---

## API conventions

### Envelope

Successful and failed JSON responses use the same shape as consumed by the frontend (`src/types/api.ts`):

```ts
// Success
{ success: true, message: string, data: T, error: null }

// Error
{ success: false, message: string, data: null, error: string }
```

Helpers: `successResponse`, `errorResponse`, `handleServerError`, `formatZodError`, `parseJsonBody` in `src/lib/api.ts`.

### Validation

Request bodies and query strings are validated with **Zod** in `src/lib/validators/`. Validation failures usually return **422** with `error` describing fields.

### Pagination (shared defaults)

From `src/lib/validators/common.ts`:

- `page` — integer ≥ 1, default **1**
- `limit` — integer 1–100, default **10**

Used by list endpoints for plants, tasks, and activities.

### Calendar date strings

Several query schemas require **`YYYY-MM-DD`** calendar dates (interpreted in the **authenticated user’s timezone** where relevant).

---

## HTTP API reference

Below, **Auth** means a valid **access** cookie unless noted.

### Auth & account

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/signup` | No | Create user; returns `SafeUser` (**does not** set session cookies — client signs in after) |
| `POST` | `/api/auth/login` | No | Email + password; sets cookies |
| `POST` | `/api/auth/logout` | No* | Clears auth cookies (`POST` with no body is fine) |
| `POST` | `/api/auth/refresh` | Refresh cookie | Issues new access + refresh tokens |
| `POST` | `/api/auth/forgot-password` | No | Legacy: starts email reset flow; emails or logs URL (see mail env) |
| `POST` | `/api/auth/reset-password` | No | Legacy: complete reset with token from email |
| `POST` | `/api/auth/change-password` | Yes | Body: `currentPassword`, `newPassword` — updates hash, bumps `refreshTokenVersion`, clears cookies in response |
| `GET` | `/api/auth/me` | Yes | Current user profile (`SafeUser`) |
| `PATCH` | `/api/auth/me` | Yes | Update profile fields |
| `GET` | `/api/auth/me/avatar` | Yes | Raw avatar bytes (`Content-Type` from stored MIME) |
| `POST` | `/api/auth/me/avatar` | Yes | Upload avatar (multipart or JSON per handler) |
| `DELETE` | `/api/auth/me/avatar` | Yes | Remove avatar |

\*Logout clears cookies regardless; no access token required.

### Plants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/plants` | Yes | Paginated list; query: `page`, `limit`, `search`, `status`, `location`, `sort` (`recent` \| `name` \| `watering`), `includeArchived` (`true`/`false`/`1`/`0`) |
| `POST` | `/api/plants` | Yes | Create plant (JSON and/or multipart; supports `imageBase64` for proxies that strip `FormData`) |
| `GET` | `/api/plants/[id]` | Yes | Plant detail |
| `PATCH` | `/api/plants/[id]` | Yes | Update plant |
| `DELETE` | `/api/plants/[id]` | Yes | Delete plant |
| `GET` | `/api/plants/[id]/image` | Yes | Embedded plant photo bytes |
| `POST` | `/api/plants/[id]/care-chat` | Yes | Body: message + optional image — Gemini care assistant reply |

### Care plans

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/care-plans` | Yes | List plans; query: `plantId`, `type` (`watering` \| `fertilizing` \| `pruning`), `isActive` (`true` \| `false`) |
| `POST` | `/api/care-plans` | Yes | Create plan; schedules tasks / next due |
| `PATCH` | `/api/care-plans/[id]` | Yes | Update plan |
| `DELETE` | `/api/care-plans/[id]` | Yes | Remove plan |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tasks` | Yes | Paginated tasks; query: `page`, `limit`, `status`, `type`, `plantId`, `from`, `to` (due range) |
| `POST` | `/api/tasks` | Yes | Create **custom** task |
| `GET` | `/api/tasks/due-today` | Yes | Tasks due “today” in user TZ |
| `GET` | `/api/tasks/calendar-day` | Yes | Query: `date=YYYY-MM-DD` — tasks for that calendar day |
| `GET` | `/api/tasks/calendar-range` | Yes | Query: `from`, `to` (inclusive, max **94** days) — lightweight marks for calendar UI |
| `PATCH` | `/api/tasks/[id]/complete` | Yes | Mark completed / drives care-plan logic |
| `PATCH` | `/api/tasks/[id]/snooze` | Yes | Body: `snoozedUntil` or `snoozeDays` |
| `PATCH` | `/api/tasks/[id]/skip` | Yes | Skip task |

### Activities & dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/activities` | Yes | Paginated activity log; query: `page`, `limit`, `plantId`, `action` |
| `POST` | `/api/activities` | Yes | Append activity (e.g. note, manual log) |
| `GET` | `/api/dashboard/summary` | Yes | Aggregated dashboard payload |

### Insights (AI brief)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/insights/ai-brief` | Yes | Current stored brief, staleness vs dashboard fingerprint, small stats preview |
| `POST` | `/api/insights/ai-brief` | Yes | Regenerate brief via Gemini; persists `InsightAiBrief` |
| `PATCH` | `/api/insights/ai-brief` | Yes | Body: `content` — save user-edited brief text |

Requires **`GEMINI_API_KEY`** (or `GOOGLE_API_KEY`) for successful `POST` generation.

---

## Data model

High-level relationships:

```text
User ──< Plant ──< CarePlan
         │           │
         └──< Task ──┘
         └──< ActivityLog
```

### `User` (`src/models/User.ts`)

- Credentials: `passwordHash` (select: false), optional `passwordResetTokenHash` / `passwordResetExpiresAt` (legacy email reset)
- Profile: `name`, `email` (unique), `timezone`, `notificationEnabled`
- Avatar: `avatarData`, `avatarMimeType`, `hasAvatar`
- Session invalidation: `refreshTokenVersion` (incremented on password change and some logout paths)

### `InsightAiBrief` (`src/models/InsightAiBrief.ts`)

- One document per `userId` (unique): AI or user-edited **insights page brief** text, `contentKind`, `sourceFingerprint` for staleness when dashboard stats change

### `Plant` (`src/models/Plant.ts`)

- Scoped with `userId`
- Fields: `name`, `species`, `location`, `notes`, `status` (`healthy` \| `needs_attention` \| `archived`)
- Images: optional remote `imageUrl`, optional embedded `imageData` + `imageMimeType`, `hasEmbeddedImage`

### `CarePlan` (`src/models/CarePlan.ts`)

- `type`: `watering` \| `fertilizing` \| `pruning`
- `frequencyDays`, `startDate`, `lastCompletedAt`, `nextDueAt`, `isActive`
- **Partial unique index**: at most one **active** plan per `(plantId, type)`

### `Task` (`src/models/Task.ts`)

- `type` includes `custom` in addition to care types
- `status`: `pending`, `completed`, `done`, `snoozed`, `skipped`
- **Partial unique index** on pending recurring tasks per `(carePlanId, dueAt)` for deduplication

### `ActivityLog` (`src/models/ActivityLog.ts`)

- `action`: `watered`, `fertilized`, `pruned`, `note_added`, `task_skipped`, `task_snoozed`, `custom_task_done`
- Optional `taskId`, `notes`, `taskTitle` snapshot for custom completions

---

## Domain libraries

| Module | Role |
|--------|------|
| `care-utils.ts` | Compute `nextDueAt`, align due instants with user timezone, seed pending tasks from plans |
| `calendar-tasks.ts` | Shape rows for calendar-day API |
| `serializers.ts` | Normalize ObjectIds and dates to strings for JSON |
| `plant-image.ts` | Max size, allowed MIME types, buffer normalization |
| `activity-response.ts` | Enrich activity list with resolved task titles |
| `password-reset-token.ts` | Hash / verify reset tokens (legacy forgot-password / reset-password routes) |
| `gemini-plant-profile.ts` | Gemini calls for inferred light level + care guide JSON |
| `gemini-care-chat.ts` | Multi-turn plant care chat with optional image |
| `gemini-insights-brief.ts` | One-shot collection narrative for insights |
| `insights-fingerprint.ts` | SHA-based fingerprint of dashboard counts for brief staleness |

---

## Seeding demo data

```bash
npm run seed
```

- Requires **`MONGODB_URI`** in `.env`.
- **Idempotent**: if the demo user already has plants, the script skips creating duplicates.
- Default demo credentials are defined in `scripts/seed.ts` (email / password constants) — change them for anything beyond local demos.

---

## Operational notes

### Production checklist

- Set strong, unique **JWT secrets**.
- Set **`GEMINI_API_KEY`** (or `GOOGLE_API_KEY`) if you use AI plant profiles, care chat, or insights brief generation.
- Configure **Resend** + **`MAIL_FROM`** and **`APP_ORIGIN`** only if you still expose **email-based** password reset to users.
- Ensure **`secure` cookies** work (HTTPS).
- MongoDB: use a managed cluster with TLS; restrict network access.

### Same-origin vs split hosting

Cookie auth assumes the **browser** can send cookies to the host serving the API. If the SPA and API use **different public origins**, you must align **CORS**, **`SameSite`**, and **`Secure`** policies, or terminate both behind one **reverse proxy** path. Embedded image `GET` routes require the same cookies as JSON APIs.

### Next.js config

`next.config.mjs` is minimal (`reactStrictMode: true`). No rewrites here — the **frontend** app proxies `/api` in dev.

---

## Related documentation

- [BloomIQ root README](../README.md) — full-stack quick start
- [Frontend README](../frontend/README.md) — routes, proxy, `credentials`, and image URLs
