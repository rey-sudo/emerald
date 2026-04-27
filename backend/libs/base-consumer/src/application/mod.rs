pub mod consumer;
pub mod otro;

use crate::{
    application::consumer::MultiHandler, infrastructure::bootstrap::AppState,
    otro::run_key_shared_consumer,
};
use pulsar::{DeserializeMessage, Payload};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, error::Error, sync::Arc, time::Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct EventEnveloped {
    pub event_id: Uuid,
    pub event_type: String,
    pub entity_type: String,
    pub data: serde_json::Value,
}

/// Implementation of the `DeserializeMessage` trait to transform Pulsar messages into `EventEnveloped`.
impl DeserializeMessage for EventEnveloped {
    type Output = Result<EventEnveloped, serde_json::Error>;

    fn deserialize_message(payload: &Payload) -> Self::Output {
        serde_json::from_slice(&payload.data)
    }
}

#[derive(Hash, Eq, PartialEq, Debug)]
enum SubscriptionType {
    Shared,
    KeyShared,
}

fn parse_topic_type(t: &str) -> SubscriptionType {
    match t {
        "shared" => SubscriptionType::Shared,
        "key-shared" => SubscriptionType::KeyShared,
        _ => panic!("Invalid topic type: {}", t),
    }
}

pub async fn run<L>(state: Arc<AppState>, multi_handler: L) -> Result<(), Box<dyn Error>>
where
    L: MultiHandler + Send + Sync + 'static,
{
    let topics: Vec<String> = state.config.topics.clone();
    let types: Vec<String> = state.config.topics_type.clone();

    if topics.len() != types.len() {
        warn!("TOPICS ({}) y TOPICS_TYPE ({})", topics.len(), types.len());
    }

    let mut grouped: HashMap<SubscriptionType, Vec<String>> = HashMap::new();

    for (topic, t) in topics.iter().zip(types.iter()) {
        let sub_type: SubscriptionType = parse_topic_type(t);
        grouped.entry(sub_type).or_default().push(topic.clone());
    }

    let handlers: Arc<L> = Arc::new(multi_handler);

    let mut handles: Vec<tokio::task::JoinHandle<()>> = vec![];

    for (sub_type, topics) in grouped {
        match sub_type {
            SubscriptionType::Shared => {
                //tokio::spawn(run_shared_consumer(topics));
            }
            SubscriptionType::KeyShared => {
                let state = state.clone();
                let handlers = handlers.clone();

                let handle = tokio::spawn(async move {
                    if let Err(e) = run_key_shared_consumer(state, topics, handlers).await {
                        tracing::error!("Consumer crashed: {:?}", e);
                    }
                });

                handles.push(handle);
            }
        }
    }

    for handle in handles {
        let _ = handle.await;
    }

    Ok(())
}
