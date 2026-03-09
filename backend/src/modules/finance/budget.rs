use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    routing::{get, patch},
    Json, Router,
};
use chrono::{Datelike, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::middleware::CurrentUser, error::ApiError, AppState};

use super::{
    access::{require_finance_read, require_finance_write},
    models::{BudgetCategoryRecord, BudgetProgressRow, ExpenseRecord},
};

#[derive(Debug, Deserialize)]
struct CreateBudgetCategoryRequest {
    name: String,
    monthly_limit: Decimal,
    color: Option<String>,
    rollover: Option<bool>,
    rollover_cap: Option<Decimal>,
    parent_id: Option<Uuid>,
    sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct UpdateBudgetCategoryRequest {
    name: Option<String>,
    monthly_limit: Option<Decimal>,
    color: Option<String>,
    rollover: Option<bool>,
    rollover_cap: Option<Decimal>,
    parent_id: Option<Uuid>,
    sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct CreateExpenseRequest {
    category_id: Option<Uuid>,
    amount: Decimal,
    currency: Option<String>,
    description: Option<String>,
    spent_at: NaiveDate,
    paid_by: Option<Uuid>,
    receipt_doc_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct UpdateExpenseRequest {
    category_id: Option<Uuid>,
    amount: Option<Decimal>,
    currency: Option<String>,
    description: Option<String>,
    spent_at: Option<NaiveDate>,
    paid_by: Option<Uuid>,
    receipt_doc_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct MonthParams {
    year: Option<i32>,
    month: Option<u32>,
}

#[derive(Debug, Serialize)]
struct BudgetCategoriesResponse {
    categories: Vec<BudgetCategoryRecord>,
}

#[derive(Debug, Serialize)]
struct BudgetCategoryResponse {
    category: BudgetCategoryRecord,
}

#[derive(Debug, Serialize)]
struct ExpensesResponse {
    expenses: Vec<ExpenseRecord>,
}

#[derive(Debug, Serialize)]
struct ExpenseResponse {
    expense: ExpenseRecord,
}

#[derive(Debug, Serialize)]
struct BudgetMonthResponse {
    year: i32,
    month: u32,
    categories: Vec<BudgetProgressRow>,
    total_budget: Decimal,
    total_spent: Decimal,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/finance/budget/categories",
            get(list_budget_categories).post(create_budget_category),
        )
        .route(
            "/{household_id}/finance/budget/categories/{category_id}",
            patch(update_budget_category).delete(delete_budget_category),
        )
        .route("/{household_id}/finance/budget/{year}/{month}", get(get_budget_month))
        .route(
            "/{household_id}/finance/expenses",
            get(list_expenses).post(create_expense),
        )
        .route(
            "/{household_id}/finance/expenses/{expense_id}",
            patch(update_expense).delete(delete_expense),
        )
}

async fn list_budget_categories(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<BudgetCategoriesResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let categories = sqlx::query_as::<_, BudgetCategoryRecord>(
        r#"
        SELECT id, household_id, name, monthly_limit, color, rollover, rollover_cap, parent_id, sort_order, created_at, updated_at
        FROM budget_categories
        WHERE household_id = $1
        ORDER BY sort_order ASC, name ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(BudgetCategoriesResponse { categories }))
}

async fn create_budget_category(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateBudgetCategoryRequest>,
) -> Result<Json<BudgetCategoryResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;
    if request.name.trim().is_empty() {
        return Err(ApiError::bad_request("Budget category name must not be empty"));
    }

    let category = sqlx::query_as::<_, BudgetCategoryRecord>(
        r#"
        INSERT INTO budget_categories (
            id, household_id, name, monthly_limit, color, rollover, rollover_cap, parent_id, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), $7, $8, COALESCE($9, 0))
        RETURNING id, household_id, name, monthly_limit, color, rollover, rollover_cap, parent_id, sort_order, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(household_id)
    .bind(request.name.trim())
    .bind(request.monthly_limit)
    .bind(request.color)
    .bind(request.rollover)
    .bind(request.rollover_cap)
    .bind(request.parent_id)
    .bind(request.sort_order)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(BudgetCategoryResponse { category }))
}

async fn update_budget_category(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, category_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateBudgetCategoryRequest>,
) -> Result<Json<BudgetCategoryResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let category = sqlx::query_as::<_, BudgetCategoryRecord>(
        r#"
        UPDATE budget_categories
        SET name = COALESCE($3, name),
            monthly_limit = COALESCE($4, monthly_limit),
            color = COALESCE($5, color),
            rollover = COALESCE($6, rollover),
            rollover_cap = COALESCE($7, rollover_cap),
            parent_id = COALESCE($8, parent_id),
            sort_order = COALESCE($9, sort_order),
            updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, name, monthly_limit, color, rollover, rollover_cap, parent_id, sort_order, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(category_id)
    .bind(request.name.map(|value| value.trim().to_owned()))
    .bind(request.monthly_limit)
    .bind(request.color)
    .bind(request.rollover)
    .bind(request.rollover_cap)
    .bind(request.parent_id)
    .bind(request.sort_order)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Budget category not found"))?;

    Ok(Json(BudgetCategoryResponse { category }))
}

async fn delete_budget_category(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, category_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM budget_categories WHERE household_id = $1 AND id = $2")
        .bind(household_id)
        .bind(category_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Budget category not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn get_budget_month(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, year, month)): Path<(Uuid, i32, u32)>,
) -> Result<Json<BudgetMonthResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;
    let (month_start, month_end) = month_bounds(year, month)?;

