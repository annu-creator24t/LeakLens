from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.routes.data_generator import router as generator_router
from app.routes.reconciliation import router as reconciliation_router
from app.routes.exceptions import router as exceptions_router
from app.routes.evaluation import router as evaluation_router
from app.routes.transactions import router as transactions_router
from app.routes.ai import router as ai_router
from app.routes.ask import router as ask_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(upload_router)
api_router.include_router(generator_router)
api_router.include_router(reconciliation_router)
api_router.include_router(exceptions_router)
api_router.include_router(evaluation_router)
api_router.include_router(transactions_router)
api_router.include_router(ai_router)
api_router.include_router(ask_router)

__all__ = ["api_router"]
