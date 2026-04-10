# BloomIQ API

Production-minded REST-style JSON API for the BloomIQ plant care backend. All responses share one envelope.

## Setup

All commands below are run from the **`backend/`** directory at the repo root.

1. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` in `backend/` and set:

   | Variable | Description |
   |----------|-------------|
   | `MONGODB_URI` | MongoDB Atlas connection string |
   | `JWT_ACCESS_SECRET` | Secret for access JWT (strong random string) |
   | `JWT_REFRESH_SECRET` | Secret for refresh JWT (different from access) |
   | `NODE_ENV` | `development` or `production` (affects `secure` cookie flag) |

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   API base URL: `http://localhost:3000/api`

4. **Seed demo data** (optional; requires `MONGODB_URI` only in `.env` for the script)

   ```bash
   npm run seed
   ```

   Demo user: `demo@bloomiq.app` / `password123`

## Authentication

- **Access token** and **refresh token** are stored in **httpOnly** cookies (`bloomiq_access`, `bloomiq_refresh`).
- **Access** lifetime: 15 minutes. **Refresh** lifetime: 7 days.
- Cookie options: `sameSite=lax`, `secure` when `NODE_ENV=production`, `path=/`.
- After login, the browser sends cookies automatically on same-origin requests. For API clients (e.g. curl, Postman), forward `Cookie` headers from login/refresh responses.

## Response envelope

Every response body:

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": {},
  "error": null
}
```

Error example:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "error": "details"
}
```

## Endpoints

### Auth

#### `POST /api/auth/signup`

**Auth:** None  

**Body (JSON):**

| Field | Type | Rules |
|-------|------|--------|
| `name` | string | required, max 120 |
| `email` | string | valid email |
| `password` | string | min 8 characters |

**Status:** `201` created, `409` duplicate email, `422` validation error  

**Sample success:**

```json
{
  "success": true,
  "message": "Account created",
  "data": {
    "_id": "...",
    "name": "Ada",
    "email": "ada@example.com",
    "timezone": "Asia/Kolkata",
    "notificationEnabled": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "error": null
}
```

---

#### `POST /api/auth/login`

**Auth:** None  

**Body:** `{ "email": string, "password": string }`  

**Sets cookies:** access + refresh  

**Status:** `200`, `401` invalid credentials, `422` validation  

**Sample success:** same user shape as signup in `data`.

---

#### `POST /api/auth/refresh`

**Auth:** Refresh cookie  

**Body:** none  

**Sets cookies:** new access + refresh (same `refreshTokenVersion` until logout invalidates)  

**Status:** `200`, `401` invalid/expired refresh or version mismatch  

**Sample success:**

```json
{
  "success": true,
  "message": "Tokens refreshed",
  "data": { "ok": true },
  "error": null
}
```

---

#### `POST /api/auth/logout`

**Auth:** Optional (uses refresh cookie if present to bump `refreshTokenVersion`)  

**Clears cookies**  

**Status:** `200`  

**Sample success:**

```json
{
  "success": true,
  "message": "Logged out",
  "data": { "ok": true },
  "error": null
}
```

---

#### `GET /api/auth/me`

**Auth:** Access cookie  

**Status:** `200`, `401`  

**Sample success:** `{ "data": { ...user } }` (no `passwordHash`)

---

### Plants

#### `GET /api/plants`

**Auth:** Required  

**Query:**

| Param | Description |
|-------|-------------|
| `page` | default `1` |
| `limit` | default `10`, max `100` |
| `search` | case-insensitive match on name, species, location |
| `status` | `healthy` \| `needs_attention` \| `archived` |

**Sort:** `createdAt` descending  

**Status:** `200`, `401`, `422`  

**Sample `data`:**

```json
{
  "items": [],
  "page": 1,
  "limit": 10,
  "total": 0,
  "totalPages": 1
}
```

---

#### `POST /api/plants`

**Auth:** Required  

**Body:**

| Field | Type |
|-------|------|
| `name` | string, required |
| `species` | string, optional |
| `location` | string, optional |
| `imageUrl` | URL string, optional |
| `notes` | string, optional |
| `status` | enum, optional (default `healthy`) |

**Status:** `201`, `401`, `422`  

---

#### `GET /api/plants/[id]`

**Auth:** Required  

**Status:** `200`, `401`, `404`  

---

#### `PATCH /api/plants/[id]`

**Auth:** Required  

**Body:** partial plant fields (same as create)  

**Status:** `200`, `400` empty body, `401`, `404`, `422`  

---

#### `DELETE /api/plants/[id]`

**Auth:** Required  

**Behavior:** Hard delete plant and **cascade**: tasks (by plant or linked care plans), care plans, activity logs for that plant. Scoped by user.  

**Status:** `200`, `401`, `404`  

**Sample `data`:** `{ "deleted": true }`

---

### Care plans

#### `GET /api/care-plans`

**Auth:** Required  

**Query:**

| Param | Description |
|-------|-------------|
| `plantId` | Mongo ObjectId |
| `type` | `watering` \| `fertilizing` \| `pruning` |
| `isActive` | `true` or `false` |

**Sort:** `nextDueAt` ascending  

