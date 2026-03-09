export type HouseholdRole = "admin" | "member" | "child" | "guest";

export type AuthenticatedUser = {
  id: string;
  email: string;
  display_name: string;
  household_id: string | null;
  role: HouseholdRole | null;
  totp_enabled: boolean;
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

export type WsEnvelope = {
  type: string;
  module: "tasks" | "shopping" | "notifications";
  household_id: string;
  actor_user_id: string;
  payload: unknown;
  timestamp: string;
};
