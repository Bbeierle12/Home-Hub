use std::sync::Arc;

use axum::{
    extract::{Multipart, Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_household_access, require_shared_write, CurrentUser},
    compat,
    error::ApiError,
    AppState,
};

use super::publish_kindred_event;

// ── Records ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct FamilyMediaAlbumRecord {
    id: Uuid,
    household_id: Uuid,
    created_by: Uuid,
    name: String,
    description: Option<String>,
    cover_media_id: Option<Uuid>,
    sort_order: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct FamilyMediaRecord {
    id: Uuid,
    household_id: Uuid,
    album_id: Option<Uuid>,
    uploaded_by: Uuid,
    file_name: String,
    content_type: String,
    file_size_bytes: Option<i64>,
    caption: Option<String>,
    taken_at: Option<DateTime<Utc>>,
    location: Option<String>,
    ai_people_tags: Option<String>,
    ai_place_tags: Option<String>,
    ai_event_tags: Option<String>,
    ai_processed: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

// ── Requests ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateAlbumRequest {
    name: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateAlbumRequest {
    name: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateMediaRequest {
    caption: Option<String>,
    album_id: Option<Uuid>,
    location: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TagMemberRequest {
    member_id: Uuid,
}

// ── Responses ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct AlbumsResponse {
    albums: Vec<FamilyMediaAlbumRecord>,
}

#[derive(Debug, Serialize)]
struct MediaListResponse {
    media: Vec<FamilyMediaRecord>,
}

#[derive(Debug, Serialize)]
struct TaggedMembersResponse {
    member_ids: Vec<Uuid>,
}

// ── Router ───────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/kindred/albums",
            get(list_albums).post(create_album),
        )
        .route(
            "/{household_id}/kindred/albums/{album_id}",
            patch(update_album).delete(delete_album),
        )
        .route(
            "/{household_id}/kindred/media",
            get(list_media).post(upload_media),
        )
        .route(
            "/{household_id}/kindred/media/{media_id}",
            get(get_media).patch(update_media).delete(delete_media),
        )
        .route(
            "/{household_id}/kindred/media/{media_id}/people",
            get(list_tagged_members).post(tag_member).delete(untag_member),
        )
}

// ── Album Handlers ───────────────────────────────────────────────────────────

const ALBUM_COLS: &str = "id, household_id, created_by, name, description, cover_media_id, sort_order, created_at, updated_at";

async fn list_albums(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<AlbumsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {ALBUM_COLS} FROM family_media_albums WHERE household_id = $1 ORDER BY sort_order ASC, name ASC"
    );
    let albums = sqlx::query_as::<_, FamilyMediaAlbumRecord>(&query)
        .bind(household_id)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(AlbumsResponse { albums }))
}

async fn create_album(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateAlbumRequest>,
) -> Result<Json<FamilyMediaAlbumRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let trimmed = request.name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("Album name cannot be empty"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();

    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(sort_order) FROM family_media_albums WHERE household_id = $1",
    )
    .bind(household_id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO family_media_albums (id, household_id, created_by, name, description, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(trimmed)
    .bind(request.description.as_deref())
    .bind(max_order.unwrap_or(0) + 1)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let query = format!("SELECT {ALBUM_COLS} FROM family_media_albums WHERE id = $1");
    let album = sqlx::query_as::<_, FamilyMediaAlbumRecord>(&query)
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_album.created", household_id, current_user.user_id, &album).await?;
    Ok(Json(album))
}

async fn update_album(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, album_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateAlbumRequest>,
) -> Result<Json<FamilyMediaAlbumRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let now = compat::now_utc();
    let result = sqlx::query(
        r#"
        UPDATE family_media_albums
        SET name        = COALESCE($3, name),
            description = COALESCE($4, description),
            updated_at  = $5
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(album_id)
    .bind(household_id)
    .bind(request.name.as_deref())
    .bind(request.description.as_deref())
    .bind(now)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Album not found"));
    }

    let query = format!("SELECT {ALBUM_COLS} FROM family_media_albums WHERE id = $1");
    let album = sqlx::query_as::<_, FamilyMediaAlbumRecord>(&query)
        .bind(album_id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_album.updated", household_id, current_user.user_id, &album).await?;
    Ok(Json(album))
}

async fn delete_album(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, album_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM family_media_albums WHERE id = $1 AND household_id = $2")
        .bind(album_id)
        .bind(household_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Album not found"));
    }

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "kindred_album.deleted",
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": album_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Media Handlers ───────────────────────────────────────────────────────────

const MEDIA_COLS: &str = r#"
    id, household_id, album_id, uploaded_by, file_name, content_type,
    file_size_bytes, caption, taken_at, location,
    ai_people_tags, ai_place_tags, ai_event_tags, ai_processed,
    created_at, updated_at
"#;

const MAX_MEDIA_BYTES: usize = 50 * 1024 * 1024; // 50 MB for heritage media

const ALLOWED_MEDIA_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
];

async fn list_media(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<MediaListResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {MEDIA_COLS} FROM family_media WHERE household_id = $1 ORDER BY created_at DESC"
    );
    let media = sqlx::query_as::<_, FamilyMediaRecord>(&query)
        .bind(household_id)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(MediaListResponse { media }))
}

