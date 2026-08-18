from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import Base, engine
from app.routers import (
    auth,
    vendors,
    contractors,
    assignments,
    ai,
)


# Create tables if they don't exist yet.
# For a production application, use Alembic migrations instead.
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="VNDLY-Inspired Contingent Workforce Management API",
    description=(
        "Vendor / Contractor / Assignment core platform "
        "with AI workforce intelligence."
    ),
    version="1.0.0",
)


# -------------------------------------------------------------------
# CORS
# -------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# Validation Error Handler
# -------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = [
        {
            "field": ".".join(
                str(loc)
                for loc in error["loc"]
                if loc != "body"
            ),
            "message": error["msg"],
        }
        for error in exc.errors()
    ]

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation failed.",
            "errors": errors,
        },
    )


# -------------------------------------------------------------------
# Existing Application Routers
# -------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(contractors.router)
app.include_router(assignments.router)


# -------------------------------------------------------------------
# AI Router
# -------------------------------------------------------------------

app.include_router(
    ai.router,
    prefix="/api/ai",
    tags=["AI"],
)


# -------------------------------------------------------------------
# Health Check
# -------------------------------------------------------------------

@app.get(
    "/api/health",
    tags=["health"],
)
def health_check():
    return {
        "status": "ok",
        "service": "vndly-cwm-api",
    }


# -------------------------------------------------------------------
# Root
# -------------------------------------------------------------------

@app.get(
    "/",
    tags=["health"],
)
def root():
    return {
        "message": (
            "VNDLY CWM API is running. "
            "See /docs for API documentation."
        )
    }