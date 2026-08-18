from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor, assert_vendor_owns_assignment
from app.models import Project, Assignment, AssignmentStatus
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _validate_terms(start_date, end_date, pay_rate, bill_rate):
    if end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date.")
    if bill_rate < pay_rate:
        raise HTTPException(status_code=400, detail="Bill rate cannot be lower than pay rate.")


def _out(project: Project, db: Session) -> ProjectOut:
    count = db.query(Assignment).filter(Assignment.project_id == project.id,
                                         Assignment.status == AssignmentStatus.ACTIVE).count()
    return ProjectOut(**ProjectOut.model_validate(project).model_dump(exclude={"assigned_contractors_count"}), assigned_contractors_count=count)


@router.get("", response_model=List[ProjectOut])
def list_projects(current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.vendor_id == current_user.vendor_id).order_by(Project.created_at.desc()).all()
    return [_out(project, db) for project in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    _validate_terms(payload.start_date, payload.end_date, payload.pay_rate, payload.bill_rate)
    project = Project(vendor_id=current_user.vendor_id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return _out(project, db)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    assert_vendor_owns_assignment(current_user.vendor_id, project.vendor_id)
    return _out(project, db)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    assert_vendor_owns_assignment(current_user.vendor_id, project.vendor_id)
    updates = payload.model_dump(exclude_unset=True)
    _validate_terms(updates.get("start_date", project.start_date), updates.get("end_date", project.end_date),
                    updates.get("pay_rate", project.pay_rate), updates.get("bill_rate", project.bill_rate))
    for field, value in updates.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _out(project, db)
