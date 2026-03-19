use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::{DateTime, NaiveTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_household_access, CurrentUser},
    config::DbBackend,
    error::ApiError,
    AppState,
};

#[derive(Debug, Serialize, FromRow)]
struct BillDueCard {
    id: Uuid,
    name: String,
    next_due_at: Option<chrono::NaiveDate>,
    is_variable: bool,
}

#[derive(Debug, Serialize, FromRow)]
struct TaskCard {
    id: Uuid,
    title: String,
    due_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
struct ShoppingSummaryRow {
    id: Uuid,
    name: String,
    open_items: i64,
}

#[derive(Debug, Serialize)]
struct DashboardResponse {
    today: String,
    my_tasks: Vec<TaskCard>,
    shopping_lists: Vec<ShoppingSummaryRow>,
    bills_due_soon: Option<Vec<BillDueCard>>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/{household_id}/dashboard", get(get_dashboard))
}

async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<DashboardResponse>, ApiError> {
    let membership = require_household_access(&state, &current_user, household_id).await?;

    let today = Utc::now().date_naive();
    // End-of-day timestamp replaces the PostgreSQL `due_at::date <= $3` cast.
    let end_of_today = today
        .and_time(NaiveTime::from_hms_opt(23, 59, 59).unwrap())
        .and_utc();

    // CASE WHEN replaces `NULLS LAST`; timestamp comparison replaces `::date`.
    let my_tasks = sqlx::query_as::<_, TaskCard>(
        r#"
        SELECT id, title, due_at, completed_at
        FROM tasks
        WHERE household_id = $1
          AND (assigned_to = $2 OR assigned_to IS NULL)
          AND completed_at IS NULL
          AND (due_at IS NULL OR due_at <= $3)
        ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END ASC, due_at ASC
        LIMIT 8
        "#,
    )
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(end_of_today)
    .fetch_all(&state.db)
    .await?;

    // SUM(CASE …) replaces the PostgreSQL-specific `FILTER (WHERE …)` clause.
    let shopping_lists = sqlx::query_as::<_, ShoppingSummaryRow>(
        r#"
        SELECT sl.id, sl.name,
               COALESCE(SUM(CASE WHEN si.id IS NOT NULL AND si.checked = FALSE THEN 1 ELSE 0 END), 0) AS open_items
        FROM shopping_lists sl
        LEFT JOIN shopping_items si ON si.list_id = sl.id
        WHERE sl.household_id = $1 AND sl.archived_at IS NULL
        GROUP BY sl.id, sl.name, sl.created_at
        ORDER BY sl.created_at DESC
        LIMIT 5
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    let bills_due_soon = if state.config.db_backend == DbBackend::RustDb {
        // Bills table does not exist in rustdb mode; finance is postgres-only.
        None
    } else {
        match membership.role.as_str() {
            "admin" => Some(fetch_bills_due_soon(&state, household_id, today).await?),
            "member" => {
                let member_access = sqlx::query_scalar::<_, String>(
                    r#"
                    SELECT member_access
                    FROM household_finance_settings
                    WHERE household_id = $1
                    "#,
                )
                .bind(household_id)
                .fetch_optional(&state.db)
                .await?;

                if matches!(member_access.as_deref(), Some("read_only" | "full")) {
                    Some(fetch_bills_due_soon(&state, household_id, today).await?)
                } else {
                    None
                }
            }
            _ => None,
        }
    };

    Ok(Json(DashboardResponse {
        today: today.format("%Y-%m-%d").to_string(),
        my_tasks,
        shopping_lists,
        bills_due_soon,
    }))
}

async fn fetch_bills_due_soon(
    state: &Arc<AppState>,
    household_id: Uuid,
    today: chrono::NaiveDate,
) -> Result<Vec<BillDueCard>, ApiError> {
    sqlx::query_as::<_, BillDueCard>(
        r#"
        SELECT id, name, next_due_at, is_variable
        FROM bills
        WHERE household_id = $1
          AND is_active = TRUE
          AND next_due_at IS NOT NULL
          AND next_due_at >= $2
          AND next_due_at <= $3
        ORDER BY next_due_at ASC
        LIMIT 5
        "#,
    )
    .bind(household_id)
    .bind(today)
    .bind(today + chrono::Duration::days(7))
    .fetch_all(&state.db)
    .await
    .map_err(ApiError::from)
}
