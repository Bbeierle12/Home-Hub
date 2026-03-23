use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
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

#[derive(Debug, Serialize, FromRow)]
pub struct CalendarEventRecord {
    id: Uuid,
    household_id: Uuid,
    created_by: Uuid,
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: DateTime<Utc>,
    end_at: DateTime<Utc>,
    all_day: bool,
    color: String,
    event_type: String,
    recurrence_rule: Option<String>,
    recurrence_end_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MealPlanRecord {
    id: Uuid,
    household_id: Uuid,
    calendar_event_id: Option<Uuid>,
    created_by: Uuid,
    date: NaiveDate,
    meal_type: String,
    recipe_name: String,
    recipe_url: Option<String>,
    servings: i32,
    prep_minutes: Option<i32>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MealPlanItemRecord {
    id: Uuid,
    meal_plan_id: Uuid,
    pantry_item_id: Option<Uuid>,
    ingredient_name: String,
    quantity: Option<f64>,
    unit: Option<String>,
}

// ── Requests ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateEventRequest {
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: DateTime<Utc>,
    end_at: DateTime<Utc>,
    all_day: Option<bool>,
    color: Option<String>,
    event_type: Option<String>,
    recurrence_rule: Option<String>,
    recurrence_end_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct UpdateEventRequest {
    title: Option<String>,
    description: Option<String>,
    location: Option<String>,
    start_at: Option<DateTime<Utc>>,
    end_at: Option<DateTime<Utc>>,
    all_day: Option<bool>,
    color: Option<String>,
    event_type: Option<String>,
    recurrence_rule: Option<String>,
    recurrence_end_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct EventRangeQuery {
    start: DateTime<Utc>,
    end: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateMealPlanRequest {
    date: NaiveDate,
    meal_type: String,
    recipe_name: String,
    recipe_url: Option<String>,
    servings: Option<i32>,
    prep_minutes: Option<i32>,
    notes: Option<String>,
    ingredients: Option<Vec<IngredientInput>>,
}

#[derive(Debug, Deserialize)]
struct UpdateMealPlanRequest {
    date: Option<NaiveDate>,
    meal_type: Option<String>,
    recipe_name: Option<String>,
    recipe_url: Option<String>,
    servings: Option<i32>,
    prep_minutes: Option<i32>,
    notes: Option<String>,
    ingredients: Option<Vec<IngredientInput>>,
}

#[derive(Debug, Deserialize)]
struct IngredientInput {
    pantry_item_id: Option<Uuid>,
    ingredient_name: String,
    quantity: Option<f64>,
    unit: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MealPlanRangeQuery {
    start: NaiveDate,
    end: NaiveDate,
}

// ── Responses ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct EventsResponse {
    events: Vec<CalendarEventRecord>,
}

#[derive(Debug, Serialize)]
struct MealPlansResponse {
    meals: Vec<MealPlanWithIngredients>,
}

#[derive(Debug, Serialize)]
struct MealPlanWithIngredients {
    #[serde(flatten)]
    meal: MealPlanRecord,
    ingredients: Vec<MealPlanItemRecord>,
}

// ── Router ───────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/calendar/events",
            get(list_events).post(create_event),
        )
        .route(
            "/{household_id}/calendar/events/{event_id}",
            get(get_event).patch(update_event).delete(delete_event),
        )
        .route(
            "/{household_id}/calendar/meals",
            get(list_meals).post(create_meal),
        )
        .route(
            "/{household_id}/calendar/meals/{meal_id}",
            get(get_meal).patch(update_meal).delete(delete_meal),
        )
}

// ── Event Handlers ───────────────────────────────────────────────────────────

const VALID_EVENT_TYPES: &[&str] = &["event", "task", "reminder", "meal"];
const VALID_MEAL_TYPES: &[&str] = &["breakfast", "lunch", "dinner", "snack"];

async fn list_events(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Query(range): Query<EventRangeQuery>,
) -> Result<Json<EventsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let events = sqlx::query_as::<_, CalendarEventRecord>(
        r#"
        SELECT id, household_id, created_by, title, description, location,
               start_at, end_at, all_day, color, event_type,
               recurrence_rule, recurrence_end_at, created_at, updated_at
        FROM calendar_events
        WHERE household_id = $1
          AND start_at < $3
          AND end_at > $2
        ORDER BY start_at ASC
        "#,
    )
    .bind(household_id)
    .bind(range.start)
    .bind(range.end)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(EventsResponse { events }))
}