    let categories = sqlx::query_as::<_, BudgetProgressRow>(
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

    let total_budget = categories.iter().fold(Decimal::ZERO, |sum, item| sum + item.monthly_limit);
    let total_spent = categories
        .iter()
        .fold(Decimal::ZERO, |sum, item| sum + item.spent.unwrap_or(Decimal::ZERO));

    Ok(Json(BudgetMonthResponse {
        year,
        month,
        categories,
        total_budget,
        total_spent,
    }))
}

async fn list_expenses(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Query(query): Query<MonthParams>,
) -> Result<Json<ExpensesResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let today = Utc::now().date_naive();
    let year = query.year.unwrap_or(today.year());
    let month = query.month.unwrap_or(today.month());
    let (month_start, month_end) = month_bounds(year, month)?;

    let expenses = sqlx::query_as::<_, ExpenseRecord>(
        r#"
        SELECT id, household_id, category_id, amount, currency, description, spent_at, paid_by, bill_payment_id,
               receipt_doc_id, created_at, updated_at
        FROM expenses
        WHERE household_id = $1
          AND spent_at >= $2
          AND spent_at < $3
        ORDER BY spent_at DESC, created_at DESC
        "#,
    )
    .bind(household_id)
    .bind(month_start)
    .bind(month_end)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ExpensesResponse { expenses }))
}

async fn create_expense(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateExpenseRequest>,
) -> Result<Json<ExpenseResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let expense = sqlx::query_as::<_, ExpenseRecord>(
        r#"
        INSERT INTO expenses (
            id, household_id, category_id, amount, currency, description, spent_at, paid_by, receipt_doc_id
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, 'USD'), $6, $7, $8, $9)
        RETURNING id, household_id, category_id, amount, currency, description, spent_at, paid_by, bill_payment_id,
                  receipt_doc_id, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(household_id)
    .bind(request.category_id)
    .bind(request.amount)
    .bind(request.currency)
    .bind(request.description)
    .bind(request.spent_at)
    .bind(request.paid_by.or(Some(current_user.user_id)))
    .bind(request.receipt_doc_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ExpenseResponse { expense }))
}

async fn update_expense(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, expense_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateExpenseRequest>,
) -> Result<Json<ExpenseResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let expense = sqlx::query_as::<_, ExpenseRecord>(
        r#"
        UPDATE expenses
        SET category_id = COALESCE($3, category_id),
            amount = COALESCE($4, amount),
            currency = COALESCE($5, currency),
            description = COALESCE($6, description),
            spent_at = COALESCE($7, spent_at),
            paid_by = COALESCE($8, paid_by),
            receipt_doc_id = COALESCE($9, receipt_doc_id),
            updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, category_id, amount, currency, description, spent_at, paid_by, bill_payment_id,
                  receipt_doc_id, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(expense_id)
    .bind(request.category_id)
    .bind(request.amount)
    .bind(request.currency)
    .bind(request.description)
    .bind(request.spent_at)
    .bind(request.paid_by)
    .bind(request.receipt_doc_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Expense not found"))?;

    Ok(Json(ExpenseResponse { expense }))
}

async fn delete_expense(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, expense_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM expenses WHERE household_id = $1 AND id = $2")
        .bind(household_id)
        .bind(expense_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Expense not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
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
