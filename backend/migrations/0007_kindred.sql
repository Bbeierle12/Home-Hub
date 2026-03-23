-- ══════════════════════════════════════════════════════════════════════════════
-- 0007_kindred.sql — Kindred Canvas / Family Heritage module
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Family Members (distinct from household users) ──────────────────────────

CREATE TABLE IF NOT EXISTS family_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  linked_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  maiden_name     TEXT,
  nickname        TEXT,
  gender          TEXT,
  birth_date      DATE,
  birth_place     TEXT,
  death_date      DATE,
  death_place     TEXT,
  bio             TEXT,
  avatar_file     TEXT,
  is_living       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_household ON family_members (household_id);

-- ── Relationships (edges in family graph) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS family_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_member_id  UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  to_member_id    UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  rel_type        TEXT NOT NULL CHECK (rel_type IN (
                    'parent', 'child', 'spouse', 'sibling', 'partner'
                  )),
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, from_member_id, to_member_id, rel_type)
);

CREATE INDEX idx_family_rels_from ON family_relationships (from_member_id);
CREATE INDEX idx_family_rels_to   ON family_relationships (to_member_id);

-- ── Media Albums ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_media_albums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  cover_media_id  UUID,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_albums_household ON family_media_albums (household_id);

-- ── Media (photos/videos) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  album_id        UUID REFERENCES family_media_albums(id) ON DELETE SET NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  file_name       TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  file_size_bytes BIGINT,
  caption         TEXT,
  taken_at        TIMESTAMPTZ,
  location        TEXT,
  ai_people_tags  TEXT DEFAULT '[]',
  ai_place_tags   TEXT DEFAULT '[]',
  ai_event_tags   TEXT DEFAULT '[]',
  ai_processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_media_household ON family_media (household_id);
CREATE INDEX idx_family_media_album     ON family_media (album_id);

ALTER TABLE family_media_albums
  ADD CONSTRAINT fk_cover_media
  FOREIGN KEY (cover_media_id) REFERENCES family_media(id) ON DELETE SET NULL;

-- ── Media ↔ Family Member tag links ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_media_people (
  media_id        UUID NOT NULL REFERENCES family_media(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, member_id)
);

-- ── Stories ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  body            TEXT,
  cover_media_id  UUID REFERENCES family_media(id) ON DELETE SET NULL,
  date_of_story   DATE,
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  ai_facts        TEXT DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_stories_household ON family_stories (household_id);

CREATE TABLE IF NOT EXISTS family_story_members (
  story_id        UUID NOT NULL REFERENCES family_stories(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, member_id)
);

CREATE TABLE IF NOT EXISTS family_story_media (
  story_id        UUID NOT NULL REFERENCES family_stories(id) ON DELETE CASCADE,
  media_id        UUID NOT NULL REFERENCES family_media(id) ON DELETE CASCADE,
  sort_order      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, media_id)
);

-- ── Family Events / Milestones ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT NOT NULL DEFAULT 'milestone' CHECK (event_type IN (
                    'birth', 'death', 'marriage', 'graduation', 'anniversary',
                    'milestone', 'other'
                  )),
  event_date      DATE,
  location        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_events_household ON family_events (household_id);

CREATE TABLE IF NOT EXISTS family_event_members (
  event_id        UUID NOT NULL REFERENCES family_events(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

-- ── Sources (archival documents) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  source_type     TEXT,
  url             TEXT,
  file_name       TEXT,
  content_type    TEXT,
  citation        TEXT,
  notes           TEXT,
  date_of_source  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_sources_household ON family_sources (household_id);

CREATE TABLE IF NOT EXISTS family_source_members (
  source_id       UUID NOT NULL REFERENCES family_sources(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, member_id)
);
