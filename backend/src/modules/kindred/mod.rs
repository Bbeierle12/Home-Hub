pub mod ai;
pub mod media;

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_household_access, require_shared_write, CurrentUser},
    compat,
    error::ApiError,
    AppState,
};

// ── Records ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct FamilyMemberRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub created_by: Uuid,
    pub linked_user_id: Option<Uuid>,
    pub first_name: String,
    pub last_name: Option<String>,
    pub maiden_name: Option<String>,
    pub nickname: Option<String>,
    pub gender: Option<String>,
    pub birth_date: Option<NaiveDate>,
    pub birth_place: Option<String>,
    pub death_date: Option<NaiveDate>,
    pub death_place: Option<String>,
    pub bio: Option<String>,
    pub avatar_file: Option<String>,
    pub is_living: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct FamilyRelationshipRecord {
    pub id: Uuid,
    pub household_id: Uuid,
    pub from_member_id: Uuid,
    pub to_member_id: Uuid,
    pub rel_type: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Requests ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateMemberRequest {
    first_name: String,
    last_name: Option<String>,
    maiden_name: Option<String>,
    nickname: Option<String>,
    gender: Option<String>,
    birth_date: Option<NaiveDate>,
    birth_place: Option<String>,
    death_date: Option<NaiveDate>,
    death_place: Option<String>,
    bio: Option<String>,
    is_living: Option<bool>,
    linked_user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct UpdateMemberRequest {
    first_name: Option<String>,
    last_name: Option<String>,
    maiden_name: Option<String>,
    nickname: Option<String>,
    gender: Option<String>,
    birth_date: Option<NaiveDate>,
    birth_place: Option<String>,
    death_date: Option<NaiveDate>,
    death_place: Option<String>,
    bio: Option<String>,
    is_living: Option<bool>,
    linked_user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct CreateRelationshipRequest {
    from_member_id: Uuid,
    to_member_id: Uuid,
    rel_type: String,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    notes: Option<String>,
}

// ── Responses ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct MembersResponse {
    members: Vec<FamilyMemberRecord>,
}

#[derive(Debug, Serialize)]
struct RelationshipsResponse {
    relationships: Vec<FamilyRelationshipRecord>,
}

// ── Router ───────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        // Members
        .route(
            "/{household_id}/kindred/members",
            get(list_members).post(create_member),
        )
        .route(
            "/{household_id}/kindred/members/{member_id}",
            get(get_member).patch(update_member).delete(delete_member),
        )
        // Relationships
        .route(
            "/{household_id}/kindred/relationships",
            get(list_relationships).post(create_relationship),
        )
        .route(
            "/{household_id}/kindred/relationships/{rel_id}",
            delete(delete_relationship),
        )
        // Media (delegated)
        .merge(media::router())
        // AI stubs (delegated)
        .merge(ai::router())
}

// ── Member Handlers ──────────────────────────────────────────────────────────

const MEMBER_COLS: &str = r#"
    id, household_id, created_by, linked_user_id, first_name, last_name,
    maiden_name, nickname, gender, birth_date, birth_place, death_date,
    death_place, bio, avatar_file, is_living, created_at, updated_at
"#;

async fn list_members(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<MembersResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {MEMBER_COLS} FROM family_members WHERE household_id = $1 ORDER BY first_name ASC, last_name ASC"
    );
    let members = sqlx::query_as::<_, FamilyMemberRecord>(&query)
        .bind(household_id)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(MembersResponse { members }))
}

async fn get_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<FamilyMemberRecord>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {MEMBER_COLS} FROM family_members WHERE id = $1 AND household_id = $2"
    );
    let member = sqlx::query_as::<_, FamilyMemberRecord>(&query)
        .bind(member_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::not_found("Family member not found"))?;

    Ok(Json(member))
}

