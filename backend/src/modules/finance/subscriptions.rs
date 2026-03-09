use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{get, patch},
    Json, Router,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::middleware::CurrentUser, error::ApiError, AppState};

use super::{
    access::{require_finance_read, require_finance_write},
    models::{SubscriptionAuditSummary, SubscriptionRecord},
};

#[derive(Debug, Deserialize)]
struct CreateSubscriptionRequest {
    name: String,
    amount: Decimal,
    currency: Option<String>,
    billing_cycle: String,
    renewal_date: Option<chrono::NaiveDate>,
    payment_method: Option<String>,
    cancel_url: Option<String>,
    category: Option<String>,
    notes: Option<String>,
    used_by: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
struct UpdateSubscriptionRequest {
    name: Option<String>,
    amount: Option<Decimal>,
    currency: Option<String>,
    billing_cycle: Option<String>,
    renewal_date: Option<chrono::NaiveDate>,
    payment_method: Option<String>,
    cancel_url: Option<String>,
    category: Option<String>,
    is_active: Option<bool>,
    notes: Option<String>,
    used_by: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
struct SubscriptionsResponse {
    subscriptions: Vec<SubscriptionRecord>,
}

#[derive(Debug, Serialize)]
struct SubscriptionResponse {
    subscription: SubscriptionRecord,
}

#[derive(Debug, Serialize)]
struct SubscriptionAuditResponse {
    summary: SubscriptionAuditSummary,
    duplicates_by_category: Vec<String>,
    subscriptions_per_user: HashMap<Uuid, usize>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/finance/subscriptions",
            get(list_subscriptions).post(create_subscription),
        )
        .route(
            "/{household_id}/finance/subscriptions/{subscription_id}",
            patch(update_subscription).delete(delete_subscription),
        )
        .route(
            "/{household_id}/finance/subscriptions/audit",
            get(get_subscription_audit),
        )
}

async fn list_subscriptions(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<SubscriptionsResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let subscriptions = sqlx::query_as::<_, SubscriptionRecord>(
        r#"
        SELECT id, household_id, name, amount, currency, billing_cycle, renewal_date, payment_method,
               cancel_url, category, is_active, notes, created_at, updated_at
        FROM subscriptions
        WHERE household_id = $1
        ORDER BY is_active DESC, name ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(SubscriptionsResponse { subscriptions }))
}

async fn create_subscription(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateSubscriptionRequest>,
) -> Result<Json<SubscriptionResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;
    validate_billing_cycle(&request.billing_cycle)?;

    let subscription = sqlx::query_as::<_, SubscriptionRecord>(
        r#"
        INSERT INTO subscriptions (
            id, household_id, name, amount, currency, billing_cycle, renewal_date, payment_method,
            cancel_url, category, notes
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, 'USD'), $6, $7, $8, $9, $10, $11)
        RETURNING id, household_id, name, amount, currency, billing_cycle, renewal_date, payment_method,
                  cancel_url, category, is_active, notes, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(household_id)
    .bind(request.name.trim())
    .bind(request.amount)
    .bind(request.currency)
    .bind(request.billing_cycle)
    .bind(request.renewal_date)
    .bind(request.payment_method)
    .bind(request.cancel_url)
    .bind(request.category)
    .bind(request.notes)
    .fetch_one(&state.db)
    .await?;

    sync_subscription_users(&state, subscription.id, request.used_by.unwrap_or_default()).await?;
    Ok(Json(SubscriptionResponse { subscription }))
}

