use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{Datelike, NaiveDate};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::middleware::CurrentUser, error::ApiError, AppState};

use super::{
    access::{require_finance_read, require_finance_write},
    models::{BillPaymentRecord, BillRecord},
};

#[derive(Debug, Deserialize)]
struct CreateBillRequest {
    name: String,
    payee: Option<String>,
    amount: Option<Decimal>,
    is_variable: Option<bool>,
    estimated_amount: Option<Decimal>,
    currency: Option<String>,
    frequency: String,
    due_day: Option<i32>,
    next_due_at: Option<NaiveDate>,
    auto_pay: Option<bool>,
    account_label: Option<String>,
    account_masked: Option<String>,
    category: Option<String>,
    payee_url: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateBillRequest {
    name: Option<String>,
    payee: Option<String>,
    amount: Option<Decimal>,
    is_variable: Option<bool>,
    estimated_amount: Option<Decimal>,
    currency: Option<String>,
    frequency: Option<String>,
    due_day: Option<i32>,
    next_due_at: Option<NaiveDate>,
    auto_pay: Option<bool>,
    account_label: Option<String>,
    account_masked: Option<String>,
    category: Option<String>,
    payee_url: Option<String>,
    notes: Option<String>,
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RecordPaymentRequest {
    amount: Decimal,
    currency: Option<String>,
    paid_at: NaiveDate,
    method: Option<String>,
    confirmation: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize)]
struct BillsResponse {
    bills: Vec<BillRecord>,
}

#[derive(Debug, Serialize)]
struct BillResponse {
    bill: BillRecord,
}

#[derive(Debug, Serialize)]
struct BillPaymentsResponse {
    bill: BillRecord,
    payments: Vec<BillPaymentRecord>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/{household_id}/finance/bills", get(list_bills).post(create_bill))
        .route(
            "/{household_id}/finance/bills/{bill_id}",
            patch(update_bill).delete(delete_bill),
        )
        .route(
            "/{household_id}/finance/bills/{bill_id}/pay",
            post(record_payment),
        )
        .route(
            "/{household_id}/finance/bills/{bill_id}/payments",
            get(list_payments),
        )
}

async fn list_bills(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<BillsResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let bills = sqlx::query_as::<_, BillRecord>(
        r#"
        SELECT id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
               frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
               payee_url, notes, is_active, created_at, updated_at
        FROM bills
        WHERE household_id = $1
        ORDER BY next_due_at ASC NULLS LAST, created_at DESC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(BillsResponse { bills }))
}

async fn create_bill(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateBillRequest>,
) -> Result<Json<BillResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;
    validate_bill_request(&request.name, &request.frequency, request.is_variable.unwrap_or(false), request.amount)?;

    let bill = sqlx::query_as::<_, BillRecord>(
        r#"
        INSERT INTO bills (
            id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
            frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
            payee_url, notes
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), $7, COALESCE($8, 'USD'), $9, $10, $11,
                COALESCE($12, FALSE), $13, $14, $15, $16, $17)
        RETURNING id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
                  frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
                  payee_url, notes, is_active, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(household_id)
    .bind(request.name.trim())
    .bind(request.payee)
    .bind(request.amount)
    .bind(request.is_variable)
    .bind(request.estimated_amount)
    .bind(request.currency)
    .bind(request.frequency)
    .bind(request.due_day)
    .bind(request.next_due_at)
    .bind(request.auto_pay)
    .bind(request.account_label)
    .bind(request.account_masked)
    .bind(request.category)
    .bind(request.payee_url)
    .bind(request.notes)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(BillResponse { bill }))
}

