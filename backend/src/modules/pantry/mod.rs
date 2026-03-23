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

// ── Records ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct PantryCategoryRecord {
    id: Uuid,
    household_id: Uuid,
    name: String,
    icon: Option<String>,
    sort_order: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PantryItemRecord {
    id: Uuid,
    household_id: Uuid,
    category_id: Option<Uuid>,
    added_by: Uuid,
    name: String,
    quantity: f64,
    unit: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    low_threshold: Option<f64>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PantryPhotoRecord {
    id: Uuid,
    item_id: Uuid,
    household_id: Uuid,
    uploaded_by: Uuid,
    file_name: String,
    content_type: String,
    created_at: DateTime<Utc>,
}

// ── Requests ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateCategoryRequest {
    name: String,
    icon: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateItemRequest {
    name: String,
    category_id: Option<Uuid>,
    quantity: Option<f64>,
    unit: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    low_threshold: Option<f64>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateItemRequest {
    name: Option<String>,
    category_id: Option<Uuid>,
    quantity: Option<f64>,
    unit: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    low_threshold: Option<f64>,
    notes: Option<String>,
}

// ── Responses ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct CategoriesResponse {
    categories: Vec<PantryCategoryRecord>,
}

#[derive(Debug, Serialize)]
struct ItemsResponse {
    items: Vec<PantryItemRecord>,
}

#[derive(Debug, Serialize)]
struct PhotosResponse {
    photos: Vec<PantryPhotoRecord>,
}

// ── Router ───────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/pantry/categories",
            get(list_categories).post(create_category),
        )
        .route(
            "/{household_id}/pantry/categories/{category_id}",
            delete(delete_category),
        )
        .route(
            "/{household_id}/pantry/items",
            get(list_items).post(create_item),
        )
        .route(
            "/{household_id}/pantry/items/{item_id}",
            patch(update_item).delete(delete_item),
        )
        .route(
            "/{household_id}/pantry/items/{item_id}/photos",
            get(list_photos).post(upload_photo),
        )
        .route(
            "/{household_id}/pantry/items/{item_id}/photos/{photo_id}",
            delete(delete_photo),
        )
}

// ── Category Handlers ────────────────────────────────────────────────────────

async fn list_categories(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<CategoriesResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let categories = sqlx::query_as::<_, PantryCategoryRecord>(
        r#"
        SELECT id, household_id, name, icon, sort_order, created_at
        FROM pantry_categories
        WHERE household_id = $1
        ORDER BY sort_order ASC, name ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(CategoriesResponse { categories }))
}

