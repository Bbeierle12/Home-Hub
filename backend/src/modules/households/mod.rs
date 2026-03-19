use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_admin, require_household_access, CurrentUser},
    compat,
    error::ApiError,
    types::HouseholdRole,
    AppState,
};

#[derive(Debug, Deserialize)]
struct CreateHouseholdRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
struct CreateInviteRequest {
    email: Option<String>,
    role: Option<HouseholdRole>,
}

#[derive(Debug, Deserialize)]
struct JoinHouseholdRequest {
    token: String,
}

#[derive(Debug, Serialize, FromRow)]
struct HouseholdRecord {
    id: Uuid,
    name: String,
    created_by: Option<Uuid>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct HouseholdMemberRecord {
    user_id: Uuid,
    display_name: String,
    email: String,
    role: String,
    joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct HouseholdResponse {
    household: HouseholdRecord,
}

#[derive(Debug, Serialize)]
struct MembersResponse {
    members: Vec<HouseholdMemberRecord>,
}

#[derive(Debug, FromRow)]
struct InviteRecord {
    household_id: Uuid,
    role: String,
    expires_at: DateTime<Utc>,
    accepted_at: Option<DateTime<Utc>>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_household))
        .route("/join", post(join_household))
        .route("/{household_id}/members", get(list_members))
        .route("/{household_id}/invites", post(create_invite))
}

async fn create_household(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Json(request): Json<CreateHouseholdRequest>,
) -> Result<Json<HouseholdResponse>, ApiError> {
    if request.name.trim().len() < 2 {
        return Err(ApiError::bad_request(
            "Household name must contain at least 2 characters",
        ));
    }

    let household_id = compat::new_id();
    let now = compat::now_utc();

    sqlx::query(
        r#"
        INSERT INTO households (id, name, created_by, created_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(household_id)
    .bind(request.name.trim())
    .bind(current_user.user_id)
    .bind(now)
    .execute(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO household_members (id, household_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, 'admin', $4)
        "#,
    )
    .bind(compat::new_id())
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(now)
    .execute(&state.db)
    .await?;

    let household = sqlx::query_as::<_, HouseholdRecord>(
        r#"
        SELECT id, name, created_by, created_at
        FROM households
        WHERE id = $1
        "#,
    )
    .bind(household_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(HouseholdResponse { household }))
}

async fn join_household(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Json(request): Json<JoinHouseholdRequest>,
) -> Result<Json<HouseholdResponse>, ApiError> {
    let invite = sqlx::query_as::<_, InviteRecord>(
        r#"
        SELECT household_id, role, expires_at, accepted_at
        FROM household_invites
        WHERE token = $1
        "#,
    )
    .bind(&request.token)
    .fetch_optional(&state.db)
    .await?;

    let invite = invite.ok_or_else(|| ApiError::not_found("Invite token not found"))?;

    if invite.accepted_at.is_some() || invite.expires_at < Utc::now() {
        return Err(ApiError::bad_request("Invite token is expired or already used"));
    }

    // App-side existence check replaces ON CONFLICT DO NOTHING.
    // If a concurrent request races past the check, the unique index on
    // (household_id, user_id) causes a constraint/unique-violation error
    // which we swallow — the member row already exists either way.
    let already_member = sqlx::query(
        "SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2",
    )
    .bind(invite.household_id)
    .bind(current_user.user_id)
    .fetch_optional(&state.db)
    .await?;

    if already_member.is_none() {
        let insert = sqlx::query(
            r#"
            INSERT INTO household_members (id, household_id, user_id, role, joined_at)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(compat::new_id())
        .bind(invite.household_id)
        .bind(current_user.user_id)
        .bind(&invite.role)
        .bind(compat::now_utc())
        .execute(&state.db)
        .await;

        if let Err(error) = insert {
            // Swallow unique-violation (race condition) — member was created
            // by a concurrent request.  Any other error is propagated.
            if let sqlx::Error::Database(ref db_err) = error {
                if !db_err.is_unique_violation() {
                    return Err(ApiError::from(error));
                }
            } else {
                return Err(ApiError::from(error));
            }
        }
    }

    sqlx::query(
        r#"
        UPDATE household_invites
        SET accepted_at = $2
        WHERE token = $1
        "#,
    )
    .bind(&request.token)
    .bind(compat::now_utc())
    .execute(&state.db)
    .await?;

    let household = sqlx::query_as::<_, HouseholdRecord>(
        r#"
        SELECT id, name, created_by, created_at
        FROM households
        WHERE id = $1
        "#,
    )
    .bind(invite.household_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(HouseholdResponse { household }))
}

async fn list_members(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<MembersResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let members = sqlx::query_as::<_, HouseholdMemberRecord>(
        r#"
        SELECT u.id AS user_id, u.display_name, u.email, hm.role, hm.joined_at
        FROM household_members hm
        INNER JOIN users u ON u.id = hm.user_id
        WHERE hm.household_id = $1
        ORDER BY hm.joined_at ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(MembersResponse { members }))
}

async fn create_invite(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateInviteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&state, &current_user, household_id).await?;

    let invite_token: String = format!("invite_{}", Uuid::new_v4().simple());
    let role = request.role.unwrap_or(HouseholdRole::Member).as_str().to_owned();

    sqlx::query(
        r#"
        INSERT INTO household_invites (id, household_id, invited_by, token, role, email, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(compat::new_id())
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(&invite_token)
    .bind(role)
    .bind(request.email)
    .bind(compat::invite_expires_at())
    .bind(compat::now_utc())
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "token": invite_token })))
}
