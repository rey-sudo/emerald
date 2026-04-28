use crate::{
    bootstrap::AppState,
    consumer::{MultiHandler, process_event_with_handler},
    model::EventEnveloped,
};

use futures::TryStreamExt;
use pulsar::{Consumer, Pulsar, SubType, TokioExecutor, consumer::DeadLetterPolicy};
use std::{error::Error, sync::Arc, time::Duration};
use tracing::{debug, error, info, warn};

pub async fn run_shared_consumer<L>(
    state: Arc<AppState>,
    topics: Vec<String>,
    handlers: Arc<L>,
) -> Result<(), Box<dyn Error + Send + Sync>>
where
    L: MultiHandler + Send + Sync + 'static,
{
    info!("Shared topics: {:?}", topics);

    // 1. Pulsar client
    let pulsar: Pulsar<_> = Pulsar::builder(&state.config.pulsar_url, TokioExecutor)
        .build()
        .await
        .map_err(|e| format!("Failed to create Pulsar client: {}", e))?;

    debug!("Connected to pulsar");

    // 2. Identity
    let subscription_name: String = format!("{}-shared", state.config.consumer_group);
    let consumer_name: String = format!(
        "{}-{}-{}",
        state.config.consumer_prefix,
        state.config.pod_name,
        std::process::id()
    );

    // 3. DLQ (separado por tipo)
    let consumer_dlq_policy: DeadLetterPolicy = DeadLetterPolicy {
        max_redeliver_count: 5,
        dead_letter_topic: format!("{}-shared-DLQ", state.config.consumer_group),
    };

    // 4. Consumer
    let mut consumer: Consumer<EventEnveloped, TokioExecutor> = pulsar
        .consumer()
        .with_topics(topics)
        .with_consumer_name(consumer_name)
        .with_subscription(&subscription_name)
        .with_subscription_type(SubType::Shared)
        .with_dead_letter_policy(consumer_dlq_policy)
        .build()
        .await
        .map_err(|e| format!("Failed to create Pulsar consumer: {}", e))?;

    info!("Shared loop started");

    // 5. Loop
    while let Some(msg) = consumer.try_next().await? {
        let event: EventEnveloped = match msg.deserialize() {
            Ok(data) => data,
            Err(e) => {
                error!("Could not deserialize message: {:?}", e);
                consumer.ack(&msg).await?;
                continue;
            }
        };

        // filtro
        if !handlers.can_handle(&event.entity_type) {
            info!("Event {} ignored by {}", event.event_id, handlers.name());
            consumer.ack(&msg).await?;
            continue;
        }

        // procesamiento
        match process_event_with_handler(&state, &event, handlers.as_ref()).await {
            Ok(processed) => {
                if processed {
                    info!(id = %event.event_id, "Event processed successfully");
                } else {
                    warn!(id = %event.event_id, "Event skipped (already processed)");
                }
                consumer.ack(&msg).await?;
            }
            Err(e) => {
                error!(id = %event.event_id, "Critical error processing event: {:?}", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
                consumer.nack(&msg).await?;
            }
        }
    }

    Ok(())
}
