from fastapi import APIRouter

router = APIRouter(prefix="/api/document")

@router.get("/")
def root():
    return {"message": "TEST OK"}