"""Small forward-only compatibility migration for deployments created before Projects.

Production teams should replace this bridge with versioned Alembic revisions;
it keeps the supplied PostgreSQL/SQLite demo data usable without data loss.
"""
from sqlalchemy import inspect, text
from app.database import engine, SessionLocal


def upgrade_timesheet_schema() -> None:
    """Additive-only bridge for the Contractor -> Vendor approval workflow.

    Adds the new Timesheet columns, widens the status enum with REJECTED, and
    backfills start/end timestamps plus worked_hours from the HH:MM clock
    strings already stored. Nothing is dropped and no row is deleted.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "time_entries" not in tables or "timesheets" not in tables:
        return

    entry_additions = {
        "start_at": "TIMESTAMP",
        "end_at": "TIMESTAMP",
        "worked_hours": "DOUBLE PRECISION DEFAULT 0 NOT NULL",
        "has_anomaly": "INTEGER DEFAULT 0 NOT NULL",
        "anomaly_severity": "VARCHAR(20)",
        "anomaly_details": "TEXT",
    }
    sheet_additions = {
        "rejected_at": "TIMESTAMP",
        "rejection_reason": "TEXT",
        "has_anomalies": "INTEGER DEFAULT 0 NOT NULL",
        "anomaly_count": "INTEGER DEFAULT 0 NOT NULL",
        "anomaly_severity": "VARCHAR(20)",
        "week_anomalies": "TEXT",
        "cross_anomalies": "TEXT",
    }
    if engine.dialect.name != "postgresql":
        # SQLite cannot express DOUBLE PRECISION / NOT NULL-with-default here.
        entry_additions["worked_hours"] = "FLOAT DEFAULT 0"
        entry_additions["has_anomaly"] = "INTEGER DEFAULT 0"
        sheet_additions["has_anomalies"] = "INTEGER DEFAULT 0"
        sheet_additions["anomaly_count"] = "INTEGER DEFAULT 0"

    existing_entry = {c["name"] for c in inspector.get_columns("time_entries")}
    existing_sheet = {c["name"] for c in inspector.get_columns("timesheets")}
    with engine.begin() as connection:
        for name, sql_type in entry_additions.items():
            if name not in existing_entry:
                connection.execute(text(f"ALTER TABLE time_entries ADD COLUMN {name} {sql_type}"))
        for name, sql_type in sheet_additions.items():
            if name not in existing_sheet:
                connection.execute(text(f"ALTER TABLE timesheets ADD COLUMN {name} {sql_type}"))

    # REJECTED joins the native PostgreSQL enum. ADD VALUE IF NOT EXISTS is
    # idempotent and must run outside an explicit transaction block.
    if engine.dialect.name == "postgresql":
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
            enum_exists = connection.execute(
                text("SELECT 1 FROM pg_type WHERE typname = 'timesheetstatus'")
            ).scalar()
            if enum_exists:
                connection.execute(
                    text("ALTER TYPE timesheetstatus ADD VALUE IF NOT EXISTS 'REJECTED'")
                )

    _backfill_timesheet_data()


def _backfill_timesheet_data() -> None:
    """Populate start_at/end_at/worked_hours for rows written before this change."""
    from app.models import TimeEntry
    from app.timesheet_rules import parse_hhmm, to_timestamp

    db = SessionLocal()
    try:
        stale = db.query(TimeEntry).filter(TimeEntry.start_at.is_(None)).all()
        changed = False
        for entry in stale:
            if entry.clock_in and entry.clock_out:
                try:
                    entry.start_at = to_timestamp(entry.work_date, parse_hhmm(entry.clock_in, "Start time"))
                    entry.end_at = to_timestamp(entry.work_date, parse_hhmm(entry.clock_out, "End time"))
                except ValueError:
                    continue
                worked = (entry.end_at - entry.start_at).total_seconds() / 3600.0
                entry.worked_hours = round(worked, 2)
            elif not entry.worked_hours:
                # Legacy manual-hours row: no clock times to recover, so the
                # recorded total is the best available worked figure.
                entry.worked_hours = round(float(entry.total_hours or 0), 2)
            changed = True

        # Run detection over weeks that predate the anomaly columns so the
        # vendor's normal/anomaly split is accurate on first load. APPROVED
        # weeks are skipped: their hours are already signed off and feed
        # invoicing, so nothing rewrites them.
        from app.models import Timesheet, TimesheetStatus
        from app.timesheet_rules import evaluate_timesheet

        pending = (
            db.query(Timesheet)
            .filter(
                Timesheet.status != TimesheetStatus.APPROVED,
                Timesheet.week_anomalies.is_(None),
                Timesheet.anomaly_count == 0,
            )
            .all()
        )
        for sheet in pending:
            evaluate_timesheet(sheet)
            changed = True

        if changed:
            db.commit()
    finally:
        db.close()


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
        # Billing is no longer a project-level concept. Assignment records
        # retain their historical commercial rate for invoice compatibility.
        project_columns = {column["name"] for column in inspector.get_columns("projects")} if "projects" in inspector.get_table_names() else set()
        if "bill_rate" in project_columns:
            if engine.dialect.name == "postgresql":
                connection.execute(text("ALTER TABLE projects DROP COLUMN bill_rate"))
            # SQLite older than 3.35 cannot safely drop a column; its value is
            # ignored by the ORM and API until a managed migration is run.

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


def upgrade_invoice_schema() -> None:
    """Additive bridge for the Invoice module.

    New tables are created by Base.metadata.create_all; this only adds the
    columns that hang off pre-existing tables and seeds each vendor's default
    tax configuration. Nothing is dropped and no row is deleted.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "timesheets" not in tables:
        return

    additions = {
        "timesheets": {"invoice_id": "VARCHAR(64)"},
        "milestones": {"completed_at": "DATE"},
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))

    _seed_default_tax_rules()
    _backfill_milestone_completion()


#: Sensible India-oriented starting point. These are seeded once per vendor and
#: are editable from the UI afterwards - the engine always reads the stored
#: rows, never these literals.
DEFAULT_TAX_RULES = [
    ("GST", "GST (output tax on services)", "TAX", 18.0, 1),
    ("TDS", "TDS u/s 194C (withheld at source)", "DEDUCTION", 10.0, 2),
]


def _seed_default_tax_rules() -> None:
    from app.models import InvoiceTaxRule, TaxRuleType, Vendor

    db = SessionLocal()
    try:
        configured = {row.vendor_id for row in db.query(InvoiceTaxRule.vendor_id).distinct()}
        created = False
        for vendor in db.query(Vendor).all():
            if vendor.id in configured:
                continue
            for code, label, rule_type, rate, order in DEFAULT_TAX_RULES:
                db.add(InvoiceTaxRule(
                    vendor_id=vendor.id, code=code, label=label,
                    rule_type=TaxRuleType(rule_type), rate_percent=rate, sort_order=order,
                ))
            created = True
        if created:
            db.commit()
    finally:
        db.close()


def _backfill_milestone_completion() -> None:
    """Give already-completed milestones an actual completion date.

    updated_at is the closest record of when the status was last changed, so it
    is used as the delivery date for rows that predate the column.
    """
    from app.models import Milestone, MilestoneStatus

    db = SessionLocal()
    try:
        stale = db.query(Milestone).filter(
            Milestone.status == MilestoneStatus.COMPLETED,
            Milestone.completed_at.is_(None),
        ).all()
        for milestone in stale:
            stamp = milestone.updated_at or milestone.created_at
            milestone.completed_at = stamp.date() if stamp else milestone.due_date
        if stale:
            db.commit()
    finally:
        db.close()
