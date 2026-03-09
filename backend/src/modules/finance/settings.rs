use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::CurrentUser,
    error::ApiError,
    AppState,
};

use super::{
    access::{get_settings, require_finance_admin, require_finance_read},
    models::{FinanceSettingsRecord, MemberFinanceAccess},
};

#[derive(Debug, Deserialize)]
struct UpdateFinanceSettingsRequest {
    member_access: Option<MemberFinanceAccess>,
    income_enabled: Option<bool>,
    sensitive_reauth_ttl_minutes: Option<i32>,
}

#[derive(Debug, Serialize)]
struct FinanceSettingsResponse {
    settings: FinanceSettingsRecord,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/{household_id}/finance/settings",
        get(read_finance_settings).patch(update_finance_settings),
    )
}

async fn read_finance_settings(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<FinanceSettingsResponse>, ApiError> {
    require_finance_read(&state, &current_user, household_id).await?;
    let settings = get_settings(&state, household_id).await?;
    Ok(Json(FinanceSettingsResponse { settings }))
}

async fn update_finance_settings(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<UpdateFinanceSettingsRequest>,
) -> Result<Json<FinanceSettingsResponse>, ApiError> {
    require_finance_admin(&state, &current_user, household_id).await?;

    if let Some(ttl) = request.sensitive_reauth_ttl_minutes {
        if !(1..=120).contains(&ttl) {
            return Err(ApiError::bad_request(
                "sensitive_reauth_ttl_minutes must be between 1 and 120",
            ));
        }
    }

    sqlx::query(
        r#"
        INSERT INTO household_finance_settings (
            household_id, member_access, income_enabled, sensitive_reauth_ttl_minutes, updated_at
        )
        VALUES ($1, COALESCE($2, 'none'), COALESCE($3, FALSE), COALESCE($4, 10), NOW())
        ON CONFLICT (household_id)
        DO UPDATE SET
            member_access = COALESCE($2, household_finance_settings.member_access),
            income_enabled = COALESCE($3, household_finance_settings.income_enabled),
            sensitive_reauth_ttl_minutes = COALESCE($4, household_finance_settings.sensitive_reauth_ttl_minutes),
            updated_at = NOW()
        "#,
    )
    .bind(household_id)
    .bind(request.member_access.map(MemberFinanceAccess::as_str))
    .bind(request.income_enabled)
    .bind(request.sensitive_reauth_ttl_minutes)
    .execute(&state.db)
    .await?;

    let settings = get_settings(&state, household_id).await?;
    Ok(Json(FinanceSettingsResponse { settings }))
}
