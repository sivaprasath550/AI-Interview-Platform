# AI Interview Preparation Platform

A full-stack coding-interview practice platform (LeetCode/HackerRank-style) built to demonstrate production-grade backend architecture, security practices, and sandboxed code execution — not just a CRUD app.

Personal project, built solo, with an emphasis on getting the hard parts (auth token security, sandbox isolation, async job processing) right rather than fast.

## Status

This is an actively developed learning/portfolio project. Current state, honestly:

| Module | Status |
|---|---|
| Authentication (signup, login, refresh rotation, logout) | ✅ Done, tested end-to-end |
| Problems (browse, filter, detail view) | ✅ Done, tested end-to-end |
| Frontend (auth pages, problems pages, in-browser editor) | ✅ Done, tested |
| Submissions + sandboxed code execution | ✅ Done, tested end-to-end — `POST /submissions` enqueues a BullMQ job; the worker grades every test case in an isolated Docker container and the frontend polls the result |
| AI layer (feedback, hints, problem generation, mock interviews) | ✅ Done, tested end-to-end — see below |

## 3. High‑level architecture

```
                        Browser  (Next.js :3001)
                          │
             REST + JSON  │  access token in Authorization header (memory only)
             + httpOnly   │  refresh token in httpOnly, SameSite=Strict cookie
             cookie       ▼
                    NestJS API  (:3000)
   ┌───────────────┬───────────────┬────────────────┬─────────────────┐
   │ AuthModule    │ ProblemsModule│ SubmissionsMod.│ InterviewsModule│
   │  users        │  problems     │  submissions   │  interviews     │
   │  refresh_tok. │  test_cases   │  (BullMQ prod.) │  (LLM turns)    │
   └──────┬────────┴───────┬───────┴───────┬────────┴────────┬────────┘
          │                │               │                 │
          ▼                ▼               ▼                 ▼
     PostgreSQL        PostgreSQL      Redis (BullMQ)     Groq API
                         + Groq API        │            (OpenAI-compat)
                       (hints/gen)         ▼
                                      ExecutionProcessor (worker)
                                           │  one container per test case
                                           ▼
                                      Docker Engine
                                     python:3.11-slim
                                     --network none, mem/cpu/pid caps,
                                     read-only rootfs, non-root, 5s timeout
```

Cross‑cutting, applied in `backend/src/main.ts`:

