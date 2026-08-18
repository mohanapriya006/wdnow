from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor, assert_vendor_owns_assignment
from app.models import Project, Assignment, AssignmentStatus, Milestone, MilestoneStatus, ProjectStatus
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut, MilestoneCreate, MilestoneUpdate, MilestoneOut
from datetime import date

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _validate_terms(start_date, end_date, pay_rate):
    if end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date.")


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
    _validate_terms(payload.start_date, payload.end_date, payload.pay_rate)
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
    _validate_terms(updates.get("start_date", project.start_date), updates.get("end_date", project.end_date), updates.get("pay_rate", project.pay_rate))
    for field, value in updates.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _out(project, db)


@router.get("/{project_id}/milestones", response_model=List[MilestoneOut])
def list_milestones(project_id: str, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.vendor_id == current_user.vendor_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found.")
    milestones = db.query(Milestone).filter(Milestone.project_id == project.id).order_by(Milestone.start_date).all()
    changed = False
    for milestone in milestones:
        if milestone.due_date < date.today() and milestone.status not in (MilestoneStatus.COMPLETED, MilestoneStatus.DELAYED):
            milestone.status = MilestoneStatus.DELAYED; changed = True
    if changed: db.commit()
    return milestones


@router.post("/{project_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(project_id: str, payload: MilestoneCreate, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.vendor_id == current_user.vendor_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found.")
    if payload.due_date < payload.start_date: raise HTTPException(status_code=400, detail="Due date cannot be before start date.")
    milestone = Milestone(project_id=project.id, **payload.model_dump()); db.add(milestone); db.commit(); db.refresh(milestone); return milestone


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(project_id: str, milestone_id: str, payload: MilestoneUpdate, current_user: CurrentUser = Depends(require_vendor), db: Session = Depends(get_db)):
    milestone = db.query(Milestone).join(Project).filter(Milestone.id == milestone_id, Milestone.project_id == project_id, Project.vendor_id == current_user.vendor_id).first()
    if not milestone: raise HTTPException(status_code=404, detail="Milestone not found.")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("due_date", milestone.due_date) < updates.get("start_date", milestone.start_date): raise HTTPException(status_code=400, detail="Due date cannot be before start date.")
    for field, value in updates.items(): setattr(milestone, field, value)
    all_milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()
    if all_milestones and all(item.status == MilestoneStatus.COMPLETED for item in all_milestones):
        milestone.project.status = ProjectStatus.COMPLETED
    elif milestone.project.status == ProjectStatus.COMPLETED:
        milestone.project.status = ProjectStatus.ACTIVE
    db.commit(); db.refresh(milestone); return milestone
