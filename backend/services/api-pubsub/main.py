import asyncio
import logging
import json
from typing import AsyncGenerator
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from sse_starlette.sse import EventSourceResponse

# Configuración de Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-pubsub")

app = FastAPI(title="Microservicio API-PubSub")

# Configuración de Redis
REDIS_URL = "redis://localhost:6379/0"
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "api-pubsub"}

@app.get("/stream/{user_id}")
async def stream_events(request: Request, user_id: str):
    """
    Endpoint SSE que suscribe al usuario a su canal privado de Redis.
    """
    
    async def event_generator() -> AsyncGenerator:
        # 1. Crear instancia de pubsub
        pubsub = redis_client.pubsub()
        channel_name = f"user_events_{user_id}"
        
        await pubsub.subscribe(channel_name)
        logger.info(f"Usuario {user_id} conectado al canal {channel_name}")

        try:
            while True:
                # 2. Verificar si el cliente cerró la conexión
                if await request.is_disconnected():
                    logger.info(f"Cliente {user_id} desconectado.")
                    break

                # 3. Escuchar mensajes de Redis (con timeout para no bloquear)
                message = await pubsub.get_message(ignore_subscribe_counts=True, timeout=1.0)
                
                if message and message["type"] == "message":
                    # El payload enviado por el microservicio de Docs
                    data_payload = message["data"]
                    
                    # 4. Enviar el evento al Frontend
                    yield {
                        "event": "document_update", # Nombre del evento para el frontend
                        "data": data_payload,       # Datos en JSON
                        "retry": 5000               # Tiempo de reconexión en ms si falla
                    }

                # Pequeño respiro para el loop asíncrono
                await asyncio.sleep(0.01)

        except Exception as e:
            logger.error(f"Error en el stream para {user_id}: {e}")
        finally:
            # 5. Limpieza al desconectar
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
            logger.info(f"Recursos liberados para usuario {user_id}")

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
    
    
    
"""
EXAMPLE

import redis.asyncio as redis
import json

# Conexión a la misma instancia de Redis
r = redis.from_url("redis://localhost:6379/0")

async def notify_user(user_id: str, document_data: dict):
    channel = f"user_events_{user_id}"
    payload = json.dumps(document_data)
    await r.publish(channel, payload)

"""