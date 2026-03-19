use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{get, patch, post},
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

#[derive(Debug, Serialize, FromRow)]
struct ShoppingListRecord {
    id: Uuid,
    household_id: Uuid,
    name: String,
    store: Option<String>,
    created_by: Uuid,
    archived_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
struct ShoppingItemRecord {
    id: Uuid,
    list_id: Uuid,
    added_by: Uuid,
    name: String,
    quantity: Option<f64>,
    unit: Option<String>,
    category: Option<String>,
    checked: bool,
    checked_by: Option<Uuid>,
    checked_at: Option<DateTime<Utc>>,
    sort_order: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateListRequest {
    name: String,
    store: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateItemRequest {
    name: String,
    quantity: Option<f64>,
    unit: Option<String>,
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateItemRequest {
    checked: Option<bool>,
    quantity: Option<f64>,
    unit: Option<String>,
    category: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Serialize)]
struct ShoppingListsResponse {
    lists: Vec<ShoppingListRecord>,
}

#[derive(Debug, Serialize)]
struct ShoppingListDetailResponse {
    list: ShoppingListRecord,
    items: Vec<ShoppingItemRecord>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/shopping-lists",
            get(list_lists).post(create_list),
        )
        .route("/{household_id}/shopping-lists/{list_id}", get(get_list))
        .route(
            "/{household_id}/shopping-lists/{list_id}/items",
            post(create_item),
        )
        .route(
            "/{household_id}/shopping-lists/{list_id}/items/{item_id}",
            patch(update_item).delete(delete_item),
        )
        .route(
            "/{household_id}/shopping-lists/{list_id}/reset",
            post(reset_list),
        )
}

async fn list_lists(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<ShoppingListsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let lists = sqlx::query_as::<_, ShoppingListRecord>(
        r#"
        SELECT id, household_id, name, store, created_by, archived_at, created_at
        FROM shopping_lists
        WHERE household_id = $1 AND archived_at IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(household_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ShoppingListsResponse { lists }))
}

async fn create_list(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateListRequest>,
) -> Result<Json<ShoppingListDetailResponse>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let list_id = compat::new_id();
    let now = compat::now_utc();

    sqlx::query(
        r#"
        INSERT INTO shopping_lists (id, household_id, name, store, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(list_id)
    .bind(household_id)
    .bind(request.name.trim())
    .bind(request.store)
    .bind(current_user.user_id)
    .bind(now)
    .execute(&state.db)
    .await?;

    let list = sqlx::query_as::<_, ShoppingListRecord>(
        r#"
        SELECT id, household_id, name, store, created_by, archived_at, created_at
        FROM shopping_lists
        WHERE id = $1
        "#,
    )
    .bind(list_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ShoppingListDetailResponse {
        list,
        items: Vec::new(),
    }))
}

async fn get_list(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, list_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ShoppingListDetailResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let list = sqlx::query_as::<_, ShoppingListRecord>(
        r#"
        SELECT id, household_id, name, store, created_by, archived_at, created_at
        FROM shopping_lists
        WHERE household_id = $1 AND id = $2
        "#,
    )
    .bind(household_id)
    .bind(list_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Shopping list not found"))?;

    let items = sqlx::query_as::<_, ShoppingItemRecord>(
        r#"
        SELECT id, list_id, added_by, name, quantity, unit, category, checked,
               checked_by, checked_at, sort_order, created_at
        FROM shopping_items
        WHERE list_id = $1
        ORDER BY checked ASC, sort_order ASC, created_at ASC
        "#,
    )
    .bind(list_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ShoppingListDetailResponse { list, items }))
}

async fn create_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, list_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<CreateItemRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let item_id = compat::new_id();
    let now = compat::now_utc();
    let item_name = request.name.trim().to_owned();

    sqlx::query(
        r#"
        INSERT INTO shopping_items (id, list_id, added_by, name, quantity, unit, category, checked, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 0, $8)
        "#,
    )
    .bind(item_id)
    .bind(list_id)
    .bind(current_user.user_id)
    .bind(&item_name)
    .bind(request.quantity)
    .bind(&request.unit)
    .bind(&request.category)
    .bind(now)
    .execute(&state.db)
    .await?;

    let item = sqlx::query_as::<_, ShoppingItemRecord>(
        r#"
        SELECT id, list_id, added_by, name, quantity, unit, category, checked,
               checked_by, checked_at, sort_order, created_at
        FROM shopping_items
        WHERE id = $1
        "#,
    )
    .bind(item_id)
    .fetch_one(&state.db)
    .await?;

    // Upsert shopping_item_history: check-then-insert/update replaces ON CONFLICT.
    // Race-condition handling: if the INSERT fails because a concurrent request
    // created the row between our SELECT and INSERT, we fall back to UPDATE.
    let existing_history = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM shopping_item_history WHERE household_id = $1 AND name = $2",
    )
    .bind(household_id)
    .bind(&item_name)
    .fetch_optional(&state.db)
    .await?;

