use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_household_access, CurrentUser},
    error::ApiError,
    AppState,
};

#[derive(Debug, Serialize)]
struct AiTagsResponse {
    people: Vec<String>,
    places: Vec<String>,
    events: Vec<String>,
    status: &'static str,
}

#[derive(Debug, Serialize)]
struct AiFactsResponse {
    facts: Vec<String>,
    status: &'static str,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/{household_id}/kindred/media/{media_id}/ai-tags",
            post(suggest_media_tags),
        )
        .route(
            "/{household_id}/kindred/stories/{story_id}/ai-facts",
            post(suggest_story_facts),
        )
}

async fn suggest_media_tags(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, _media_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AiTagsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    // Stub: returns empty suggestions. Wire to AI provider in the future.
    Ok(Json(AiTagsResponse {
        people: vec![],
        places: vec![],
        events: vec![],
        status: "stub",
    }))
}

async fn suggest_story_facts(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Path((household_id, _story_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AiFactsResponse>, ApiError> {
    require_household_access(&state, &current_user, household_id).await?;

    // Stub: returns empty facts. Wire to AI provider in the future.
    Ok(Json(AiFactsResponse {
        facts: vec![],
        status: "stub",
    }))
}
