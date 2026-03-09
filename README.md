# Household Dashboard MVP

This repository now contains a spec-aligned MVP scaffold for the household dashboard:

- `backend/`: Rust + Axum API with JWT auth, 2FA enrollment/challenge routes, household membership, tasks, shopping lists, dashboard aggregation, WebSocket fan-out, and PostgreSQL migrations.
- `frontend/`: React + Vite + TypeScript client with Zustand stores, authenticated flows, household setup, dashboard, tasks, shopping, finance, and WebSocket event ingestion.

The previous root-level prototype is intentionally left untouched for reference, but the new implementation lives in the dedicated `backend/` and `frontend/` workspaces.

## Run locally

Prerequisites:

- Rust 1.93+
- Node.js 24+
- PostgreSQL
- Redis

1. Copy `.env.example` into your shell environment or an env loader of your choice.
2. Apply `backend/migrations/0001_mvp.sql` to your PostgreSQL database.
3. Start the backend:
   `cargo run --manifest-path backend/Cargo.toml`
4. Start the frontend:
   `npm install --prefix frontend`
   `npm run dev:frontend`

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

## Finance Slice In Progress

- Household-level finance access settings with configurable member access
- Bills, bill payments, budget categories, expenses, subscriptions, and finance summary routes
- Finance dashboard visibility gated by role and finance settings
- Initial finance page with summary, bill creation, category creation, and subscription audit
