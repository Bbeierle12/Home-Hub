# Household Dashboard MVP

This repository now contains a spec-aligned MVP scaffold for the household dashboard:

- `backend/`: Rust + Axum API with JWT auth, 2FA enrollment/challenge routes, household membership, tasks, shopping lists, dashboard aggregation, WebSocket fan-out, and database migrations.
- `frontend/`: React + Vite + TypeScript client with Zustand stores, authenticated flows, household setup, dashboard, tasks, shopping, finance, and WebSocket event ingestion.

The previous root-level prototype is intentionally left untouched for reference, but the new implementation lives in the dedicated `backend/` and `frontend/` workspaces.

## Database Backends

Home-Hub supports two database backends, selected via the `DB_BACKEND` environment variable:

| Feature | `postgres` (default) | `rustdb` |
|---|---|---|
| Auth (register, login, 2FA) | Full | Full |
| Households (create, invite, join, members) | Full | Full |
| Tasks (CRUD, complete, assign) | Full | Full |
| Shopping (lists, items, history) | Full | Full |
| Dashboard | Full | Full (bills section excluded) |
| Finance (bills, budget, subscriptions) | Full | Unavailable (501) |
| Notifications | Scaffolded | Scaffolded |
| WebSocket events | Full | Full |
| Redis | Required | Required |

## Run locally — PostgreSQL mode

Prerequisites: Rust 1.93+, Node.js 24+, PostgreSQL, Redis

1. Copy `.env.example` into your shell environment or an env loader of your choice.
2. Apply migrations to your PostgreSQL database:
   ```
   psql -f backend/migrations/0001_mvp.sql $DATABASE_URL
   psql -f backend/migrations/0002_finance.sql $DATABASE_URL
   psql -f backend/migrations/0003_superadmin.sql $DATABASE_URL
   ```
3. Start the backend:
   `cargo run --manifest-path backend/Cargo.toml`
4. Start the frontend:
   `npm install --prefix frontend`
   `npm run dev:frontend`

## Run locally — Rust-DB mode

Prerequisites: Rust 1.93+, Node.js 24+, [Rust-DB](../Rust%20DB/Rust-DB) (with `--features server`), Redis

1. Start Rust-DB:
   ```
   cargo run --features server --bin rust-db-server \
     --manifest-path "../Rust DB/Rust-DB/Cargo.toml" \
     -- --data-dir ./rustdb-data --port 5433
   ```
2. Apply the Rust-DB bootstrap schema:
   ```
   psql -h 127.0.0.1 -p 5433 -f backend/migrations/rustdb_bootstrap.sql
   ```
3. Set environment variables:
   ```
   export DB_BACKEND=rustdb
   export DATABASE_URL=postgresql://localhost:5433/household_dashboard
   export REDIS_URL=redis://localhost:6379
   export JWT_SECRET=replace-with-a-long-random-secret
   ```
4. Start the backend:
   `cargo run --manifest-path backend/Cargo.toml`
5. Start the frontend:
   `npm install --prefix frontend`
   `npm run dev:frontend`

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_BACKEND` | No | `postgres` | `postgres` or `rustdb` |
| `DATABASE_URL` | Yes | — | Connection string (same format for both backends) |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Secret for JWT signing |
| `APP_HOST` | No | `0.0.0.0` | Bind address |
| `APP_PORT` | No | `8080` | Bind port |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS origin |
| `JWT_ACCESS_EXPIRY_SECONDS` | No | `900` | Access token TTL |
| `JWT_REFRESH_EXPIRY_SECONDS` | No | `604800` | Refresh token TTL |
| `TOTP_ISSUER` | No | `HouseholdDashboard` | TOTP provisioning issuer name |
| `DEVICE_TRUST_TTL_SECONDS` | No | `2592000` | Trusted-device TTL |
| `SUPERADMIN_EMAIL` | No | — | Bootstrap a superadmin account on startup |
| `SUPERADMIN_PASSWORD` | No | — | Password for the superadmin account (min 12 chars) |

## Validation

- Backend compile check:
  `cargo check --manifest-path backend/Cargo.toml`
- Frontend type/build check:
  `npm run build --prefix frontend`
- Combined check:
  `npm run check`

## MVP Scope Implemented

- Auth scaffold with register, login, refresh, logout, TOTP setup/verify/challenge, and backup-code recovery routes
- Household creation, invite token join, and member listing
- Task CRUD/complete/assign endpoints with WebSocket event publish
- Shopping list and item flows with WebSocket event publish
- Aggregated dashboard endpoint for tasks and shopping summaries
- React client flows for auth, household bootstrap, dashboard, tasks, and shopping

## Finance (PostgreSQL only)

- Household-level finance access settings with configurable member access
- Bills, bill payments, budget categories, expenses, subscriptions, and finance summary routes
- Finance dashboard visibility gated by role and finance settings
- Initial finance page with summary, bill creation, category creation, and subscription audit

In `rustdb` mode, all finance endpoints return `501 Not Implemented` with a clear message. The frontend finance page will show an error but other pages are unaffected.

## Temporary Limitations in Rust-DB Mode

- **Finance features**: Fully disabled — bills, budget, expenses, subscriptions, and summary routes all return 501.
- **Dashboard bills section**: Returns `null` for `bills_due_soon` since the bills table does not exist.
- **Foreign key enforcement**: Rust-DB does not enforce REFERENCES constraints. Referential integrity depends on application logic.
- **CHECK constraints**: Enum validation (role, priority, frequency) is not enforced at the DB level; the application is expected to pass valid values.
- **Type precision**: TIMESTAMPTZ is stored as TIMESTAMP (no timezone offset). The application always uses UTC, so this is functionally equivalent.
