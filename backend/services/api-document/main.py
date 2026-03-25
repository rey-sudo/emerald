from fastapi import FastAPI
from config import settings
from application.api.routes import router
from infrastructure.logger import setup_logger

setup_logger()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    debug=settings.debug
)

app.include_router(router)

@app.on_event("startup")
async def startup_event():
    print("Running api-document service")

@app.on_event("shutdown")
async def shutdown_event():
    print("Stopping api-document service")