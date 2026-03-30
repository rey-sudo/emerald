use crate::infrastructure::bootstrap::AppState;
use anyhow::{Context, Result};
use futures::TryStreamExt;
use pulsar::{
    Consumer, DeserializeMessage, Payload, Pulsar, SubType, TokioExecutor,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct EventPayload {
    pub event_id: Uuid,
    pub entity_type: String,
    pub data: serde_json::Value,
}

impl DeserializeMessage for EventPayload {
    type Output = Result<EventPayload, serde_json::Error>;

    fn deserialize_message(payload: &Payload) -> Self::Output {
        serde_json::from_slice(&payload.data)
    }
}

pub async fn run(state: Arc<AppState>) -> Result<()> {
    info!("Starting consumer for topics: {:?}", state.config.topics);

    let pulsar: Pulsar<_> = Pulsar::builder(&state.config.pulsar_url, TokioExecutor)
        .build()
        .await
        .context("Failed to create Pulsar client")?;

    let mut consumer: Consumer<EventPayload, TokioExecutor> = pulsar
        .consumer()
        .with_topics(state.config.topics.clone())
        .with_consumer_name("event-processor-node")
        .with_subscription("main-processor-group")
        .with_subscription_type(SubType::KeyShared) 
        .build()
        .await?;

    let consumer_group: &str = "main-processor-group";

    while let Some(msg) = consumer.try_next().await? {
        let data = match msg.deserialize() {
            Ok(data) => data,
            Err(e) => {
                error!("Could not deserialize message: {:?}", e);
                // TODO: DLQ
                consumer.ack(&msg).await?;
                continue;
            }
        };

        match process_and_record(&state, &data, consumer_group).await {
            Ok(processed) => {
                if processed {
                    info!(id = %data.event_id, "Event processed successfully");
                } else {
                    warn!(id = %data.event_id, "Event skipped (already processed)");
                }
                consumer.ack(&msg).await?;
            }
            Err(e) => {
                error!(id = %data.event_id, "Critical error processing event: {:?}", e);
                // nack retry
                consumer.nack(&msg).await?;
            }
        }
    }

    Ok(())
}

async fn process_and_record(state: &Arc<AppState>, event: &EventPayload, group: &str) -> Result<bool> {
    let now: i64 = chrono::Utc::now().timestamp();

    let result: sqlx::postgres::PgQueryResult = sqlx::query(
        "INSERT INTO processed (id, consumer_group, event_id, processed_at, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (consumer_group, event_id) DO NOTHING"
    )
    .bind(Uuid::new_v4())
    .bind(group)
    .bind(event.event_id)
    .bind(now)
    .bind("SUCCESS")
    .execute(&state.pool)
    .await?;

    // Si rows_affected es 0, significa que el UNIQUE (consumer_group, event_id) saltó
    if result.rows_affected() == 0 {
        return Ok(false);
    }

    // execute_business_logic(event).await?;

    Ok(true)
}