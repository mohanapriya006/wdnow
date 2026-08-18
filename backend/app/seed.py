"""
Seed the database with demo data matching the hackathon spec:

Vendor V001 - ABC Staffing Solutions
Contractors:
  C001 - Priya Sharma (C++, Kafka, Redis / 5 years)
  C002 - Arun Kumar (Java, Spring Boot / 4 years)
Assignment A001 - Priya on "Payment Platform" as Senior C++ Developer, ACTIVE

Run with:  python -m app.seed
Safe to re-run: it skips creation if the vendor already exists.
"""
from datetime import date

from app.database import SessionLocal, engine, Base
from app.migrations import upgrade_schema
from app.models import (
    Vendor,
    Contractor,
    Assignment,
    Project,
    Milestone,
    TimesheetPriority,
    MilestoneStatus,
    User,
    UserRole,
    VendorStatus,
    ContractorStatus,
    AssignmentStatus,
    ProjectStatus,
)
from app.security import hash_password

VENDOR_PASSWORD = "Vendor@123"
CONTRACTOR_PASSWORD = "Contractor@123"

def ensure_showcase(db, vendor):
    """Idempotent extra accounts, projects and workflow states for UI demos."""
    rows = [("C003","Meera Iyer","meera.iyer@example.com","React, TypeScript, UX","6 years","Chennai, India",ContractorStatus.ACTIVE), ("C004","Rohan Das","rohan.das@example.com","Python, Airflow, SQL","5 years","Pune, India",ContractorStatus.ACTIVE), ("C005","Fatima Khan","fatima.khan@example.com","QA Automation, Cypress","4 years","Mumbai, India",ContractorStatus.BENCH), ("C006","Vikram Singh","vikram.singh@example.com","Java, AWS, Kubernetes","7 years","Delhi, India",ContractorStatus.ACTIVE), ("C007","Nisha Patel","nisha.patel@example.com","Business Analysis, Jira","5 years","Ahmedabad, India",ContractorStatus.BENCH)]
    for cid,name,email,skills,experience,location,state in rows:
        c=db.query(Contractor).filter(Contractor.email==email).first()
        if not c: c=Contractor(id=cid,vendor_id=vendor.id,name=name,email=email,skills=skills,experience=experience,location=location,status=state); db.add(c); db.flush()
        if not db.query(User).filter(User.email==email).first(): db.add(User(email=email,password_hash=hash_password(CONTRACTOR_PASSWORD),role=UserRole.CONTRACTOR,vendor_id=vendor.id,contractor_id=c.id))
    projects=[("P002","Customer Insights Hub","Data Engineer","Python, Airflow, SQL",date(2026,7,1),date(2026,12,31),"Pune, India","HYBRID",1250,ProjectStatus.ACTIVE,["Discovery","Pipelines","Executive launch"]),("P003","Mobile Commerce Refresh","Frontend Engineer","React, TypeScript, UX",date(2026,5,1),date(2026,8,15),"Chennai, India","REMOTE",1400,ProjectStatus.COMPLETED,["Experience design","Build & release"]),("P004","Cloud Operations Modernization","Cloud Engineer","Java, AWS, Kubernetes",date(2026,8,1),date(2027,2,28),"Delhi, India","HYBRID",1650,ProjectStatus.ACTIVE,["Platform baseline","Migration waves"])]
    for pid,name,role,skills,start,end,location,mode,pay,state,milestones in projects:
        p=db.query(Project).filter(Project.id==pid).first()
        if not p: p=Project(id=pid,vendor_id=vendor.id,name=name,description=f"Enterprise delivery program: {name}.",role=role,required_skills=skills,start_date=start,end_date=end,location=location,work_mode=mode,working_hours=40,pay_rate=pay,currency="INR",status=state);db.add(p);db.flush()
        for i,m in enumerate(milestones):
            if not db.query(Milestone).filter(Milestone.project_id==p.id,Milestone.name==m).first(): db.add(Milestone(project_id=p.id,name=m,start_date=start,due_date=end,description=f"{m} delivery milestone",priority=TimesheetPriority.HIGH,status=MilestoneStatus.COMPLETED if state==ProjectStatus.COMPLETED else (MilestoneStatus.IN_PROGRESS if i==1 else MilestoneStatus.UPCOMING)))
    for aid,cid,pid in [("A002","C004","P002"),("A003","C003","P003"),("A004","C006","P004")]:
        if not db.query(Assignment).filter(Assignment.id==aid).first():
            p=db.query(Project).filter(Project.id==pid).one();db.add(Assignment(id=aid,vendor_id=vendor.id,contractor_id=cid,project_id=pid,project_name=p.name,role=p.role,start_date=p.start_date,end_date=p.end_date,working_hours=p.working_hours,pay_rate=p.pay_rate,bill_rate=p.pay_rate,currency=p.currency,status=AssignmentStatus.COMPLETED if p.status==ProjectStatus.COMPLETED else AssignmentStatus.ACTIVE,description=p.description,required_skills=p.required_skills,location=p.location,work_mode=p.work_mode))


