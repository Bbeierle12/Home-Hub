-- Rust-DB compatible schema for Home-Hub core tables.
--
-- Differences from the PostgreSQL migrations:
--   * No CREATE EXTENSION, DEFAULT, REFERENCES, CHECK, or UNIQUE-in-table.
--   * All UUIDs / timestamps are supplied by the application (backend/src/compat.rs).
--   * UNIQUE constraints are expressed as CREATE UNIQUE INDEX.
--   * Finance tables are NOT included — finance features require postgres mode.
--
-- Primary keys:
--   Rust-DB implicitly treats the first column of each table as the primary
--   key and enforces uniqueness on it.  Every table below places `id` (or
--   the composite PK columns) first, matching this convention.  Explicit
--   PRIMARY KEY syntax is not used because Rust-DB's DDL parser does not
--   accept it; the constraint is still enforced by the engine.
--
-- Apply once against a fresh Rust-DB instance:
--   psql -h 127.0.0.1 -p 5433 -f backend/migrations/rustdb_bootstrap.sql

CREATE TABLE users (
  id          UUID    NOT NULL,
  email       TEXT    NOT NULL,
  password_hash TEXT  NOT NULL,
  display_name TEXT   NOT NULL,
  avatar_url  TEXT,
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL,
  is_superadmin BOOLEAN NOT NULL,
  created_at  TIMESTAMP NOT NULL,
  updated_at  TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE totp_backup_codes (
  id        UUID NOT NULL,
  user_id   UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at   TIMESTAMP
);
CREATE INDEX idx_totp_backup_codes_user ON totp_backup_codes (user_id);

CREATE TABLE households (
  id         UUID NOT NULL,
  name       TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE household_members (
  id           UUID NOT NULL,
  household_id UUID NOT NULL,
  user_id      UUID NOT NULL,
  role         TEXT NOT NULL,
  joined_at    TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_hm_household_user ON household_members (household_id, user_id);

CREATE TABLE household_invites (
  id           UUID NOT NULL,
  household_id UUID NOT NULL,
  invited_by   UUID NOT NULL,
  token        TEXT NOT NULL,
  role         TEXT NOT NULL,
  email        TEXT,
  expires_at   TIMESTAMP NOT NULL,
  accepted_at  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_hi_token ON household_invites (token);

CREATE TABLE tasks (
  id                   UUID NOT NULL,
  household_id         UUID NOT NULL,
  created_by           UUID NOT NULL,
  assigned_to          UUID,
  title                TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  priority             TEXT NOT NULL,
  due_at               TIMESTAMP,
  completed_at         TIMESTAMP,
  points               INT  NOT NULL,
  recurrence_rule      TEXT,
  recurrence_parent_id UUID,
  created_at           TIMESTAMP NOT NULL,
  updated_at           TIMESTAMP NOT NULL
);

CREATE TABLE task_completion_log (
  id             UUID      NOT NULL,
  task_id        UUID      NOT NULL,
  completed_by   UUID      NOT NULL,
  completed_at   TIMESTAMP NOT NULL,
  points_awarded INT       NOT NULL
);

CREATE TABLE shopping_lists (
  id           UUID NOT NULL,
  household_id UUID NOT NULL,
  name         TEXT NOT NULL,
  store        TEXT,
  created_by   UUID NOT NULL,
  archived_at  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL
);

CREATE TABLE shopping_items (
  id         UUID    NOT NULL,
  list_id    UUID    NOT NULL,
  added_by   UUID    NOT NULL,
  name       TEXT    NOT NULL,
  quantity   DOUBLE PRECISION,
  unit       TEXT,
  category   TEXT,
  checked    BOOLEAN NOT NULL,
  checked_by UUID,
  checked_at TIMESTAMP,
  sort_order INT     NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE shopping_item_history (
  id             UUID      NOT NULL,
  household_id   UUID      NOT NULL,
  name           TEXT      NOT NULL,
  category       TEXT,
  last_bought_at TIMESTAMP NOT NULL,
  buy_count      INT       NOT NULL
);
CREATE UNIQUE INDEX idx_sih_household_name ON shopping_item_history (household_id, name);

CREATE TABLE pantry_categories (
  id           UUID NOT NULL,
  household_id UUID NOT NULL,
  name         TEXT NOT NULL,
  icon         TEXT,
  sort_order   INT  NOT NULL,
  created_at   TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_pc_household_name ON pantry_categories (household_id, name);

CREATE TABLE pantry_items (
  id            UUID NOT NULL,
  household_id  UUID NOT NULL,
  category_id   UUID,
  added_by      UUID NOT NULL,
  name          TEXT NOT NULL,
  quantity      DOUBLE PRECISION NOT NULL,
  unit          TEXT,
  expires_at    TIMESTAMP,
  low_threshold DOUBLE PRECISION,
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL,
  updated_at    TIMESTAMP NOT NULL
);
CREATE INDEX idx_pantry_items_household ON pantry_items (household_id);
CREATE INDEX idx_pantry_items_category ON pantry_items (category_id);

CREATE TABLE calendar_events (
  id               UUID NOT NULL,
  household_id     UUID NOT NULL,
  created_by       UUID NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  start_at         TIMESTAMP NOT NULL,
  end_at           TIMESTAMP NOT NULL,
  all_day          BOOLEAN NOT NULL,
  color            TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  recurrence_rule  TEXT,
  recurrence_end_at TIMESTAMP,
  created_at       TIMESTAMP NOT NULL,
  updated_at       TIMESTAMP NOT NULL
);
CREATE INDEX idx_cal_events_household_range ON calendar_events (household_id, start_at, end_at);

CREATE TABLE meal_plans (
  id                UUID NOT NULL,
  household_id      UUID NOT NULL,
  calendar_event_id UUID,
  created_by        UUID NOT NULL,
  date              DATE NOT NULL,
  meal_type         TEXT NOT NULL,
  recipe_name       TEXT NOT NULL,
  recipe_url        TEXT,
  servings          INT NOT NULL,
  prep_minutes      INT,
  notes             TEXT,
  created_at        TIMESTAMP NOT NULL,
  updated_at        TIMESTAMP NOT NULL
);
CREATE INDEX idx_meal_plans_household_date ON meal_plans (household_id, date);

CREATE TABLE meal_plan_items (
  id              UUID NOT NULL,
  meal_plan_id    UUID NOT NULL,
  pantry_item_id  UUID,
  ingredient_name TEXT NOT NULL,
  quantity        DOUBLE PRECISION,
  unit            TEXT
);
CREATE INDEX idx_meal_plan_items_meal ON meal_plan_items (meal_plan_id);

CREATE TABLE pantry_item_photos (
  id           UUID NOT NULL,
  item_id      UUID NOT NULL,
  household_id UUID NOT NULL,
  uploaded_by  UUID NOT NULL,
  file_name    TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL
);
CREATE INDEX idx_pantry_photos_item ON pantry_item_photos (item_id);

CREATE TABLE notifications (
  id           UUID NOT NULL,
  user_id      UUID NOT NULL,
  household_id UUID NOT NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,
  read_at      TIMESTAMP,
  created_at   TIMESTAMP NOT NULL
);
