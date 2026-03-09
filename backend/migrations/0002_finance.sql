CREATE TABLE IF NOT EXISTS household_finance_settings (
  household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  member_access TEXT NOT NULL DEFAULT 'none' CHECK (member_access IN ('none', 'read_only', 'full')),
  income_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sensitive_reauth_ttl_minutes INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  payee TEXT,
  amount NUMERIC(10,2),
  is_variable BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL CHECK (frequency IN ('one-time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annual', 'annual')),
  due_day INT,
  next_due_at DATE,
  auto_pay BOOLEAN NOT NULL DEFAULT FALSE,
  account_label TEXT,
  account_masked TEXT,
  category TEXT,
  payee_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_at DATE NOT NULL,
  paid_by UUID REFERENCES users(id),
  method TEXT,
  confirmation TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL DEFAULT 0,
  color TEXT,
  rollover BOOLEAN NOT NULL DEFAULT FALSE,
  rollover_cap NUMERIC(10,2),
  parent_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  spent_at DATE NOT NULL,
  paid_by UUID REFERENCES users(id),
  bill_payment_id UUID REFERENCES bill_payments(id) ON DELETE SET NULL,
  receipt_doc_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  renewal_date DATE,
  payment_method TEXT,
  cancel_url TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_users (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, user_id)
);

CREATE TABLE IF NOT EXISTS income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  income_type TEXT NOT NULL,
  amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL,
  next_expected DATE,
  is_variable BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  received_at DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (base_currency, target_currency)
);
