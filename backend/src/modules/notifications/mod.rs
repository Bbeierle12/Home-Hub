use std::sync::Arc;

use axum::{routing::get, Json, Router};

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/notifications/health", get(health))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "scaffolded",
        "module": "notifications"
    }))
}