async fn get_event(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<CalendarEventRecord>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let event = sqlx::query_as::<_, CalendarEventRecord>(
        r#"
        SELECT id, household_id, created_by, title, description, location,
               start_at, end_at, all_day, color, event_type,
               recurrence_rule, recurrence_end_at, created_at, updated_at
        FROM calendar_events
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(event_id)
    .bind(household_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Event not found"))?;

    Ok(Json(event))
}

async fn create_event(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateEventRequest>,
) -> Result<Json<CalendarEventRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    if request.title.trim().is_empty() {
        return Err(ApiError::bad_request("Event title cannot be empty"));
    }
    if request.end_at <= request.start_at {
        return Err(ApiError::bad_request("End time must be after start time"));
    }
    let event_type = request.event_type.as_deref().unwrap_or("event");
    if !VALID_EVENT_TYPES.contains(&event_type) {
        return Err(ApiError::bad_request("Invalid event_type"));
    }

    let id = compat::new_id();
    let now = compat::now_utc();

    sqlx::query(
        r#"
        INSERT INTO calendar_events
            (id, household_id, created_by, title, description, location,
             start_at, end_at, all_day, color, event_type,
             recurrence_rule, recurrence_end_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        "#,
    )
    .bind(id)
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(request.title.trim())
    .bind(request.description.as_deref())
    .bind(request.location.as_deref())
    .bind(request.start_at)
    .bind(request.end_at)
    .bind(request.all_day.unwrap_or(false))
    .bind(request.color.as_deref().unwrap_or("#3b82f6"))
    .bind(event_type)
    .bind(request.recurrence_rule.as_deref())
    .bind(request.recurrence_end_at)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let event = fetch_event(&state, id).await?;
    publish_calendar_event(&state, "calendar_event.created", household_id, current_user.user_id, &event).await?;
    Ok(Json(event))
}

async fn update_event(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, event_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateEventRequest>,
) -> Result<Json<CalendarEventRecord>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let exists = sqlx::query("SELECT id FROM calendar_events WHERE id = $1 AND household_id = $2")
        .bind(event_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("Event not found"));
    }

    if let Some(ref et) = request.event_type {
        if !VALID_EVENT_TYPES.contains(&et.as_str()) {
            return Err(ApiError::bad_request("Invalid event_type"));
        }
    }

    let now = compat::now_utc();

    sqlx::query(
        r#"
        UPDATE calendar_events
        SET title            = COALESCE($3, title),
            description      = COALESCE($4, description),
            location         = COALESCE($5, location),
            start_at         = COALESCE($6, start_at),
            end_at           = COALESCE($7, end_at),
            all_day          = COALESCE($8, all_day),
            color            = COALESCE($9, color),
            event_type       = COALESCE($10, event_type),
            recurrence_rule  = COALESCE($11, recurrence_rule),
            recurrence_end_at = COALESCE($12, recurrence_end_at),
            updated_at       = $13
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(event_id)
    .bind(household_id)
    .bind(request.title.as_deref())
    .bind(request.description.as_deref())
    .bind(request.location.as_deref())
    .bind(request.start_at)
    .bind(request.end_at)
    .bind(request.all_day)
    .bind(request.color.as_deref())
    .bind(request.event_type.as_deref())
    .bind(request.recurrence_rule.as_deref())
    .bind(request.recurrence_end_at)
    .bind(now)
    .execute(&state.db)
    .await?;

    let event = fetch_event(&state, event_id).await?;
    publish_calendar_event(&state, "calendar_event.updated", household_id, current_user.user_id, &event).await?;
    Ok(Json(event))
}

async fn delete_event(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let result = sqlx::query("DELETE FROM calendar_events WHERE id = $1 AND household_id = $2")
        .bind(event_id)
        .bind(household_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Event not found"));
    }

    state.ws_broker.publish(
        household_id,
        serde_json::json!({
            "type": "calendar_event.deleted",
            "module": "calendar",
            "household_id": household_id,
            "actor_user_id": current_user.user_id,
            "payload": { "id": event_id },
            "timestamp": Utc::now(),
        }).to_string(),
    ).await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Meal Plan Handlers ───────────────────────────────────────────────────────

async fn list_meals(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Query(range): Query<MealPlanRangeQuery>,
) -> Result<Json<MealPlansResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    let meals = sqlx::query_as::<_, MealPlanRecord>(
        r#"
        SELECT id, household_id, calendar_event_id, created_by, date, meal_type,
               recipe_name, recipe_url, servings, prep_minutes, notes,
               created_at, updated_at
        FROM meal_plans
        WHERE household_id = $1 AND date >= $2 AND date <= $3
        ORDER BY date ASC, CASE meal_type
            WHEN 'breakfast' THEN 1
            WHEN 'lunch' THEN 2
            WHEN 'snack' THEN 3
            WHEN 'dinner' THEN 4
        END
        "#,
    )
    .bind(household_id)
    .bind(range.start)
    .bind(range.end)
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::with_capacity(meals.len());
    for meal in meals {
        let ingredients = sqlx::query_as::<_, MealPlanItemRecord>(
            r#"
            SELECT id, meal_plan_id, pantry_item_id, ingredient_name, quantity, unit
            FROM meal_plan_items
            WHERE meal_plan_id = $1
            "#,
        )
        .bind(meal.id)
        .fetch_all(&state.db)
        .await?;

        result.push(MealPlanWithIngredients { meal, ingredients });
    }

    Ok(Json(MealPlansResponse { meals: result }))
}

async fn get_meal(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, meal_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MealPlanWithIngredients>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;
    let meal = fetch_meal_with_ingredients(&state, household_id, meal_id).await?;
    Ok(Json(meal))
}

async fn create_meal(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path(household_id): Path<Uuid>,
    Json(request): Json<CreateMealPlanRequest>,
) -> Result<Json<MealPlanWithIngredients>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    if request.recipe_name.trim().is_empty() {
        return Err(ApiError::bad_request("Recipe name cannot be empty"));
    }
    if !VALID_MEAL_TYPES.contains(&request.meal_type.as_str()) {
        return Err(ApiError::bad_request("Invalid meal_type. Use: breakfast, lunch, dinner, snack"));
    }

    let meal_id = compat::new_id();
    let now = compat::now_utc();

    // Auto-create a calendar event for this meal
    let event_id = compat::new_id();
    let (start_hour, end_hour) = match request.meal_type.as_str() {
        "breakfast" => (8, 9),
        "lunch" => (12, 13),
        "snack" => (15, 16),
        _ => (18, 19), // dinner
    };

    let start_at = request.date.and_hms_opt(start_hour, 0, 0)
        .unwrap()
        .and_utc();
    let end_at = request.date.and_hms_opt(end_hour, 0, 0)
        .unwrap()
        .and_utc();

    sqlx::query(
        r#"
        INSERT INTO calendar_events
            (id, household_id, created_by, title, description, location,
             start_at, end_at, all_day, color, event_type,
             recurrence_rule, recurrence_end_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,FALSE,$8,'meal',NULL,NULL,$9,$10)
        "#,
    )
    .bind(event_id)
    .bind(household_id)
    .bind(current_user.user_id)
    .bind(format!("{}: {}", capitalize(&request.meal_type), request.recipe_name.trim()))
    .bind(request.notes.as_deref())
    .bind(start_at)
    .bind(end_at)
    .bind(meal_type_color(&request.meal_type))
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO meal_plans
            (id, household_id, calendar_event_id, created_by, date, meal_type,
             recipe_name, recipe_url, servings, prep_minutes, notes, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        "#,
    )
    .bind(meal_id)
    .bind(household_id)
    .bind(event_id)
    .bind(current_user.user_id)
    .bind(request.date)
    .bind(&request.meal_type)
    .bind(request.recipe_name.trim())
    .bind(request.recipe_url.as_deref())
    .bind(request.servings.unwrap_or(1))
    .bind(request.prep_minutes)
    .bind(request.notes.as_deref())
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    // Insert ingredients
    if let Some(ingredients) = &request.ingredients {
        for ingredient in ingredients {
            sqlx::query(
                r#"
                INSERT INTO meal_plan_items (id, meal_plan_id, pantry_item_id, ingredient_name, quantity, unit)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(compat::new_id())
            .bind(meal_id)
            .bind(ingredient.pantry_item_id)
            .bind(ingredient.ingredient_name.trim())
            .bind(ingredient.quantity)
            .bind(ingredient.unit.as_deref())
            .execute(&state.db)
            .await?;
        }
    }

    let meal = fetch_meal_with_ingredients(&state, household_id, meal_id).await?;

    state.ws_broker.publish(
        household_id,
        serde_json::json!({
            "type": "meal_plan.created",
            "module": "calendar",
            "household_id": household_id,
            "actor_user_id": current_user.user_id,
            "payload": &meal,
            "timestamp": Utc::now(),
        }).to_string(),
    ).await?;

    Ok(Json(meal))
}

async fn update_meal(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, meal_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateMealPlanRequest>,
) -> Result<Json<MealPlanWithIngredients>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    let exists = sqlx::query("SELECT id FROM meal_plans WHERE id = $1 AND household_id = $2")
        .bind(meal_id)
        .bind(household_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("Meal plan not found"));
    }

    if let Some(ref mt) = request.meal_type {
        if !VALID_MEAL_TYPES.contains(&mt.as_str()) {
            return Err(ApiError::bad_request("Invalid meal_type"));
        }
    }

    let now = compat::now_utc();

    sqlx::query(
        r#"
        UPDATE meal_plans
        SET date         = COALESCE($3, date),
            meal_type    = COALESCE($4, meal_type),
            recipe_name  = COALESCE($5, recipe_name),
            recipe_url   = COALESCE($6, recipe_url),
            servings     = COALESCE($7, servings),
            prep_minutes = COALESCE($8, prep_minutes),
            notes        = COALESCE($9, notes),
            updated_at   = $10
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(meal_id)
    .bind(household_id)
    .bind(request.date)
    .bind(request.meal_type.as_deref())
    .bind(request.recipe_name.as_deref())
    .bind(request.recipe_url.as_deref())
    .bind(request.servings)
    .bind(request.prep_minutes)
    .bind(request.notes.as_deref())
    .bind(now)
    .execute(&state.db)
    .await?;

    // Replace ingredients if provided
    if let Some(ingredients) = &request.ingredients {
        sqlx::query("DELETE FROM meal_plan_items WHERE meal_plan_id = $1")
            .bind(meal_id)
            .execute(&state.db)
            .await?;

        for ingredient in ingredients {
            sqlx::query(
                r#"
                INSERT INTO meal_plan_items (id, meal_plan_id, pantry_item_id, ingredient_name, quantity, unit)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
            )
            .bind(compat::new_id())
            .bind(meal_id)
            .bind(ingredient.pantry_item_id)
            .bind(ingredient.ingredient_name.trim())
            .bind(ingredient.quantity)
            .bind(ingredient.unit.as_deref())
            .execute(&state.db)
            .await?;
        }
    }

    let meal = fetch_meal_with_ingredients(&state, household_id, meal_id).await?;

    state.ws_broker.publish(
        household_id,
        serde_json::json!({
            "type": "meal_plan.updated",
            "module": "calendar",
            "household_id": household_id,
            "actor_user_id": current_user.user_id,
            "payload": &meal,
            "timestamp": Utc::now(),
        }).to_string(),
    ).await?;

    Ok(Json(meal))
}