async fn create_category(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateCategoryRequest>,
) -> Result<Json<PantryCategoryRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let trimmed = request.name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("Category name cannot be empty"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();

    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(sort_order) FROM pantry_categories WHERE household_id = $1",
    )
    .bind(household_id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO pantry_categories (id, household_id, name, icon, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(trimmed)
    .bind(request.icon.as_deref())
    .bind(max_order.unwrap_or(0) + 1)
    .bind(now)
    .execute(&state.db)
    .await?;

    let category = sqlx::query_as::<_, PantryCategoryRecord>(
        r#"
        SELECT id, household_id, name, icon, sort_order, created_at
        FROM pantry_categories
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(category))
}

async fn delete_category(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, category_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query(
        "DELETE FROM pantry_categories WHERE id = $1 AND household_id = $2",
    )
    .bind(category_id)
    .bind(household_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Category not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Item Handlers ────────────────────────────────────────────────────────────

async fn list_items(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<ItemsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let items = sqlx::query_as::<_, PantryItemRecord>(
        r#"
        SELECT id, household_id, category_id, added_by, name, quantity, unit,
               expires_at, low_threshold, notes, created_at, updated_at
        FROM pantry_items
        WHERE household_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ItemsResponse { items }))
}

async fn create_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateItemRequest>,
) -> Result<Json<PantryItemRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let trimmed = request.name.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request("Item name cannot be empty"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();
    let quantity = request.quantity.unwrap_or(1.0);

    sqlx::query(
        r#"
        INSERT INTO pantry_items (id, household_id, category_id, added_by, name, quantity, unit,
                                  expires_at, low_threshold, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(request.category_id)
    .bind(current_user.user_id)
    .bind(trimmed)
    .bind(quantity)
    .bind(request.unit.as_deref())
    .bind(request.expires_at)
    .bind(request.low_threshold)
    .bind(request.notes.as_deref())
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let item = sqlx::query_as::<_, PantryItemRecord>(
        r#"
        SELECT id, household_id, category_id, added_by, name, quantity, unit,
               expires_at, low_threshold, notes, created_at, updated_at
        FROM pantry_items
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    publish_pantry_event(&state, "pantry_item.created", household_id, current_user.user_id, &item).await?;
    Ok(Json(item))
}

async fn update_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, item_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateItemRequest>,
) -> Result<Json<PantryItemRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let existing = sqlx::query("SELECT id FROM pantry_items WHERE id = $1 AND household_id = $2")
        .bind(item_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?;

    if existing.is_none() {
        return Err(ApiError::not_found("Pantry item not found"));
    }

    let now = compat::now_utc();

    sqlx::query(
        r#"
        UPDATE pantry_items
        SET name          = COALESCE($3, name),
            category_id   = COALESCE($4, category_id),
            quantity       = COALESCE($5, quantity),
            unit          = COALESCE($6, unit),
            expires_at    = COALESCE($7, expires_at),
            low_threshold = COALESCE($8, low_threshold),
            notes         = COALESCE($9, notes),
            updated_at    = $10
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(item_id)
    .bind(household_id)
    .bind(request.name.as_deref())
    .bind(request.category_id)
    .bind(request.quantity)
    .bind(request.unit.as_deref())
    .bind(request.expires_at)
    .bind(request.low_threshold)
    .bind(request.notes.as_deref())
    .bind(now)
    .execute(&state.db)
    .await?;

    let item = sqlx::query_as::<_, PantryItemRecord>(
        r#"
        SELECT id, household_id, category_id, added_by, name, quantity, unit,
               expires_at, low_threshold, notes, created_at, updated_at
        FROM pantry_items
        WHERE id = $1
        "#,
    )
    .bind(item_id)
    .fetch_one(&state.db)
    .await?;

    publish_pantry_event(&state, "pantry_item.updated", household_id, current_user.user_id, &item).await?;
    Ok(Json(item))
}

async fn delete_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM pantry_items WHERE id = $1 AND household_id = $2")
        .bind(item_id)
        .bind(household_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Pantry item not found"));
    }

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "pantry_item.deleted",
                "module": "pantry",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": item_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Photo Handlers ───────────────────────────────────────────────────────────

const MAX_PHOTO_BYTES: usize = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp", "image/gif"];

async fn list_photos(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<PhotosResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let photos = sqlx::query_as::<_, PantryPhotoRecord>(
        r#"
        SELECT id, item_id, household_id, uploaded_by, file_name, content_type, created_at
        FROM pantry_item_photos
        WHERE item_id = $1 AND household_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(item_id)
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PhotosResponse { photos }))
}

async fn upload_photo(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, item_id)): Path<(Uuid, Uuid)>,
    mut multipart: Multipart,
) -> Result<Json<PantryPhotoRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    // Verify item exists
    let exists = sqlx::query("SELECT id FROM pantry_items WHERE id = $1 AND household_id = $2")
        .bind(item_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("Pantry item not found"));
    }

    let field = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("Invalid multipart data: {e}")))?
        .ok_or_else(|| ApiError::bad_request("No file field in upload"))?;

    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_owned();

    if !ALLOWED_CONTENT_TYPES.contains(&content_type.as_str()) {
        return Err(ApiError::bad_request(format!(
            "Unsupported image type: {content_type}. Allowed: JPEG, PNG, WebP, GIF"
        )));
    }

    let ext = match content_type.as_str() {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "bin",
    };

    let bytes = field
        .bytes()
        .await
        .map_err(|e| ApiError::bad_request(format!("Failed to read upload: {e}")))?;

    if bytes.len() > MAX_PHOTO_BYTES {
        return Err(ApiError::bad_request("Photo exceeds 10 MB limit"));
    }

    let photo_id = compat::new_id();
    let file_name = format!("{photo_id}.{ext}");
    let file_path = std::path::Path::new(&state.config.upload_dir).join(&file_name);

    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to save file: {e}")))?;

    let now = compat::now_utc();

    sqlx::query(
        r#"
        INSERT INTO pantry_item_photos (id, item_id, household_id, uploaded_by, file_name, content_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(photo_id)
    .bind(item_id)
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(&file_name)
    .bind(&content_type)
    .bind(now)
    .execute(&state.db)
    .await?;

    let photo = sqlx::query_as::<_, PantryPhotoRecord>(
        r#"
        SELECT id, item_id, household_id, uploaded_by, file_name, content_type, created_at
        FROM pantry_item_photos
        WHERE id = $1
        "#,
    )
    .bind(photo_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(photo))
}

async fn delete_photo(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, _item_id, photo_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let photo = sqlx::query_as::<_, PantryPhotoRecord>(
        r#"
        SELECT id, item_id, household_id, uploaded_by, file_name, content_type, created_at
        FROM pantry_item_photos
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(photo_id)
    .bind(household_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Photo not found"))?;

    // Delete file from disk (best-effort)
    let file_path = std::path::Path::new(&state.config.upload_dir).join(&photo.file_name);
    let _ = tokio::fs::remove_file(&file_path).await;

    sqlx::query("DELETE FROM pantry_item_photos WHERE id = $1")
        .bind(photo_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── WebSocket Helper ─────────────────────────────────────────────────────────

async fn publish_pantry_event(
    state: &Arc<AppState>,
    event_type: &'static str,
    household_id: Uuid,
    actor_user_id: Uuid,
    item: &PantryItemRecord,
) -> Result<(), ApiError> {
    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": event_type,
                "module": "pantry",
                "household_id": household_id,
                "actor_user_id": actor_user_id,
                "payload": item,
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await
}
