pub mod dashboard;
pub mod finance;
pub mod households;
pub mod notifications;
pub mod shopping;
pub mod tasks;

use axum::Router;

pub fn router() -> Router<std::sync::Arc<crate::AppState>> {
    Router::new()
        .merge(households::router())
        .merge(tasks::router())
        .merge(shopping::router())
        .merge(finance::router())
        .merge(dashboard::router())
        .merge(notifications::router())
}
