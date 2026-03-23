export type HouseholdRole = "admin" | "member" | "child" | "guest";
export type MemberFinanceAccess = "none" | "read_only" | "full";

export type AuthenticatedUser = {
  id: string;
  email: string;
  display_name: string;
  household_id: string | null;
  role: HouseholdRole | null;
  totp_enabled: boolean;
  is_superadmin: boolean;
};

export type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in_seconds: number;
};

export type AuthResponse = {
  user: AuthenticatedUser;
  tokens: TokenBundle;
};

export type LoginChallengeResponse = {
  status: "2fa_required";
  temp_token: string;
};

export type DashboardResponse = {
  today: string;
  my_tasks: Array<{
    id: string;
    title: string;
    due_at: string | null;
    completed_at: string | null;
  }>;
  shopping_lists: Array<{
    id: string;
    name: string;
    open_items: number;
  }>;
  bills_due_soon?: Array<{
    id: string;
    name: string;
    next_due_at: string | null;
    is_variable: boolean;
  }> | null;
};

export type FinanceSettings = {
  household_id: string;
  member_access: MemberFinanceAccess;
  income_enabled: boolean;
  sensitive_reauth_ttl_minutes: number;
  updated_at: string;
};

export type Bill = {
  id: string;
  household_id: string;
  name: string;
  payee: string | null;
  amount: string | null;
  is_variable: boolean;
  estimated_amount: string | null;
  currency: string;
  frequency: string;
  due_day: number | null;
  next_due_at: string | null;
  auto_pay: boolean;
  account_label: string | null;
  account_masked: string | null;
  category: string | null;
  payee_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BudgetCategory = {
  id: string;
  household_id: string;
  name: string;
  monthly_limit: string;
  color: string | null;
  rollover: boolean;
  rollover_cap: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BudgetProgressRow = {
  id: string;
  name: string;
  monthly_limit: string;
  spent: string | null;
  color: string | null;
  rollover: boolean;
};

export type FinanceSummaryResponse = {
  year: number;
  month: number;
  bills_due_soon: Bill[];
  total_budget: string;
  total_spent: string;
  total_subscriptions_monthly: string;
  budget_progress: BudgetProgressRow[];
};

export type SubscriptionAuditResponse = {
  summary: {
    active_count: number;
    monthly_equivalent_total: string;
    annual_projection: string;
  };
  duplicates_by_category: string[];
  subscriptions_per_user: Record<string, number>;
};

export type Task = {
  id: string;
  household_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: "low" | "medium" | "high";
  due_at: string | null;
  completed_at: string | null;
  points: number;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ShoppingList = {
  id: string;
  household_id: string;
  name: string;
  store: string | null;
  created_by: string;
  archived_at: string | null;
  created_at: string;
};

export type ShoppingItem = {
  id: string;
  list_id: string;
  added_by: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
};

export type PantryCategory = {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
};

export type PantryItem = {
  id: string;
  household_id: string;
  category_id: string | null;
  added_by: string;
  name: string;
  quantity: number;
  unit: string | null;
  expires_at: string | null;
  low_threshold: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  event_type: "event" | "task" | "reminder" | "meal";
  recurrence_rule: string | null;
  recurrence_end_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MealPlan = {
  id: string;
  household_id: string;
  calendar_event_id: string | null;
  created_by: string;
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recipe_name: string;
  recipe_url: string | null;
  servings: number;
  prep_minutes: number | null;
  notes: string | null;
  ingredients: MealPlanItem[];
  created_at: string;
  updated_at: string;
};

export type MealPlanItem = {
  id: string;
  meal_plan_id: string;
  pantry_item_id: string | null;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
};

export type PantryPhoto = {
  id: string;
  item_id: string;
  household_id: string;
  uploaded_by: string;
  file_name: string;
  content_type: string;
  created_at: string;
};

export type WsEnvelope = {
  type: string;
  module: "tasks" | "shopping" | "pantry" | "calendar" | "notifications";
  household_id: string;
  actor_user_id: string;
  payload: unknown;
  timestamp: string;
};
