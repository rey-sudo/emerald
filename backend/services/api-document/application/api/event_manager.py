from uuid6 import uuid7
import json
import time

async def emit_event(
    connection, 
    specversion: int,
    entity_type: str, 
    entity_id: str, 
    event_type: str, 
    data: dict, 
    metadata: dict = None
):
    if metadata is None:
        metadata = {}
    
    event_id = str(uuid7())
    now_ms = int(time.time() * 1000)
    
    data_json = json.dumps(data, default=str)
    meta_json = json.dumps(metadata or {}, default=str)
    
    _SQL_QUERY = """
    INSERT INTO events (
        specversion, event_type, source, id, time, 
        entity_type, entity_id, data, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    """
    
    await connection.execute(
        _SQL_QUERY,
        specversion,              
        event_type,                
        'api-document',            
        event_id,               
        now_ms,        
        entity_type,              
        entity_id,                
        data_json,                  # data (JSONB)
        meta_json                   # metadata (JSONB)
    )
    
    