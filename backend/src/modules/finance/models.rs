use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemberFinanceAccess {
    None,
    ReadOnly,
    Full,
}

impl MemberFinanceAccess {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::ReadOnly => "read_only",
            Self::Full => "full",
        }
    }
}

impl TryFrom<&str> for MemberFinanceAccess {
    type Error = &'static str;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "none" => Ok(Self::None),
            "read_only" => Ok(Self::ReadOnly),
            "full" => Ok(Self::Full),
            _ => Err("unsupported member finance access mode"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FinanceSettingsRecord {
    pub household_id: Uuid,
    pub member_access: String,
    pub income_enabled: bool,
    pub sensitive_reauth_ttl_minutes: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BillRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub name: String,
    pub payee: Option<String>,
    pub amount: Option<Decimal>,
    pub is_variable: bool,
    pub estimated_amount: Option<Decimal>,
    pub currency: String,
    pub frequency: String,
    pub due_day: Option<i32>,
    pub next_due_at: Option<NaiveDate>,
    pub auto_pay: bool,
    pub account_label: Option<String>,
    pub account_masked: Option<String>,
    pub category: Option<String>,
    pub payee_url: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BillPaymentRecord {
    pub id: Uuid,
    pub bill_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub paid_at: NaiveDate,
    pub paid_by: Option<Uuid>,
    pub method: Option<String>,
    pub confirmation: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BudgetCategoryRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub name: String,
    pub monthly_limit: Decimal,
    pub color: Option<String>,
    pub rollover: bool,
    pub rollover_cap: Option<Decimal>,
    pub parent_id: Option<Uuid>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExpenseRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub category_id: Option<Uuid>,
    pub amount: Decimal,
    pub currency: String,
    pub description: Option<String>,
    pub spent_at: NaiveDate,
    pub paid_by: Option<Uuid>,
    pub bill_payment_id: Option<Uuid>,
    pub receipt_doc_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SubscriptionRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub name: String,
    pub amount: Decimal,
    pub currency: String,
    pub billing_cycle: String,
    pub renewal_date: Option<NaiveDate>,
    pub payment_method: Option<String>,
    pub cancel_url: Option<String>,
    pub category: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BudgetProgressRow {
    pub id: Uuid,
    pub name: String,
    pub monthly_limit: Decimal,
    pub spent: Option<Decimal>,
    pub color: Option<String>,
    pub rollover: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionAuditSummary {
    pub active_count: usize,
    pub monthly_equivalent_total: Decimal,
    pub annual_projection: Decimal,
}