async fn update_subscription(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, subscription_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateSubscriptionRequest>,
) -> Result<Json<SubscriptionResponse>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;
    if let Some(cycle) = &request.billing_cycle {
        validate_billing_cycle(cycle)?;
    }

    let subscription = sqlx::query_as::<_, SubscriptionRecord>(
        r#"
        UPDATE subscriptions
        SET name = COALESCE($3, name),
            amount = COALESCE($4, amount),
            currency = COALESCE($5, currency),
            billing_cycle = COALESCE($6, billing_cycle),
            renewal_date = COALESCE($7, renewal_date),
            payment_method = COALESCE($8, payment_method),
            cancel_url = COALESCE($9, cancel_url),
            category = COALESCE($10, category),
            is_active = COALESCE($11, is_active),
            notes = COALESCE($12, notes),
            updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, name, amount, currency, billing_cycle, renewal_date, payment_method,
                  cancel_url, category, is_active, notes, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(subscription_id)
    .bind(request.name.map(|value| value.trim().to_owned()))
    .bind(request.amount)
    .bind(request.currency)
    .bind(request.billing_cycle)
    .bind(request.renewal_date)
    .bind(request.payment_method)
    .bind(request.cancel_url)
    .bind(request.category)
    .bind(request.is_active)
    .bind(request.notes)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Subscription not found"))?;

    if let Some(used_by) = request.used_by {
        sync_subscription_users(&state, subscription.id, used_by).await?;
    }

    Ok(Json(SubscriptionResponse { subscription }))
}

async fn delete_subscription(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, subscription_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_finance_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM subscriptions WHERE household_id = $1 AND id = $2")
        .bind(household_id)
        .bind(subscription_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Subscription not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn get_subscription_audit(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<SubscriptionAuditResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;

    let subscriptions = sqlx::query_as::<_, SubscriptionRecord>(
        r#"
        SELECT id, household_id, name, amount, currency, billing_cycle, renewal_date, payment_method,
               cancel_url, category, is_active, notes, created_at, updated_at
        FROM subscriptions
        WHERE household_id = $1 AND is_active = TRUE
        ORDER BY name ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    let assignments = sqlx::query_as::<_, (Uuid, Uuid)>(
        r#"
        SELECT subscription_id, user_id
        FROM subscription_users
        WHERE subscription_id = ANY(
            SELECT id FROM subscriptions WHERE household_id = $1
        )
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    let mut monthly_equivalent_total = Decimal::ZERO;
    let mut annual_projection = Decimal::ZERO;
    let mut by_category: HashMap<String, usize> = HashMap::new();
    for subscription in &subscriptions {
        let monthly_equivalent = if subscription.billing_cycle == "annual" {
            subscription.amount / Decimal::from(12)
        } else {
            subscription.amount
        };

        monthly_equivalent_total += monthly_equivalent;
        annual_projection += monthly_equivalent * Decimal::from(12);

        if let Some(category) = &subscription.category {
            *by_category.entry(category.to_lowercase()).or_default() += 1;
        }
    }

    let duplicates_by_category = by_category
        .iter()
        .filter_map(|(category, count)| if *count > 1 { Some(category.clone()) } else { None })
        .collect::<Vec<_>>();

    let active_ids = subscriptions.iter().map(|item| item.id).collect::<HashSet<_>>();
    let mut subscriptions_per_user: HashMap<Uuid, usize> = HashMap::new();
    for (subscription_id, user_id) in assignments {
        if active_ids.contains(&subscription_id) {
            *subscriptions_per_user.entry(user_id).or_default() += 1;
        }
    }

    Ok(Json(SubscriptionAuditResponse {
        summary: SubscriptionAuditSummary {
            active_count: subscriptions.len(),
            monthly_equivalent_total,
            annual_projection,
        },
        duplicates_by_category,
        subscriptions_per_user,
    }))
}

async fn sync_subscription_users(
    state: &Arc<AppState>,
    subscription_id: Uuid,
    used_by: Vec<Uuid>,
) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM subscription_users WHERE subscription_id = $1")
        .bind(subscription_id)
        .execute(&state.db)
        .await?;

    for user_id in used_by {
        sqlx::query(
            r#"
            INSERT INTO subscription_users (subscription_id, user_id)
            VALUES ($1, $2)
            "#,
        )
        .bind(subscription_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    }

    Ok(())
}

fn validate_billing_cycle(value: &str) -> Result<(), ApiError> {
    if matches!(value, "monthly" | "annual") {
        Ok(())
    } else {
        Err(ApiError::bad_request(format!(
            "Unsupported subscription billing_cycle `{value}`"
        )))
    }
}
