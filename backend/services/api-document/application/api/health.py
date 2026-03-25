from .router import router

@router.get("/health")
def health_check():
    return {"status": "ok"}