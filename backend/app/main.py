from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import Base, engine
from app.routers import auth, vendors, contractors, assignments, projects, timesheets, invoices, milestones, ai
from app.migrations import upgrade_schema, upgrade_timesheet_schema, upgrade_invoice_schema

# Create tables if they don't exist yet (idempotent). For a real production
# rollout you'd use Alembic migrations instead of create_all.
Base.metadata.create_all(bind=engine)
# Order matters: every ALTER TABLE must land before a migration step queries the
# ORM, because the mapped classes already reference the new columns.
upgrade_schema()
upgrade_invoice_schema()
upgrade_timesheet_schema()

app = FastAPI(
    title="VNDLY-Inspired Contingent Workforce Management API",
    description="Vendor / Contractor / Assignment core platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(loc) for loc in e["loc"] if loc != "body"), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation failed.", "errors": errors},
    )


app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(contractors.router)
app.include_router(assignments.router)
app.include_router(projects.router)
app.include_router(timesheets.router)
app.include_router(invoices.router)
app.include_router(milestones.router)
app.include_router(ai.router)


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "vndly-cwm-api"}


@app.get("/", tags=["health"])
def root():
    return {"message": "VNDLY CWM API is running. See /docs for API documentation."}
