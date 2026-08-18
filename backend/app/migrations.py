"""Small forward-only compatibility migration for deployments created before Projects.

Production teams should replace this bridge with versioned Alembic revisions;
it keeps the supplied PostgreSQL/SQLite demo data usable without data loss.
"""
from sqlalchemy import inspect, text
from app.database import engine, SessionLocal


def upgrade_schema() -> None:
    inspector = inspect(engine)
    if "assignments" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("assignments")}
    additions = {
        "project_id": "VARCHAR(64)",
        "description": "TEXT",
        "required_skills": "VARCHAR(1000)",
        "location": "VARCHAR(255)",
        "work_mode": "VARCHAR(30)",
    }
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE assignments ADD COLUMN {name} {sql_type}"))

    # Convert pre-Projects assignment rows into first-class projects without
    # losing their already-approved commercial terms.
    from app.models import Assignment, Project, ProjectStatus
    db = SessionLocal()
    try:
        legacy = db.query(Assignment).filter(Assignment.project_id.is_(None)).all()
        for assignment in legacy:
            project = Project(
                vendor_id=assignment.vendor_id, name=assignment.project_name,
                description=assignment.description or assignment.notes, role=assignment.role,
                required_skills=assignment.required_skills, start_date=assignment.start_date,
                end_date=assignment.end_date, location=assignment.location,
                work_mode=assignment.work_mode or "REMOTE", working_hours=assignment.working_hours,
                pay_rate=assignment.pay_rate, bill_rate=assignment.bill_rate,
                currency=assignment.currency, status=ProjectStatus.ACTIVE,
            )
            db.add(project)
            db.flush()
            assignment.project_id = project.id
        if legacy:
            db.commit()
    finally:
        db.close()