async fn get_media(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<FamilyMediaRecord>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let query = format!(
        "SELECT {MEDIA_COLS} FROM family_media WHERE id = $1 AND household_id = $2"
    );
    let media = sqlx::query_as::<_, FamilyMediaRecord>(&query)
        .bind(media_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::not_found("Media not found"))?;

    Ok(Json(media))
}

async fn upload_media(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<FamilyMediaRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut content_type_val = String::from("application/octet-stream");
    let mut caption: Option<String> = None;
    let mut album_id: Option<Uuid> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("Invalid multipart data: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        match name.as_str() {
            "file" => {
                content_type_val = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_owned();
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::bad_request(format!("Failed to read upload: {e}")))?;
                file_bytes = Some(bytes.to_vec());
            }
            "caption" => {
                caption = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| ApiError::bad_request(format!("Failed to read caption: {e}")))?,
                );
            }
            "album_id" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| ApiError::bad_request(format!("Failed to read album_id: {e}")))?;
                if !text.is_empty() {
                    album_id = Some(
                        text.parse::<Uuid>()
                            .map_err(|_| ApiError::bad_request("Invalid album_id UUID"))?,
                    );
                }
            }
            _ => {}
        }
    }

    let bytes = file_bytes.ok_or_else(|| ApiError::bad_request("No file field in upload"))?;

    if !ALLOWED_MEDIA_TYPES.contains(&content_type_val.as_str()) {
        return Err(ApiError::bad_request(format!(
            "Unsupported media type: {content_type_val}. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, MOV"
        )));
    }

    if bytes.len() > MAX_MEDIA_BYTES {
        return Err(ApiError::bad_request("File exceeds 50 MB limit"));
    }

    let ext = match content_type_val.as_str() {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        _ => "bin",
    };

    let media_id = compat::new_id();
    let file_name = format!("{media_id}.{ext}");
    let file_path = std::path::Path::new(&state.config.upload_dir).join(&file_name);

    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to save file: {e}")))?;

    let now = compat::now_utc();
    let file_size = bytes.len() as i64;

    sqlx::query(
        r#"
        INSERT INTO family_media (id, household_id, album_id, uploaded_by, file_name, content_type,
            file_size_bytes, caption, ai_processed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10)
        "#,
    )
    .bind(media_id)
    .bind(household_id)
    .bind(album_id)
    .bind(current_user.user_id)
    .bind(&file_name)
    .bind(&content_type_val)
    .bind(file_size)
    .bind(caption.as_deref())
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let query = format!("SELECT {MEDIA_COLS} FROM family_media WHERE id = $1");
    let media = sqlx::query_as::<_, FamilyMediaRecord>(&query)
        .bind(media_id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_media.created", household_id, current_user.user_id, &media).await?;
    Ok(Json(media))
}

async fn update_media(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateMediaRequest>,
) -> Result<Json<FamilyMediaRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let now = compat::now_utc();
    let result = sqlx::query(
        r#"
        UPDATE family_media
        SET caption    = COALESCE($3, caption),
            album_id   = COALESCE($4, album_id),
            location   = COALESCE($5, location),
            updated_at = $6
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(media_id)
    .bind(household_id)
    .bind(request.caption.as_deref())
    .bind(request.album_id)
    .bind(request.location.as_deref())
    .bind(now)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Media not found"));
    }

    let query = format!("SELECT {MEDIA_COLS} FROM family_media WHERE id = $1");
    let media = sqlx::query_as::<_, FamilyMediaRecord>(&query)
        .bind(media_id)
        .fetch_one(&state.db)
        .await?;

    publish_kindred_event(&state, "kindred_media.updated", household_id, current_user.user_id, &media).await?;
    Ok(Json(media))
}

async fn delete_media(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let query = format!("SELECT {MEDIA_COLS} FROM family_media WHERE id = $1 AND household_id = $2");
    let media = sqlx::query_as::<_, FamilyMediaRecord>(&query)
        .bind(media_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::not_found("Media not found"))?;

    // Delete file from disk (best-effort)
    let file_path = std::path::Path::new(&state.config.upload_dir).join(&media.file_name);
    let _ = tokio::fs::remove_file(&file_path).await;

    sqlx::query("DELETE FROM family_media WHERE id = $1")
        .bind(media_id)
        .execute(&state.db)
        .await?;

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "kindred_media.deleted",
                "module": "kindred",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": media_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── People Tagging ───────────────────────────────────────────────────────────

async fn list_tagged_members(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<TaggedMembersResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT member_id FROM family_media_people WHERE media_id = $1",
    )
    .bind(media_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(TaggedMembersResponse {
        member_ids: rows.into_iter().map(|r| r.0).collect(),
    }))
}

async fn tag_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<TagMemberRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    sqlx::query(
        "INSERT INTO family_media_people (media_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(media_id)
    .bind(request.member_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "tagged": true })))
}

async fn untag_member(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, media_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<TagMemberRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    sqlx::query("DELETE FROM family_media_people WHERE media_id = $1 AND member_id = $2")
        .bind(media_id)
        .bind(request.member_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "untagged": true })))
}
