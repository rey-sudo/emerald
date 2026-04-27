use crate::{
    bootstrap::AppState,
    consumer::{MultiHandler, process_event_with_handler},
    model::EventEnveloped,
};

use futures::TryStreamExt;
use pulsar::{Consumer, Pulsar, SubType, TokioExecutor, consumer::DeadLetterPolicy};
use std::{error::Error, sync::Arc, time::Duration};
use tracing::{error, info, warn};

pub async fn run_shared_consumer<L>(
    state: Arc<AppState>,
    topics: Vec<String>,
    handlers: Arc<L>,
) -> Result<(), Box<dyn Error + Send + Sync>>
where
    L: MultiHandler + Send + Sync + 'static,
{

    Ok(())

}