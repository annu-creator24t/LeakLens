from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.routes.data_generator import router as generator_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(upload_router)
api_router.include_router(generator_router)

__all__ = ["api_router"]
