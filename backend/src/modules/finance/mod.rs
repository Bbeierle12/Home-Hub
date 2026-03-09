mod access;
mod bills;
mod budget;
mod models;
mod settings;
mod subscriptions;
mod summary;

use axum::Router;

pub fn router() -> Router<std::sync::Arc<crate::AppState>> {
    Router::new()
        .merge(settings::router())
        .merge(bills::router())
        .merge(budget::router())
        .merge(subscriptions::router())
        .merge(summary::router())
}
