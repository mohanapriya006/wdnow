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
from app.models import (
    Vendor,
    Contractor,
    Assignment,
    User,
    UserRole,
    VendorStatus,
    ContractorStatus,
    AssignmentStatus,
)
from app.security import hash_password

VENDOR_PASSWORD = "Vendor@123"
CONTRACTOR_PASSWORD = "Contractor@123"


def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_vendor = db.query(Vendor).filter(Vendor.email == "vendor@abcstaffing.com").first()
        if existing_vendor:
            print("Seed data already present — skipping.")
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

        assignment = Assignment(
            id="A001",
            vendor_id=vendor.id,
            contractor_id=priya.id,
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
        )
        db.add(assignment)

        db.commit()
        print("Seed data created successfully:")
        print(f"  Vendor:      vendor@abcstaffing.com / {VENDOR_PASSWORD}")
        print(f"  Contractor:  priya.sharma@example.com / {CONTRACTOR_PASSWORD} (has assignment A001)")
        print(f"  Contractor:  arun.kumar@example.com / {CONTRACTOR_PASSWORD} (no assignment yet)")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