async fn update_bill(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, bill_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateBillRequest>,
) -> Result<Json<BillResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    if let Some(name) = &request.name {
        if name.trim().is_empty() {
            return Err(ApiError::bad_request("Bill name must not be empty"));
        }
    }

    if let (Some(name), Some(frequency)) = (&request.name, &request.frequency) {
        validate_bill_request(name, frequency, request.is_variable.unwrap_or(false), request.amount)?;
    }

    let bill = sqlx::query_as::<_, BillRecord>(
        r#"
        UPDATE bills
        SET name = COALESCE($3, name),
            payee = COALESCE($4, payee),
            amount = COALESCE($5, amount),
            is_variable = COALESCE($6, is_variable),
            estimated_amount = COALESCE($7, estimated_amount),
            currency = COALESCE($8, currency),
            frequency = COALESCE($9, frequency),
            due_day = COALESCE($10, due_day),
            next_due_at = COALESCE($11, next_due_at),
            auto_pay = COALESCE($12, auto_pay),
            account_label = COALESCE($13, account_label),
            account_masked = COALESCE($14, account_masked),
            category = COALESCE($15, category),
            payee_url = COALESCE($16, payee_url),
            notes = COALESCE($17, notes),
            is_active = COALESCE($18, is_active),
            updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
                  frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
                  payee_url, notes, is_active, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(bill_id)
    .bind(request.name.map(|value| value.trim().to_owned()))
    .bind(request.payee)
    .bind(request.amount)
    .bind(request.is_variable)
    .bind(request.estimated_amount)
    .bind(request.currency)
    .bind(request.frequency)
    .bind(request.due_day)
    .bind(request.next_due_at)
    .bind(request.auto_pay)
    .bind(request.account_label)
    .bind(request.account_masked)
    .bind(request.category)
    .bind(request.payee_url)
    .bind(request.notes)
    .bind(request.is_active)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Bill not found"))?;

    Ok(Json(BillResponse { bill }))
}

