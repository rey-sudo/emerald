from .router import router

@router.get("/")
def root():
    return {"message": "TEST OK"}