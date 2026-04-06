from .router import router

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/healthz")
def health_check():
    return {"status": "ok"}

@router.get("/get-health")
def health_check():
    return {"status": "ok"}

@router.get("/ping")
def health_check():
    return {"status": "ok"}