def run_seed():
    Base.metadata.create_all(bind=engine)
    upgrade_schema()
    db = SessionLocal()
    try:
        existing_vendor = db.query(Vendor).filter(Vendor.email == "vendor@abcstaffing.com").first()
        if existing_vendor:
            ensure_showcase(db, existing_vendor)
            db.commit()
            print("Showcase seed data ensured.")
            return

        vendor = Vendor(
            id="V001",
            name="ABC Staffing Solutions",
            email="vendor@abcstaffing.com",
            phone="+91-9876500000",
            address="12 MG Road, Bengaluru, Karnataka, India",
            tax_id="GSTIN29ABCDE1234F1Z5",
            status=VendorStatus.ACTIVE,
        )
        db.add(vendor)
        db.flush()

        vendor_user = User(
            email="vendor@abcstaffing.com",
            password_hash=hash_password(VENDOR_PASSWORD),
            role=UserRole.VENDOR,
            vendor_id=vendor.id,
        )
        db.add(vendor_user)

        priya = Contractor(
            id="C001",
            vendor_id=vendor.id,
            name="Priya Sharma",
            email="priya.sharma@example.com",
            phone="+91-9876543210",
            skills="C++, Kafka, Redis",
            experience="5 years",
            location="Bengaluru, India",
            status=ContractorStatus.ACTIVE,
        )
        arun = Contractor(
            id="C002",
            vendor_id=vendor.id,
            name="Arun Kumar",
            email="arun.kumar@example.com",
            phone="+91-9876512345",
            skills="Java, Spring Boot",
            experience="4 years",
            location="Hyderabad, India",
            status=ContractorStatus.BENCH,
        )
        db.add_all([priya, arun])
        db.flush()

        priya_user = User(
            email="priya.sharma@example.com",
            password_hash=hash_password(CONTRACTOR_PASSWORD),
            role=UserRole.CONTRACTOR,
            vendor_id=vendor.id,
            contractor_id=priya.id,
        )
        arun_user = User(
            email="arun.kumar@example.com",
            password_hash=hash_password(CONTRACTOR_PASSWORD),
            role=UserRole.CONTRACTOR,
            vendor_id=vendor.id,
            contractor_id=arun.id,
        )
        db.add_all([priya_user, arun_user])

        project = Project(
            id="P001", vendor_id=vendor.id, name="Payment Platform",
            description="Build and operate the next-generation payment processing platform.",
            role="Senior C++ Developer", required_skills="C++, Kafka, Redis",
            start_date=date(2026, 9, 1), end_date=date(2027, 2, 28),
            location="Bengaluru, India", work_mode="HYBRID", working_hours=40,
            pay_rate=1500.0, currency="INR",
        )
        db.add(project)
        db.add_all([
            Milestone(project_id=project.id, name="Requirements & Design", start_date=date(2026,9,1), due_date=date(2026,9,30), description="Finalize architecture and requirements", priority=TimesheetPriority.HIGH, status=MilestoneStatus.UPCOMING),
            Milestone(project_id=project.id, name="Core Development", start_date=date(2026,10,1), due_date=date(2026,11,30), description="Complete payment engine", priority=TimesheetPriority.CRITICAL, status=MilestoneStatus.UPCOMING),
            Milestone(project_id=project.id, name="Integration", start_date=date(2026,12,1), due_date=date(2027,1,15), description="Integrate Kafka and Redis services", priority=TimesheetPriority.HIGH, status=MilestoneStatus.UPCOMING),
            Milestone(project_id=project.id, name="Testing & QA", start_date=date(2027,1,16), due_date=date(2027,2,10), description="Complete testing", priority=TimesheetPriority.HIGH, status=MilestoneStatus.UPCOMING),
            Milestone(project_id=project.id, name="Production Release", start_date=date(2027,2,11), due_date=date(2027,2,28), description="Go-live", priority=TimesheetPriority.CRITICAL, status=MilestoneStatus.UPCOMING),
        ])

        assignment = Assignment(
            id="A001",
            vendor_id=vendor.id,
            contractor_id=priya.id,
            project_id=project.id,
            project_name="Payment Platform",
            role="Senior C++ Developer",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 2, 28),
            working_hours=40,
            pay_rate=1500.0,
            bill_rate=2000.0,
            currency="INR",
            status=AssignmentStatus.ACTIVE,
            notes="Initial seeded assignment for hackathon demo.",
            description=project.description,
            required_skills=project.required_skills,
            location=project.location,
            work_mode=project.work_mode,
        )
        db.add(assignment)
        ensure_showcase(db, vendor)

        db.commit()
        print("Seed data created successfully:")
        print(f"  Vendor:      vendor@abcstaffing.com / {VENDOR_PASSWORD}")
        print(f"  Contractor:  priya.sharma@example.com / {CONTRACTOR_PASSWORD} (has assignment A001)")
        print(f"  Contractor:  arun.kumar@example.com / {CONTRACTOR_PASSWORD} (no assignment yet)")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