- `cookie-parser` — so `POST /auth/refresh` can read the httpOnly cookie back.
- `enableCors({ origin: 'http://localhost:3001', credentials: true })` — CORS is about *who may read the response*; `credentials: true` is required for the cookie to travel cross‑origin at all.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — this single line enforces every `class-validator` decorator in the app **and** is the mass‑assignment defence (a request can't smuggle in `role: "admin"` — unknown fields 400).

---

### AI features (Groq / OpenAI-compatible)

- **Submission feedback** — `POST /submissions/:id/feedback`: structured code review (correctness, complexity, style, suggestions). Cached on the submission row.
- **Progressive hints** — `POST /problems/:slug/hint` `{ level: 1–3 }`: escalating nudges that never reveal a full solution.
- **Problem generation** — `POST /problems/generate`: the model writes a problem + reference solution + tests; the reference solution is **run in the sandbox** against those tests, and the problem is saved only if it passes.
- **Mock interviews** — `POST /interviews` (`coding` / `behavioral` / `system_design`): a live turn-by-turn interview; `POST /interviews/:id/end` produces a structured evaluation with 1–5 scores and a hire recommendation.
- All AI routes are behind a Redis-backed per-user rate limiter; LLM JSON output is validated against a schema, not trusted.

## Tech Stack

- **Backend:** NestJS, TypeScript, TypeORM, PostgreSQL
- **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS, Zustand, TanStack Query
- **Infra (local dev):** Docker Compose (PostgreSQL + Redis)
- **Queue:** BullMQ (Redis-backed)
- **Code execution:** Docker Engine API (`dockerode`) — isolated, resource-capped containers per submission
- **AI:** Groq (OpenAI-compatible chat completions) via a dependency-free `fetch` wrapper

## Architecture

```
Browser (Next.js :3001)
   │  REST + httpOnly cookie (refresh token)
   ▼
NestJS API (:3000)
   │
   ├── Auth module ── PostgreSQL (users, refresh_tokens)
   ├── Problems module ── PostgreSQL (problems, test_cases)
   └── Submissions module
          │  enqueue job
          ▼
       Redis (BullMQ queue)
          │  picked up by
          ▼
       Execution Worker
          │  spins up a resource-capped, network-disabled
          │  Docker container per test case
          ▼
       Docker Engine
```

## Security highlights

This project's main focus is doing authentication and sandboxing *properly*, not just functionally:

- **Password hashing:** bcrypt (adaptive cost factor + per-password salt) — never a fast general-purpose hash.
- **JWT access + refresh tokens:** short-lived access tokens; refresh tokens are hashed before storage (SHA-256 — appropriate here since refresh tokens are high-entropy, unlike passwords) and are **single-use, rotating** on every refresh.
- **Refresh token reuse detection:** presenting an already-rotated (or revoked) refresh token revokes *every* refresh token for that user, treating reuse as a signal of a stolen token rather than silently failing.
- **HttpOnly + SameSite=Strict cookies** for the refresh token (XSS and CSRF mitigation, respectively); access tokens are kept in memory only, never `localStorage`.
- **Mass-assignment protection:** global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` — a request can't smuggle in fields like `role` that aren't declared on the DTO.
- **Ownership-scoped queries:** resource lookups (e.g. submissions) filter by the authenticated user's ID at the query level, not just an authorization check after the fact.
- **Sandboxed code execution:** every submission runs in an ephemeral Docker container with `--network none`, hard memory/CPU/PID caps, a read-only filesystem, a non-root user, and an application-enforced timeout independent of the sandboxed process's own behavior.

## Getting started

### Prerequisites

- Node.js 20+
- Docker Desktop (with the daemon running)
- npm

### 1. Clone and configure environment variables

```bash
git clone https://github.com/sivaprasath550/AI-Interview-Platform.git
cd AI-Interview-Platform
cp .env.example .env
```

Fill in `.env` with real values (see [Environment variables](#environment-variables) below). Never commit `.env` — it's gitignored.

### 2. Start Postgres + Redis

```bash
docker compose up -d
```

### 3. Run the backend

```bash
cd backend
npm install
npm run seed        # inserts a few starter problems (idempotent)
npm run start:dev
```

Runs on `http://localhost:3000`.

> Grading needs the Docker daemon running — the execution worker pulls
> `python:3.11-slim` on the first submission and runs each test case in
> its own throwaway container.

### 4. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # if present; otherwise set NEXT_PUBLIC_API_URL manually
npm run dev
```

Runs on `http://localhost:3001`.

## Environment variables

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection (Docker Compose maps Postgres to host port `5433` by default, to avoid colliding with a locally installed Postgres on `5432`) |
| `PORT` | Backend port (default `3000`) |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRY` | Access token signing secret + lifetime (e.g. `15m`) |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRY` | Refresh token signing secret + lifetime (e.g. `7d`) — **must differ** from the access secret |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection, for BullMQ |

Generate strong random secrets, e.g.:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API overview

| Method & Path | Auth | Description |
|---|---|---|
| `POST /auth/signup` | No | Create an account |
| `POST /auth/login` | No | Log in; returns access token + sets refresh cookie |
| `POST /auth/refresh` | Refresh cookie | Rotate refresh token, issue new access token |
| `POST /auth/logout` | Refresh cookie | Revoke the current refresh token |
| `GET /problems` | Yes | List problems (paginated, filterable by difficulty) |
| `GET /problems/:slug` | Yes | Problem detail + sample test cases |
| `POST /submissions` | Yes | Submit code for grading (async — returns `202`) |
| `GET /submissions/:id` | Yes | Poll submission status/result (ownership-scoped) |

## Project structure

```
backend/
  src/
    auth/          # signup, login, refresh, logout, JwtAuthGuard
    users/          # User entity
    problems/       # Problem + TestCase entities, listing/detail
    submissions/     # Submission entity, BullMQ worker, Docker sandbox
frontend/
  src/
    app/            # Next.js App Router pages
    components/      # AuthInitializer, QueryProvider
    lib/api/         # Typed fetch wrappers per resource
    store/           # Zustand auth store
docker-compose.yml   # Postgres + Redis for local dev
```

## License

Personal portfolio project — not currently licensed for reuse.
