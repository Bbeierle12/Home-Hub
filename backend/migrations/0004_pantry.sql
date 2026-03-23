CREATE TABLE IF NOT EXISTS pantry_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, name)
);

CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES pantry_categories(id) ON DELETE SET NULL,
  added_by UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit TEXT,
  expires_at TIMESTAMPTZ,
  low_threshold DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_household ON pantry_items (household_id);
CREATE INDEX idx_pantry_items_category ON pantry_items (category_id);
CREATE INDEX idx_pantry_items_expires ON pantry_items (expires_at) WHERE expires_at IS NOT NULL;
