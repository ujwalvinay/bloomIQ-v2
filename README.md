<div align="center">

# BloomIQ

**Smart plant care for people who want thriving plants, not guesswork.**

A full-stack web application for tracking plants, care plans, and tasks—with a calendar-first workflow, insights, and secure multi-user accounts.

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

[Features](#-features) · [Architecture](#-architecture) · [Quick start](#-quick-start) · [Configuration](#-configuration)

</div>

---

## Why BloomIQ?

BloomIQ helps you **organize care** across many plants: scheduled tasks, due dates in your timezone, activity history, and a dashboard that surfaces what matters today. Built as a **separate API backend and customer-facing app**, it is easy to deploy, scale, and extend.

---

## Features

| Area | What you get |
|------|----------------|
| **Plants** | Add plants, photos, per-plant overview, gallery, care log, and history |
| **Care & tasks** | Care plans, generated tasks, “due today,” and calendar views |
| **Insights** | Trends and summaries to understand how your collection is doing |
| **Account** | Sign up, sign in, profile settings, forgot / reset password (email-ready in production) |
| **Security** | JWT-based auth, password hashing, refresh-friendly API design |

---

## Architecture

```text
BloomIQ/
├── backend/          # Next.js API routes + MongoDB (default: http://localhost:3000)
├── frontend/         # Next.js App Router UI (default: http://localhost:3001)
└── README.md
```

The **frontend** proxies `/api/*` to the **backend** via `next.config` rewrites, so the browser talks to one origin in development while the services stay decoupled.

---

## Prerequisites

- **Node.js** 20.x (LTS recommended)
- **npm** (ships with Node)
- **MongoDB** instance and connection string ([MongoDB Atlas](https://www.mongodb.com/cloud/atlas) works well)

---

## Quick start

### 1. Clone and install

```bash
git clone <your-repo-url> BloomIQ
cd BloomIQ
```

Install dependencies in **both** apps:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure environment

**Backend** — copy the example file and fill in values:

```bash
cd backend
cp .env.example .env
```

Required for a working API:

- `MONGODB_URI` — MongoDB connection string  
- `JWT_ACCESS_SECRET` — strong secret for access tokens  
- `JWT_REFRESH_SECRET` — strong secret for refresh tokens (use a different value than access)  

Optional / production:

- `APP_ORIGIN` — frontend origin (e.g. `http://localhost:3001`) for password reset links  
- `RESEND_API_KEY` & `MAIL_FROM` — [Resend](https://resend.com) for transactional email in production  

**Frontend** — optional override for where `/api` is proxied:

```bash
cd frontend
cp .env.example .env.local
```

Default `API_PROXY_TARGET` is `http://localhost:3000` (the backend).

### 3. Seed demo data (optional)

From `backend/`:

```bash
npm run seed
```

Creates a demo user (`demo@bloomiq.app` / `password123` per script defaults) and sample plants when not already present.

### 4. Run locally

**Terminal A — API**

```bash
cd backend
npm run dev
```

**Terminal B — Web app**

```bash
cd frontend
npm run dev
```

Open **[http://localhost:3001](http://localhost:3001)**. The UI expects the backend on port **3000** unless you change `API_PROXY_TARGET`.

---

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run dev` | API + Next server (dev) |
| `backend/` | `npm run build` / `npm start` | Production build & start |
| `backend/` | `npm run seed` | Idempotent demo data |
| `backend/` | `npm run lint` | Lint |
| `frontend/` | `npm run dev` | Customer app (port **3001**) |
| `frontend/` | `npm run build` / `npm start` | Production build & start |
| `frontend/` | `npm run lint` | Lint |

---

## Configuration reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Database connection string |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access JWTs |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh tokens |
| `NODE_ENV` | Optional | `development` / `production` |
| `APP_ORIGIN` | Recommended for resets | Frontend base URL |
| `RESEND_API_KEY` | Production email | Resend API key |
| `MAIL_FROM` | With Resend | Verified sender address |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PROXY_TARGET` | `http://localhost:3000` | Backend base URL for `/api` rewrites |

---

## Tech stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide icons  
- **Backend:** Next.js 14 API routes, Mongoose, Zod, bcrypt, JWT, date-fns / time zones  

---

## Contributing

Issues and pull requests are welcome. Please keep changes focused and match existing patterns in each package.

---

<div align="center">

**BloomIQ** — calmer plant care, one task at a time.

</div>
