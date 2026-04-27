use crate::{
    application::consumer::MultiHandler, infrastructure::bootstrap::AppState,
    model::SubscriptionType, otro::run_key_shared_consumer,
};
use std::{collections::HashMap, error::Error, sync::Arc};

pub async fn run<L>(state: Arc<AppState>, multi_handler: L) -> Result<(), Box<dyn Error + Send + Sync>>
where
    L: MultiHandler + Send + Sync + 'static,
{
    let topics: Vec<String> = state.config.topics.clone();
    let types: Vec<String> = state.config.topics_type.clone();

    let mut grouped: HashMap<SubscriptionType, Vec<String>> = HashMap::new();

    for (topic, t) in topics.iter().zip(types.iter()) {
        let sub_type: SubscriptionType = SubscriptionType::parse(t);
        grouped.entry(sub_type).or_default().push(topic.clone());
    }

    let m_handler: Arc<L> = Arc::new(multi_handler);

    let mut handles: Vec<tokio::task::JoinHandle<Result<(), Box<dyn Error + Send + Sync>>>> =
        vec![];

    for (sub_type, topics) in grouped {
        let state: Arc<AppState> = state.clone();
        let handlers: Arc<L> = m_handler.clone();

        let handle: tokio::task::JoinHandle<Result<(), Box<dyn Error + Send + Sync>>> = tokio::spawn(async move {
            match sub_type {
                SubscriptionType::KeyShared => {
                    run_key_shared_consumer(state, topics, handlers).await
                }
                SubscriptionType::Shared => {
                    // run_shared_consumer(state, topics, handlers).await
                    Ok(()) // O lo que corresponda
                }
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        // El primer ? captura errores de Tokio (panics),
        // el segundo ? captura errores de tu lógica (run_key_shared_consumer)
        handle.await??;
    }

    Ok(())
}
