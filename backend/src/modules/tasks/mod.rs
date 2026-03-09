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
    error::ApiError,
    AppState,
};

#[derive(Debug, Serialize, FromRow, Clone)]
struct TaskRecord {
    id: Uuid,
    household_id: Uuid,
    created_by: Uuid,
    assigned_to: Option<Uuid>,
    title: String,
    description: Option<String>,
    category: Option<String>,
    priority: String,
    due_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
    points: i32,
    recurrence_rule: Option<String>,
    recurrence_parent_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateTaskRequest {
    title: String,
    description: Option<String>,
    category: Option<String>,
    priority: Option<String>,
    due_at: Option<DateTime<Utc>>,
    assigned_to: Option<Uuid>,
    points: Option<i32>,
    recurrence_rule: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateTaskRequest {
    title: Option<String>,
    description: Option<String>,
    category: Option<String>,
    priority: Option<String>,
    due_at: Option<DateTime<Utc>>,
    assigned_to: Option<Uuid>,
    points: Option<i32>,
    recurrence_rule: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AssignTaskRequest {
    assigned_to: Option<Uuid>,
}

#[derive(Debug, Serialize)]
struct TasksResponse {
    tasks: Vec<TaskRecord>,
}

#[derive(Debug, Serialize)]
struct TaskResponse {
    task: TaskRecord,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/{household_id}/tasks", get(list_tasks).post(create_task))
        .route(
            "/{household_id}/tasks/{task_id}",
            patch(update_task).delete(delete_task),
        )
        .route(
            "/{household_id}/tasks/{task_id}/complete",
            post(complete_task),
        )
        .route("/{household_id}/tasks/{task_id}/assign", post(assign_task))
}

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
) -> Result<Json<TasksResponse>, ApiError> {
    let membership = require_household_access(&state, &current_user, household_id).await?;

    let tasks = if membership.role == "child" {
        sqlx::query_as::<_, TaskRecord>(
            r#"
            SELECT id, household_id, created_by, assigned_to, title, description, category, priority,
                   due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
            FROM tasks
            WHERE household_id = $1 AND assigned_to = $2
            ORDER BY COALESCE(due_at, created_at) ASC
            "#,
        )
        .bind(household_id)
        .bind(current_user.user_id)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, TaskRecord>(
            r#"
            SELECT id, household_id, created_by, assigned_to, title, description, category, priority,
                   due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
            FROM tasks
            WHERE household_id = $1
            ORDER BY COALESCE(due_at, created_at) ASC
            "#,
        )
        .bind(household_id)
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(TasksResponse { tasks }))
}

async fn create_task(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<Json<TaskResponse>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let task = sqlx::query_as::<_, TaskRecord>(
        r#"
        INSERT INTO tasks (
            id, household_id, created_by, assigned_to, title, description, category, priority,
            due_at, points, recurrence_rule
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'medium'), $9, COALESCE($10, 0), $11)
        RETURNING id, household_id, created_by, assigned_to, title, description, category, priority,
                  due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(request.assigned_to)
    .bind(request.title.trim())
    .bind(request.description)
    .bind(request.category)
    .bind(request.priority)
    .bind(request.due_at)
    .bind(request.points)
    .bind(request.recurrence_rule)
    .fetch_one(&state.db)
    .await?;

    publish_task_event(&state, "task.created", household_id, current_user.user_id, &task).await?;
    Ok(Json(TaskResponse { task }))
}

async fn update_task(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, task_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let task = sqlx::query_as::<_, TaskRecord>(
        r#"
        UPDATE tasks
        SET title = COALESCE($3, title),
            description = COALESCE($4, description),
            category = COALESCE($5, category),
            priority = COALESCE($6, priority),
            due_at = COALESCE($7, due_at),
            assigned_to = COALESCE($8, assigned_to),
            points = COALESCE($9, points),
            recurrence_rule = COALESCE($10, recurrence_rule),
            updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, created_by, assigned_to, title, description, category, priority,
                  due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(task_id)
    .bind(request.title.map(|value| value.trim().to_owned()))
    .bind(request.description)
    .bind(request.category)
    .bind(request.priority)
    .bind(request.due_at)
    .bind(request.assigned_to)
    .bind(request.points)
    .bind(request.recurrence_rule)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Task not found"))?;

    publish_task_event(&state, "task.updated", household_id, current_user.user_id, &task).await?;
    Ok(Json(TaskResponse { task }))
}

async fn complete_task(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, task_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<TaskResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let task = sqlx::query_as::<_, TaskRecord>(
        r#"
        UPDATE tasks
        SET completed_at = NOW(), updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, created_by, assigned_to, title, description, category, priority,
                  due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(task_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Task not found"))?;

    sqlx::query(
        r#"
        INSERT INTO task_completion_log (id, task_id, completed_by, points_awarded)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(task_id)
    .bind(current_user.user_id)
    .bind(task.points)
    .execute(&state.db)
    .await?;

    publish_task_event(&state, "task.completed", household_id, current_user.user_id, &task).await?;
    Ok(Json(TaskResponse { task }))
}

async fn assign_task(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, task_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<AssignTaskRequest>,
) -> Result<Json<TaskResponse>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let task = sqlx::query_as::<_, TaskRecord>(
        r#"
        UPDATE tasks
        SET assigned_to = $3, updated_at = NOW()
        WHERE household_id = $1 AND id = $2
        RETURNING id, household_id, created_by, assigned_to, title, description, category, priority,
                  due_at, completed_at, points, recurrence_rule, recurrence_parent_id, created_at, updated_at
        "#,
    )
    .bind(household_id)
    .bind(task_id)
    .bind(request.assigned_to)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Task not found"))?;

    publish_task_event(&state, "task.updated", household_id, current_user.user_id, &task).await?;
    Ok(Json(TaskResponse { task }))
}

async fn delete_task(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, task_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query(
        r#"
        DELETE FROM tasks
        WHERE household_id = $1 AND id = $2
        "#,
    )
    .bind(household_id)
    .bind(task_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Task not found"));
    }

    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": "task.deleted",
                "module": "tasks",
                "household_id": household_id,
                "actor_user_id": current_user.user_id,
                "payload": { "id": task_id },
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn publish_task_event(
    state: &Arc<AppState>,
    event_type: &'static str,
    household_id: Uuid,
    actor_user_id: Uuid,
    task: &TaskRecord,
) -> Result<(), ApiError> {
    state
        .ws_broker
        .publish(
            household_id,
            serde_json::json!({
                "type": event_type,
                "module": "tasks",
                "household_id": household_id,
                "actor_user_id": actor_user_id,
                "payload": task,
                "timestamp": Utc::now(),
            })
            .to_string(),
        )
        .await
}