**Status:** `200`, `401`, `422`  

---

#### `POST /api/care-plans`

**Auth:** Required  

**Body:**

| Field | Type |
|-------|------|
| `plantId` | ObjectId, must belong to user |
| `type` | enum |
| `frequencyDays` | integer ≥ 1 |
| `startDate` | ISO date |
| `lastCompletedAt` | optional, nullable |
| `nextDueAt` | optional; if omitted, derived from `startDate` + user timezone (start of local day) |
| `isActive` | optional boolean, default `true` |

**Side effects:** If active and `nextDueAt` is on or before end of the user’s local “today”, creates a **pending** task (duplicate-safe).  

**Status:** `201`, `401`, `404` plant, `409` duplicate active type/plant, `422`  

---

#### `PATCH /api/care-plans/[id]`

**Auth:** Required  

**Body (strict JSON):** optional `frequencyDays`, `startDate`, `lastCompletedAt`, `nextDueAt`, `isActive`  

**Status:** `200`, `400` no fields, `401`, `404`, `409`, `422`  

---

#### `DELETE /api/care-plans/[id]`

**Auth:** Required  

**Behavior:** Hard delete care plan and all **tasks** for that plan (user-scoped).  

**Status:** `200`, `401`, `404`  

---

### Tasks

#### `GET /api/tasks`

**Auth:** Required  

**Query:**

| Param | Description |
|-------|-------------|
| `page`, `limit` | pagination |
| `status` | `pending` \| `done` \| `snoozed` \| `skipped` |
| `type` | care type enum |
| `plantId` | ObjectId |
| `from`, `to` | ISO dates filtering `dueAt` (inclusive range) |

**Sort:** `dueAt` ascending  

**Status:** `200`, `400` if `from` > `to`, `401`, `422`  

---

#### `GET /api/tasks/due-today`

**Auth:** Required  

**Timezone:** Uses authenticated user’s `timezone` (IANA).  

**Returns:**

- `dueToday`: pending tasks whose `dueAt` falls in the user’s local calendar day (UTC window in `data.window`).
- `overdue`: pending tasks with `dueAt` before start of that local day (capped at 100).

**Status:** `200`, `401`  

---

#### `PATCH /api/tasks/[id]/complete`

**Auth:** Required  

**Body (optional):** `{ "notes"?: string }`  

**Behavior:** Marks task `done`, logs activity (`watered` / `fertilized` / `pruned` by task type), advances active care plan `lastCompletedAt` / `nextDueAt`, creates next pending task when applicable (transactional).  

**Allowed from:** `pending` or `snoozed`  

**Status:** `200`, `400`, `401`, `404`, `422`, `500`  

---

#### `PATCH /api/tasks/[id]/snooze`

**Auth:** Required  

**Body:** exactly one of:

- `snoozedUntil`: ISO date  
- `snoozeDays`: integer 1–365 (resolved to start of that local day in user timezone)

**Behavior:** `status` → `snoozed`, activity `task_snoozed`  

**Status:** `200`, `400`, `401`, `404`, `422`  

---

#### `PATCH /api/tasks/[id]/skip`

**Auth:** Required  

**Body (optional):** `{ "notes"?: string }`  

**Behavior:** `status` → `skipped`, activity `task_skipped`  

**Status:** `200`, `400`, `401`, `404`, `422`  

---

### Activities

#### `GET /api/activities`

**Auth:** Required  

**Query:** `page`, `limit`, optional `plantId`, `action`  

**Sort:** `date` descending  

**Status:** `200`, `401`, `422`  

---

#### `POST /api/activities`

**Auth:** Required  

**Body:**

| Field | Type |
|-------|------|
| `plantId` | ObjectId, user’s plant |
| `taskId` | optional ObjectId, must belong to user if set |
| `action` | `watered` \| `fertilized` \| `pruned` \| `note_added` \| `task_skipped` \| `task_snoozed` |
| `date` | optional, default now |
| `notes` | optional |

**Status:** `201`, `401`, `404`, `422`  

---

### Dashboard

#### `GET /api/dashboard/summary`

**Auth:** Required  

**Returns `data`:**

| Field | Meaning |
|-------|---------|
| `timezone` | User IANA timezone used for calculations |
| `totalPlants` | count |
| `healthyPlants` | `status === healthy` |
| `needsAttentionPlants` | `status === needs_attention` |
| `tasksDueToday` | pending, `dueAt` in local today window |
| `overdueTasks` | pending, `dueAt` before local today start |
| `completedThisWeek` | `done` tasks with `completedAt` in local week (Mon–Sun) |
| `recentActivities` | last 10 activity logs, newest first |

**Status:** `200`, `401`  

---

## Status codes used

| Code | Usage |
|------|--------|
| 200 | OK |
| 201 | Created |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden (reserved; ownership returns 404 where applicable) |
| 404 | Not found |
| 409 | Conflict |
| 422 | Validation error |
| 500 | Server error |

---

## Notes for front-end clients

- Prefer **credentials: "include"** on `fetch` for cookie auth.
- On `401` from protected routes, call `POST /api/auth/refresh` then retry once.
- Never store tokens in `localStorage` (this API is designed for httpOnly cookies only).