    if let Some(history_id) = existing_history {
        sqlx::query(
            r#"
            UPDATE shopping_item_history
            SET category = $2, last_bought_at = $3, buy_count = buy_count + 1
            WHERE id = $1
            "#,
        )
        .bind(history_id)
        .bind(&request.category)
        .bind(now)
        .execute(&state.db)
        .await?;
    } else {
        let insert = sqlx::query(
            r#"
            INSERT INTO shopping_item_history (id, household_id, name, category, last_bought_at, buy_count)
            VALUES ($1, $2, $3, $4, $5, 1)
            "#,
        )
        .bind(compat::new_id())
        .bind(household_id)
        .bind(&item_name)
        .bind(&request.category)
        .bind(now)
        .execute(&state.db)
        .await;

        if let Err(error) = insert {
            // Race: another request created the history row first.
            // Fall back to UPDATE instead of failing.
            if let sqlx::Error::Database(ref db_err) = error {
                if db_err.is_unique_violation() {
                    let fallback_id = sqlx::query_scalar::<_, Uuid>(
                        "SELECT id FROM shopping_item_history WHERE household_id = $1 AND name = $2",
                    )
                    .bind(household_id)
                    .bind(&item_name)
                    .fetch_one(&state.db)
                    .await?;

                    sqlx::query(
                        r#"
                        UPDATE shopping_item_history
                        SET category = $2, last_bought_at = $3, buy_count = buy_count + 1
                        WHERE id = $1
                        "#,
                    )
                    .bind(fallback_id)
                    .bind(&request.category)
                    .bind(now)
                    .execute(&state.db)
                    .await?;
                } else {
                    return Err(ApiError::from(error));
                }
            } else {
                return Err(ApiError::from(error));
            }
        }
    }

    publish_shopping_event(&state, "shopping_item.added", household_id, current_user.user_id, &item).await?;
    Ok(Json(serde_json::json!({ "item": item })))
}

async fn update_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, list_id, item_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(request): Json<UpdateItemRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let checked_by = if request.checked.unwrap_or(false) {
        Some(current_user.user_id)
    } else {
        None
    };
    let checked_at = if request.checked.unwrap_or(false) {
        Some(Utc::now())
    } else {
        None
    };

    let result = sqlx::query(
        r#"
        UPDATE shopping_items
        SET checked = COALESCE($4, checked),
            checked_by = CASE WHEN $4 IS NULL THEN checked_by ELSE $5 END,
            checked_at = CASE WHEN $4 IS NULL THEN checked_at ELSE $6 END,
            quantity = COALESCE($7, quantity),
            unit = COALESCE($8, unit),
            category = COALESCE($9, category),
            name = COALESCE($10, name)
        WHERE list_id = $1 AND id = $2
        "#,
    )
    .bind(list_id)
    .bind(item_id)
    .bind(household_id)
    .bind(request.checked)
    .bind(checked_by)
    .bind(checked_at)
    .bind(request.quantity)
    .bind(request.unit)
    .bind(request.category)
    .bind(request.name.map(|value| value.trim().to_owned()))
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Shopping item not found"));
    }

    let item = sqlx::query_as::<_, ShoppingItemRecord>(
        r#"
        SELECT id, list_id, added_by, name, quantity, unit, category, checked,
               checked_by, checked_at, sort_order, created_at
        FROM shopping_items
        WHERE id = $1
        "#,
    )
    .bind(item_id)
    .fetch_one(&state.db)
    .await?;

    let event_type = if item.checked {
        "shopping_item.checked"
    } else {
        "shopping_item.updated"
    };

    publish_shopping_event(&state, event_type, household_id, current_user.user_id, &item).await?;
    Ok(Json(serde_json::json!({ "item": item })))
}

async fn delete_item(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, _list_id, item_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    sqlx::query("DELETE FROM shopping_items WHERE id = $1")
        .bind(item_id)
        .execute(&state.db)
        .await?;

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "shopping_item.deleted",
                "module": "shopping",
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

async fn reset_list(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, list_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    sqlx::query(
        r#"
        UPDATE shopping_items
        SET checked = FALSE, checked_by = NULL, checked_at = NULL
        WHERE list_id = $1
        "#,
    )
    .bind(list_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "reset": true })))
}

async fn publish_shopping_event(
    state: &Arc<AppState>,
    event_type: &'static str,
    household_id: Uuid,
    actor_user_id: Uuid,
    item: &ShoppingItemRecord,
) -> Result<(), ApiError> {
    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": event_type,
                "module": "shopping",
                "household_id": household_id,
                "actor_user_id": actor_user_id,
                "payload": item,
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await
}