async fn delete_bill(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, bill_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM bills WHERE household_id = $1 AND id = $2")
        .bind(household_id)
        .bind(bill_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Bill not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn record_payment(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, bill_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<RecordPaymentRequest>,
) -> Result<Json<BillPaymentsResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let bill = sqlx::query_as::<_, BillRecord>(
        r#"
        SELECT id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
               frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
               payee_url, notes, is_active, created_at, updated_at
        FROM bills
        WHERE household_id = $1 AND id = $2
        "#,
    )
    .bind(household_id)
    .bind(bill_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Bill not found"))?;

    let payment = sqlx::query_as::<_, BillPaymentRecord>(
        r#"
        INSERT INTO bill_payments (id, bill_id, amount, currency, paid_at, paid_by, method, confirmation, notes)
        VALUES ($1, $2, $3, COALESCE($4, $5), $6, $7, $8, $9, $10)
        RETURNING id, bill_id, amount, currency, paid_at, paid_by, method, confirmation, notes, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(bill_id)
    .bind(request.amount)
    .bind(request.currency.clone())
    .bind(&bill.currency)
    .bind(request.paid_at)
    .bind(current_user.user_id)
    .bind(request.method)
    .bind(request.confirmation)
    .bind(request.notes)
    .fetch_one(&state.db)
    .await?;

    if let Some(category_name) = &bill.category {
        if let Some(category_id) = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id
            FROM budget_categories
            WHERE household_id = $1 AND lower(name) = lower($2)
            ORDER BY created_at ASC
            LIMIT 1
            "#,
        )
        .bind(household_id)
        .bind(category_name)
        .fetch_optional(&state.db)
        .await?
        {
            sqlx::query(
                r#"
                INSERT INTO expenses (
                    id, household_id, category_id, amount, currency, description, spent_at, paid_by, bill_payment_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(household_id)
            .bind(category_id)
            .bind(payment.amount)
            .bind(payment.currency.clone())
            .bind(format!("Auto-logged bill payment: {}", bill.name))
            .bind(payment.paid_at)
            .bind(payment.paid_by)
            .bind(payment.id)
            .execute(&state.db)
            .await?;
        }
    }

    if bill.next_due_at.is_some() {
        let next_due_at = advance_due_date(
            bill.next_due_at.unwrap_or(request.paid_at),
            &bill.frequency,
            bill.due_day,
        )?;

        sqlx::query("UPDATE bills SET next_due_at = $3, updated_at = NOW() WHERE household_id = $1 AND id = $2")
            .bind(household_id)
            .bind(bill_id)
            .bind(next_due_at)
            .execute(&state.db)
            .await?;
    }

    let payments = sqlx::query_as::<_, BillPaymentRecord>(
        r#"
        SELECT id, bill_id, amount, currency, paid_at, paid_by, method, confirmation, notes, created_at
        FROM bill_payments
        WHERE bill_id = $1
        ORDER BY paid_at DESC, created_at DESC
        "#,
    )
    .bind(bill_id)
    .fetch_all(&state.db)
    .await?;

    let refreshed_bill = sqlx::query_as::<_, BillRecord>(
        r#"
        SELECT id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
               frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
               payee_url, notes, is_active, created_at, updated_at
        FROM bills
        WHERE household_id = $1 AND id = $2
        "#,
    )
    .bind(household_id)
    .bind(bill_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(BillPaymentsResponse {
        bill: refreshed_bill,
        payments,
    }))
}

async fn list_payments(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, bill_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<BillPaymentsResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let bill = sqlx::query_as::<_, BillRecord>(
        r#"
        SELECT id, household_id, name, payee, amount, is_variable, estimated_amount, currency,
               frequency, due_day, next_due_at, auto_pay, account_label, account_masked, category,
               payee_url, notes, is_active, created_at, updated_at
        FROM bills
        WHERE household_id = $1 AND id = $2
        "#,
    )
    .bind(household_id)
    .bind(bill_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Bill not found"))?;

    let payments = sqlx::query_as::<_, BillPaymentRecord>(
        r#"
        SELECT id, bill_id, amount, currency, paid_at, paid_by, method, confirmation, notes, created_at
        FROM bill_payments
        WHERE bill_id = $1
        ORDER BY paid_at DESC, created_at DESC
        "#,
    )
    .bind(bill_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(BillPaymentsResponse { bill, payments }))
}

fn validate_bill_request(
    name: &str,
    frequency: &str,
    is_variable: bool,
    amount: Option<Decimal>,
) -> Result<(), ApiError> {
    if name.trim().is_empty() {
        return Err(ApiError::bad_request("Bill name must not be empty"));
    }

    if !matches!(
        frequency,
        "one-time" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semi-annual" | "annual"
    ) {
        return Err(ApiError::bad_request(format!(
            "Unsupported bill frequency `{frequency}`"
        )));
    }

    if !is_variable && amount.is_none() {
        return Err(ApiError::bad_request(
            "Fixed bills require an `amount`; variable bills can omit it",
        ));
    }

    Ok(())
}

fn advance_due_date(
    current_due_date: NaiveDate,
    frequency: &str,
    due_day: Option<i32>,
) -> Result<NaiveDate, ApiError> {
    match frequency {
        "one-time" => Ok(current_due_date),
        "weekly" => Ok(current_due_date + chrono::Duration::weeks(1)),
        "biweekly" => Ok(current_due_date + chrono::Duration::weeks(2)),
        "monthly" => Ok(shift_months(current_due_date, 1, due_day)),
        "quarterly" => Ok(shift_months(current_due_date, 3, due_day)),
        "semi-annual" => Ok(shift_months(current_due_date, 6, due_day)),
        "annual" => Ok(shift_months(current_due_date, 12, due_day)),
        _ => Err(ApiError::bad_request("Unsupported bill frequency")),
    }
}

fn shift_months(date: NaiveDate, months: i32, due_day: Option<i32>) -> NaiveDate {
    let total_months = date.month0() as i32 + months;
    let year = date.year() + total_months.div_euclid(12);
    let month0 = total_months.rem_euclid(12) as u32;
    let month = month0 + 1;
    let max_day = last_day_of_month(year, month);
    let target_day = due_day.unwrap_or(date.day() as i32).clamp(1, max_day as i32) as u32;

    NaiveDate::from_ymd_opt(year, month, target_day).unwrap_or(date)
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let first_of_next = NaiveDate::from_ymd_opt(next_year, next_month, 1).expect("valid month");
    (first_of_next - chrono::Duration::days(1)).day()
}
