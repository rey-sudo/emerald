use crate::infrastructure::bootstrap::AppState;
use anyhow::{Context, Result};
use futures::TryStreamExt;
use pulsar::{
    Consumer, DeserializeMessage, Payload, Pulsar, SubType, TokioExecutor,
    consumer::DeadLetterPolicy,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct EventEnveloped {
    pub event_id: String,
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

pub async fn run(state: Arc<AppState>) -> Result<()> {
    info!("Starting consumer for topics: {:?}", state.config.topics);

    // Initialize the Pulsar client gateway.
    let pulsar: Pulsar<_> = Pulsar::builder(&state.config.pulsar_url, TokioExecutor)
        .build()
        .await
        .context("Failed to create Pulsar client")?;

    // Clone the consumer group name to obtain an owned String.
    let consumer_group: String = state.config.consumer_group.clone();

    // Create a unique name for this consumer.
    let consumer_name: String = format!(
        "{}-{}",
        state.config.consumer_prefix, state.config.consumer_suffix
    );

    let dlq_topic_name: String = format!("{}-{}-DLQ", "api-document-consumer", consumer_group);

    let dlq_policy: DeadLetterPolicy = DeadLetterPolicy {
        max_redeliver_count: 5,
        dead_letter_topic: dlq_topic_name,
    };

    // consumer_name : Assign a unique name to this specific instance for tracking.
    // consumer_group: Join the shared subscription group to distribute the workload.
    // KeyShared: to ensure ordered processing by entity ID.
    let mut consumer: Consumer<EventEnveloped, TokioExecutor> = pulsar
        .consumer()
        .with_topics(state.config.topics.clone())
        .with_consumer_name(consumer_name)
        .with_subscription(&consumer_group)
        .with_subscription_type(SubType::KeyShared)
        .with_dead_letter_policy(dlq_policy)
        .build()
        .await?;

    while let Some(msg) = consumer.try_next().await? {
        let data_str = String::from_utf8_lossy(&msg.payload.data);
        info!("Raw payload string: {}", data_str);

        // Deserialize the payload acknowledging malformed messages to prevent queue blocking.
        let data: EventEnveloped = match msg.deserialize() {
            Ok(data) => data,
            Err(e) => {
                error!("Could not deserialize message: {:?}", e);
                consumer.ack(&msg).await?;
                continue;
            }
        };

        match process_and_record(&state, &data, &consumer_group).await {
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

async fn process_and_record(
    state: &Arc<AppState>,
    event: &EventEnveloped,
    group: &str,
) -> Result<bool> {
    // 1. Iniciamos la transacción
    let mut tx: sqlx::Transaction<'_, sqlx::Postgres> = state
        .pool
        .begin()
        .await
        .context("Failed to begin transaction")?;

    let now: i64 = chrono::Utc::now().timestamp();

    let event_uuid: Uuid = Uuid::parse_str(&event.event_id)?;

    // 2. Intentamos insertar el registro de control de duplicados
    // Usamos &mut *tx para ejecutar la consulta dentro de la transacción
    let result = sqlx::query(
        "INSERT INTO processed (id, consumer_group, event_id, processed_at, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (consumer_group, event_id) DO NOTHING",
    )
    .bind(Uuid::now_v7())
    .bind(group)
    .bind(event_uuid)
    .bind(now)
    .bind("SUCCESS")
    .execute(&mut *tx) // <--- Ejecución en la transacción
    .await?;

    // 3. Si rows_affected es 0, el evento ya fue procesado con éxito anteriormente.
    // Simplemente salimos sin error, lo que disparará un ACK en el loop principal.
    if result.rows_affected() == 0 {
        return Ok(false);
    }

    // 4. LÓGICA DE NEGOCIO
    // Es CRUCIAL pasar la referencia de la transacción (&mut *tx) a tus otras funciones
    // para que todas las escrituras ocurran en el mismo bloque atómico.
    if let Err(e) = execute_business_logic(&mut tx, event).await {
        error!(
            "Business logic failed for event {}: {:?}",
            event.event_id, e
        );
        // Al salir con error y no llamar a tx.commit(),
        // sqlx hará rollback automático al caer 'tx' fuera de scope.
        return Err(e);
    }

    // 5. Consolidamos los cambios
    tx.commit().await.context("Failed to commit transaction")?;

    Ok(true)
}

// Ejemplo de función de negocio que también escribe en la DB
async fn execute_business_logic(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    event: &EventEnveloped,
) -> Result<()> {
    // Ejemplo: Actualizar el stock, crear una orden, etc.

    Ok(())
}
