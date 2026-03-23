CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event', 'task', 'reminder', 'meal')),
  recurrence_rule TEXT,
  recurrence_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_events_household_range ON calendar_events (household_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_name TEXT NOT NULL,
  recipe_url TEXT,
  servings INT NOT NULL DEFAULT 1,
  prep_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_plans_household_date ON meal_plans (household_id, date);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  quantity DOUBLE PRECISION,
  unit TEXT
);

CREATE INDEX idx_meal_plan_items_meal ON meal_plan_items (meal_plan_id);