async fn delete_meal(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, meal_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_shared_write(&state, &current_user, household_id).await?;

    // Also delete linked calendar event
    let meal = sqlx::query_as::<_, MealPlanRecord>(
        r#"
        SELECT id, household_id, calendar_event_id, created_by, date, meal_type,
               recipe_name, recipe_url, servings, prep_minutes, notes, created_at, updated_at
        FROM meal_plans
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(meal_id)
    .bind(household_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("Meal plan not found"))?;

    sqlx::query("DELETE FROM meal_plans WHERE id = $1")
        .bind(meal_id)
        .execute(&state.db)
        .await?;

    if let Some(event_id) = meal.calendar_event_id {
        sqlx::query("DELETE FROM calendar_events WHERE id = $1 AND household_id = $2")
            .bind(event_id)
            .bind(household_id)
            .execute(&state.db)
            .await?;
    }

    state.ws_broker.publish(
        household_id,
        serde_json::json!({
            "type": "meal_plan.deleted",
            "module": "calendar",
            "household_id": household_id,
            "actor_user_id": current_user.user_id,
            "payload": { "id": meal_id },
            "timestamp": Utc::now(),
        }).to_string(),
    ).await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async fn fetch_event(state: &Arc<AppState>, event_id: Uuid) -> Result<CalendarEventRecord, ApiError> {
    sqlx::query_as::<_, CalendarEventRecord>(
        r#"
        SELECT id, household_id, created_by, title, description, location,
               start_at, end_at, all_day, color, event_type,
               recurrence_rule, recurrence_end_at, created_at, updated_at
        FROM calendar_events
        WHERE id = $1
        "#,
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await
    .map_err(ApiError::from)
}

async fn fetch_meal_with_ingredients(
    state: &Arc<AppState>,
    household_id: Uuid,
    meal_id: Uuid,
) -> Result<MealPlanWithIngredients, ApiError> {
    let meal = sqlx::query_as::<_, MealPlanRecord>(
        r#"
        SELECT id, household_id, calendar_event_id, created_by, date, meal_type,
               recipe_name, recipe_url, servings, prep_minutes, notes, created_at, updated_at
        FROM meal_plans
        WHERE id = $1 AND household_id = $2
        "#,
    )
    .bind(meal_id)
    .bind(household_id)
    .fetch_one(&state.db)
    .await?;

    let ingredients = sqlx::query_as::<_, MealPlanItemRecord>(
        r#"
        SELECT id, meal_plan_id, pantry_item_id, ingredient_name, quantity, unit
        FROM meal_plan_items
        WHERE meal_plan_id = $1
        "#,
    )
    .bind(meal_id)
    .fetch_all(&state.db)
    .await?;

    Ok(MealPlanWithIngredients { meal, ingredients })
}

async fn publish_calendar_event(
    state: &Arc<AppState>,
    event_type: &'static str,
    household_id: Uuid,
    actor_user_id: Uuid,
    event: &CalendarEventRecord,
) -> Result<(), ApiError> {
    state.ws_broker.publish(
        household_id,
        serde_json::json!({
            "type": event_type,
            "module": "calendar",
            "household_id": household_id,
            "actor_user_id": actor_user_id,
            "payload": event,
            "timestamp": Utc::now(),
        }).to_string(),
    ).await
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

fn meal_type_color(meal_type: &str) -> &'static str {
    match meal_type {
        "breakfast" => "#f59e0b",
        "lunch" => "#10b981",
        "dinner" => "#8b5cf6",
        "snack" => "#ec4899",
        _ => "#3b82f6",
    }
}
