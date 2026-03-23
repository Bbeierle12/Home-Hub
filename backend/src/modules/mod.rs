pub mod calendar;
pub mod dashboard;
pub mod finance;
pub mod households;
pub mod notifications;
pub mod pantry;
pub mod shopping;
pub mod tasks;

use axum::{http::StatusCode, routing::get, Json, Router};

use crate::config::DbBackend;

pub fn router(db_backend: DbBackend) -> Router<std::sync::Arc<crate::AppState>> {
    let base = Router::new()
        .merge(households::router())
        .merge(tasks::router())
        .merge(shopping::router())
        .merge(dashboard::router())
        .merge(notifications::router())
        .merge(pantry::router())
        .merge(calendar::router());

    match db_backend {
        DbBackend::Postgres => base.merge(finance::router()),
        DbBackend::RustDb => base.merge(finance_unavailable_router()),
    }
}

/// Stub router returned in rustdb mode.  Registers the same top-level
/// finance paths so the frontend receives a clear 501 instead of a 404.
fn finance_unavailable_router() -> Router<std::sync::Arc<crate::AppState>> {
    async fn unavailable() -> (StatusCode, Json<serde_json::Value>) {
        (
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({
                "error": "feature_unavailable",
                "message": "Finance features are not available in rustdb mode. Use DB_BACKEND=postgres to enable them."
            })),
        )
    }

    Router::new()
        .route(
            "/{household_id}/finance/settings",
            get(unavailable).patch(unavailable),
        )
        .route(
            "/{household_id}/finance/bills",
            get(unavailable).post(unavailable),
        )
        .route(
            "/{household_id}/finance/bills/{bill_id}",
            get(unavailable).patch(unavailable).delete(unavailable),
        )
        .route(
            "/{household_id}/finance/bills/{bill_id}/pay",
            axum::routing::post(unavailable),
        )
        .route(
            "/{household_id}/finance/bills/{bill_id}/payments",
            get(unavailable),
        )
        .route(
            "/{household_id}/finance/budget/categories",
            get(unavailable).post(unavailable),
        )
        .route(
            "/{household_id}/finance/budget/categories/{category_id}",
            get(unavailable).patch(unavailable).delete(unavailable),
        )
        .route(
            "/{household_id}/finance/budget/{year}/{month}",
            get(unavailable),
        )
        .route(
            "/{household_id}/finance/expenses",
            get(unavailable).post(unavailable),
        )
        .route(
            "/{household_id}/finance/expenses/{expense_id}",
            get(unavailable).patch(unavailable).delete(unavailable),
        )
        .route(
            "/{household_id}/finance/subscriptions",
            get(unavailable).post(unavailable),
        )
        .route(
            "/{household_id}/finance/subscriptions/{subscription_id}",
            get(unavailable).patch(unavailable).delete(unavailable),
        )
        .route(
            "/{household_id}/finance/subscriptions/audit",
            get(unavailable),
        )
        .route("/{household_id}/finance/summary", get(unavailable))
}
