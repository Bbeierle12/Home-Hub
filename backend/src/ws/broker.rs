use std::{collections::HashMap, sync::Arc};

use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::error::ApiError;

#[derive(Clone, Default)]
pub struct WsBroker {
    channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<String>>>>,
}

impl WsBroker {
    pub async fn subscribe(&self, household_id: Uuid) -> broadcast::Receiver<String> {
        let mut channels = self.channels.write().await;
        let sender = channels.entry(household_id).or_insert_with(|| {
            let (sender, _) = broadcast::channel(128);
            sender
        });

        sender.subscribe()
    }

    pub async fn publish(&self, household_id: Uuid, payload: String) -> Result<(), ApiError> {
        let mut channels = self.channels.write().await;
        let sender = channels.entry(household_id).or_insert_with(|| {
            let (sender, _) = broadcast::channel(128);
            sender
        });

        sender.send(payload).map(|_| ()).map_err(|error| {
            ApiError::internal(format!("WebSocket publish failed for household {household_id}: {error}"))
        })
    }
}
