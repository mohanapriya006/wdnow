from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_vendor
from app.models import Assignment, Timesheet
from app.schemas import TimesheetExplanationOut, TimesheetExplanationRequest
from app import timesheet_risk as risk
from app.ai.llm import LLMExplanationService
from app.ai.timesheet_explanation import explain_timesheet_risk
from app.ai.matching_engine import rank_contractors
from app.ai.schemas import (
    MatchRequest,
    MatchResponse,
    ProjectRecommendationsResponse,
)
from app.ai.services.contractor_matcher import ContractorMatcherService


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get(
    "/projects/{project_id}/recommendations",
    response_model=ProjectRecommendationsResponse,
)
def get_project_recommendations(
    project_id: str,
    top_n: int = Query(default=10, ge=1, le=50),
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    service = ContractorMatcherService(db)
    return service.get_recommendations_for_project(
        project_id=project_id,
        vendor_id=current_user.vendor_id,
        top_n=top_n,
    )


@router.post(
    "/match-contractors",
    response_model=MatchResponse,
)
def match_contractors(
    request: MatchRequest,
):
    recommendations = rank_contractors(request)

    if request.generate_explanations:
        try:
            llm_service = LLMExplanationService()

            for recommendation in recommendations:
                contractor = next(
                    (
                        contractor
                        for contractor in request.contractors
                        if contractor.id == recommendation.contractor_id
                    ),
                    None,
                )

                if contractor is None:
                    continue

                recommendation.explanation = (
                    llm_service.generate_explanation(
                        project_name=request.project_name,
                        required_skills=request.required_skills,
                        minimum_experience_years=request.minimum_experience_years,
                        required_location=request.location,
                        contractor_name=contractor.name,
                        contractor_skills=contractor.skills,
                        contractor_experience=contractor.experience_years,
                        contractor_location=contractor.location,
                        match_score=recommendation.match_score,
                        skill_score=recommendation.skill_score,
                        experience_score=recommendation.experience_score,
                        location_score=recommendation.location_score,
                        availability_score=recommendation.availability_score,
                        matched_skills=recommendation.matched_skills,
                        missing_skills=recommendation.missing_skills,
                        recommendation=recommendation.recommendation,
                        status=recommendation.status,
                        current_project=recommendation.current_project,
                    )
                )

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"LLM explanation failed: {str(exc)}",
            ) from exc

    return MatchResponse(
        project_name=request.project_name,
        total_contractors=len(request.contractors),
        recommendations=recommendations,
    )

@router.post(
    "/timesheet-explanation",
    response_model=TimesheetExplanationOut,
)
def timesheet_explanation(
    request: TimesheetExplanationRequest,
    current_user: CurrentUser = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Explain an already-detected contractor timesheet anomaly.

    RBAC is the security boundary, not the model. The chain is:
    JWT -> require_vendor -> the timesheet must belong to an assignment this
    vendor owns -> only then is a minimal, single-contractor context assembled
    and sent to Gemini. No other contractor's data can reach the prompt.

    The rule engine has already decided the risk level; this endpoint only puts
    that decision into words, and falls back to deterministic text if Gemini is
    unavailable.
    """
    sheet = (
        db.query(Timesheet)
        .join(Assignment, Timesheet.assignment_id == Assignment.id)
        .filter(
            Timesheet.id == request.timesheet_id,
            Assignment.vendor_id == current_user.vendor_id,
        )
        .first()
    )
    if not sheet:
        # Same response whether it does not exist or belongs to another vendor.
        raise HTTPException(status_code=404, detail="Timesheet not found.")

    profile = risk.risk_profile(db, sheet)
    total_hours = round(sum(float(e.total_hours or 0) for e in sheet.entries), 2)

    result = explain_timesheet_risk(
        contractor_name=sheet.assignment.contractor.name,
        week_start=sheet.week_start.isoformat(),
        week_end=sheet.week_end.isoformat(),
        total_hours=total_hours,
        risk_level=profile["severity"] or "NONE",
        anomalies=profile["anomalies"],
        days=profile["days"],
    )
    return TimesheetExplanationOut(**result)
