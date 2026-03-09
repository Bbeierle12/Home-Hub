use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use chrono::{Datelike, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::middleware::CurrentUser, error::ApiError, AppState};

use super::{
    access::require_finance_read,
    models::{BillRecord, BudgetProgressRow},
};

#[derive(Debug, Deserialize)]
struct SummaryQuery {
    year: Option<i32>,
    month: Option<u32>,
}

#[derive(Debug, Serialize)]
struct FinanceSummaryResponse {
    year: i32,
    month: u32,
    bills_due_soon: Vec<BillRecord>,
    total_budget: Decimal,
    total_spent: Decimal,
    total_subscriptions_monthly: Decimal,
    budget_progress: Vec<BudgetProgressRow>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/{household_id}/finance/summary", get(get_finance_summary))
}

async fn get_finance_summary(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Query(query): Query<SummaryQuery>,
) -> Result<Json<FinanceSummaryResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let today = Utc::now().date_naive();
    let year = query.year.unwrap_or(today.year());
    let month = query.month.unwrap_or(today.month());
    let (month_start, month_end) = month_bounds(year, month)?;

    let bills_due_soon = sqlx::query_as::<_, BillRecord>(
        r#"
        SELECT id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
               frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
               payee_url, notes, is_active, created_at, updated_at
        FROM bills
        WHERE household_id = $1
          AND is_active = TRUE
          AND next_due_at IS NOT NULL
          AND next_due_at >= $2
          AND next_due_at <= $3
        ORDER BY next_due_at ASC
        "#,
    )
    .bind(household_id)
    .bind(today)
    .bind(today + chrono::Duration::days(7))
    .fetch_all(&state.db)
    .await?;

    let budget_progress = sqlx::query_as::<_, BudgetProgressRow>(
        r#"
        SELECT bc.id,
               bc.name,
               bc.monthly_limit,
               SUM(e.amount) AS spent,
               bc.color,
               bc.rollover
        FROM budget_categories bc
        LEFT JOIN expenses e
          ON e.category_id = bc.id
         AND e.spent_at >= $2
         AND e.spent_at < $3
        WHERE bc.household_id = $1
        GROUP BY bc.id, bc.name, bc.monthly_limit, bc.color, bc.rollover, bc.sort_order
        ORDER BY bc.sort_order ASC, bc.name ASC
        "#,
    )
    .bind(household_id)
    .bind(month_start)
    .bind(month_end)
    .fetch_all(&state.db)
    .await?;

    let total_budget = budget_progress
        .iter()
        .fold(Decimal::ZERO, |sum, row| sum + row.monthly_limit);
    let total_spent = budget_progress
        .iter()
        .fold(Decimal::ZERO, |sum, row| sum + row.spent.unwrap_or(Decimal::ZERO));

    let subscriptions = sqlx::query_as::<_, (Decimal, String)>(
        r#"
        SELECT amount, billing_cycle
        FROM subscriptions
        WHERE household_id = $1 AND is_active = TRUE
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    let total_subscriptions_monthly = subscriptions.into_iter().fold(
        Decimal::ZERO,
        |sum, (amount, billing_cycle)| {
            if billing_cycle == "annual" {
                sum + (amount / Decimal::from(12))
            } else {
                sum + amount
            }
        },
    );

    Ok(Json(FinanceSummaryResponse {
        year,
        month,
        bills_due_soon,
        total_budget,
        total_spent,
        total_subscriptions_monthly,
        budget_progress,
    }))
}

fn month_bounds(year: i32, month: u32) -> Result<(NaiveDate, NaiveDate), ApiError> {
    if !(1..=12).contains(&month) {
        return Err(ApiError::bad_request("month must be between 1 and 12"));
    }

    let month_start = NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| ApiError::bad_request("Invalid year/month combination"))?;
    let month_end = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .ok_or_else(|| ApiError::bad_request("Invalid month boundary"))?;

    Ok((month_start, month_end))
}