async fn create_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateMemberRequest>,
) -> Result<Json<FamilyMemberRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let trimmed = request.first_name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("First name cannot be empty"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();
    let is_living = request.is_living.unwrap_or(true);

    sqlx::query(
        r#"
        INSERT INTO family_members (id, household_id, created_by, linked_user_id,
            first_name, last_name, maiden_name, nickname, gender,
            birth_date, birth_place, death_date, death_place, bio,
            is_living, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(request.linked_user_id)
    .bind(trimmed)
    .bind(request.last_name.as_deref())
    .bind(request.maiden_name.as_deref())
    .bind(request.nickname.as_deref())
    .bind(request.gender.as_deref())
    .bind(request.birth_date)
    .bind(request.birth_place.as_deref())
    .bind(request.death_date)
    .bind(request.death_place.as_deref())
    .bind(request.bio.as_deref())
    .bind(is_living)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let query = format!("SELECT {MEMBER_COLS} FROM family_members WHERE id = $1");
    let member = sqlx::query_as::<_, FamilyMemberRecord>(&query)
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_member.created", household_id, current_user.user_id, &member).await?;
    Ok(Json(member))
}

async fn update_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, member_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateMemberRequest>,
) -> Result<Json<FamilyMemberRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let exists = sqlx::query("SELECT id FROM family_members WHERE id = $1 AND household_id = $2")
        .bind(member_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("Family member not found"));
    }

    let now = compat::now_utc();

    sqlx::query(
        r#"
        UPDATE family_members
        SET first_name     = COALESCE($3, first_name),
            last_name      = COALESCE($4, last_name),
            maiden_name    = COALESCE($5, maiden_name),
            nickname       = COALESCE($6, nickname),
            gender         = COALESCE($7, gender),
            birth_date     = COALESCE($8, birth_date),
            birth_place    = COALESCE($9, birth_place),
            death_date     = COALESCE($10, death_date),
            death_place    = COALESCE($11, death_place),
            bio            = COALESCE($12, bio),
            is_living      = COALESCE($13, is_living),
            linked_user_id = COALESCE($14, linked_user_id),
            updated_at     = $15
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(member_id)
    .bind(household_id)
    .bind(request.first_name.as_deref())
    .bind(request.last_name.as_deref())
    .bind(request.maiden_name.as_deref())
    .bind(request.nickname.as_deref())
    .bind(request.gender.as_deref())
    .bind(request.birth_date)
    .bind(request.birth_place.as_deref())
    .bind(request.death_date)
    .bind(request.death_place.as_deref())
    .bind(request.bio.as_deref())
    .bind(request.is_living)
    .bind(request.linked_user_id)
    .bind(now)
    .execute(&state.db)
    .await?;

    let query = format!("SELECT {MEMBER_COLS} FROM family_members WHERE id = $1");
    let member = sqlx::query_as::<_, FamilyMemberRecord>(&query)
        .bind(member_id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_member.updated", household_id, current_user.user_id, &member).await?;
    Ok(Json(member))
}

async fn delete_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM family_members WHERE id = $1 AND household_id = $2")
        .bind(member_id)
        .bind(household_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Family member not found"));
    }

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "kindred_member.deleted",
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": member_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Relationship Handlers ────────────────────────────────────────────────────

const REL_COLS: &str = "id, household_id, from_member_id, to_member_id, rel_type, start_date, end_date, notes, created_at";

const VALID_REL_TYPES: &[&str] = &["parent", "child", "spouse", "sibling", "partner"];

async fn list_relationships(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<RelationshipsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {REL_COLS} FROM family_relationships WHERE household_id = $1 ORDER BY created_at ASC"
    );
    let relationships = sqlx::query_as::<_, FamilyRelationshipRecord>(&query)
        .bind(household_id)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(RelationshipsResponse { relationships }))
}

async fn create_relationship(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateRelationshipRequest>,
) -> Result<Json<FamilyRelationshipRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    if !VALID_REL_TYPES.contains(&request.rel_type.as_str()) {
        return Err(ApiError::bad_request(format!(
            "Invalid relationship type: {}. Valid: {:?}",
            request.rel_type, VALID_REL_TYPES
        )));
    }

    if request.from_member_id == request.to_member_id {
        return Err(ApiError::bad_request("Cannot create a relationship with self"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();

    sqlx::query(
        r#"
        INSERT INTO family_relationships (id, household_id, from_member_id, to_member_id,
            rel_type, start_date, end_date, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(request.from_member_id)
    .bind(request.to_member_id)
    .bind(&request.rel_type)
    .bind(request.start_date)
    .bind(request.end_date)
    .bind(request.notes.as_deref())
    .bind(now)
    .execute(&state.db)
    .await?;

    let query = format!("SELECT {REL_COLS} FROM family_relationships WHERE id = $1");
    let rel = sqlx::query_as::<_, FamilyRelationshipRecord>(&query)
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "kindred_relationship.created",
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": &rel,
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(rel))
}

async fn delete_relationship(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, rel_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM family_relationships WHERE id = $1 AND household_id = $2")
        .bind(rel_id)
        .bind(household_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Relationship not found"));
    }

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "kindred_relationship.deleted",
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": rel_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── WebSocket Helper ─────────────────────────────────────────────────────────

pub async fn publish_kindred_event<T: Serialize>(
    state: &Arc<AppState>,
    event_type: &'static str,
    household_id: Uuid,
    actor_user_id: Uuid,
    payload: &T,
) -> Result<(), ApiError> {
    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": event_type,
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": actor_user_id,
                "payload": payload,
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await
}
