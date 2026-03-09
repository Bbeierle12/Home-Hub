use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
};
use futures_util::StreamExt;
use serde::Deserialize;

use crate::{
    auth::jwt,
    error::ApiError,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
    household_id: uuid::Uuid,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, ApiError> {
    let claims = jwt::decode_token(&query.token, &state.config.jwt_secret)?;
    let membership = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM household_members
        WHERE household_id = $1 AND user_id = $2
        "#,
    )
    .bind(query.household_id)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    if membership == 0 {
        return Err(ApiError::forbidden(
            "WebSocket connection requires household membership",
        ));
    }

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, query.household_id)))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>, household_id: uuid::Uuid) {
    let mut subscription = state.ws_broker.subscribe(household_id).await;

    loop {
        tokio::select! {
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
            outgoing = subscription.recv() => {
                match outgoing {
                    Ok(message) => {
                        if socket
                            .send(Message::Text(message.as_str().into()))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    }
}
