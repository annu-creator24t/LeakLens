import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db import db_manager
from app.routes import api_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("leaklens")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard HTTP security headers on all API responses."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.ENVIRONMENT.lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events management for startup and shutdown."""
    logger.info("Initializing LeakLens Backend Engine (Environment: %s)...", settings.ENVIRONMENT)
    await db_manager.connect()
    yield
    logger.info("Shutting down LeakLens Backend Engine...")
    await db_manager.disconnect()


app = FastAPI(
    title="LeakLens API",
    description="Deterministic Financial Reconciliation & AI-Powered Settlement Intelligence Engine",
    version="1.0.0",
    lifespan=lifespan
)

# 1. Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# 3. Global Sanitized Exception Handler (Zero internal trace/path/secret leakage)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception processing %s %s: %s", request.method, request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred while processing the financial request."}
    )


# Mount API routes
app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "project": "LeakLens",
        "tagline": "See where your money leaks.",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get("/health")
async def health():
    """Root health endpoint alias."""
    return {
        "status": "ok",
        "service": "leaklens-backend"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.effective_port,
        reload=(settings.ENVIRONMENT == "development")
    )
