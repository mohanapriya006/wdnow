from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.adapters.contractor_adapter import (
    contractor_to_candidate,
    parse_experience,
    parse_skills,
)
from app.ai.llm import LLMExplanationService
from app.ai.matching_engine import rank_contractors
from app.ai.schemas import (
    AssignmentMatchRequest,
    ContractorRecommendation,
    ProjectRecommendationsResponse,
)
from app.models import (
    Assignment,
    AssignmentStatus,
    Contractor,
    ContractorStatus,
    Project,
)


class ContractorMatcherService:
    """
    Orchestrates contractor retrieval, PostgreSQL querying, and AI job matching.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_recommendations_for_project(
        self,
        project_id: str,
        vendor_id: str,
        top_n: int = 10,
    ) -> ProjectRecommendationsResponse:
        # 1. Fetch project and verify existence and vendor ownership
        project = (
            self.db.query(Project)
            .filter(Project.id == project_id)
            .first()
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )

        if project.vendor_id != vendor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project.",
            )

        # 2. Fetch all contractors belonging to this vendor (excluding INACTIVE)
        contractors = (
            self.db.query(Contractor)
            .filter(
                Contractor.vendor_id == vendor_id,
                Contractor.status != ContractorStatus.INACTIVE,
            )
            .all()
        )

        # 3. For each contractor, check active assignments to determine ON_BENCH vs ALREADY_ASSIGNED
        candidates = []
        for contractor in contractors:
            active_assignment = (
                self.db.query(Assignment)
                .filter(
                    Assignment.contractor_id == contractor.id,
                    Assignment.status == AssignmentStatus.ACTIVE,
                )
                .first()
            )

            if active_assignment:
                avail_status = "ALREADY_ASSIGNED"
                curr_proj = active_assignment.project_name
                curr_assign_id = active_assignment.id
            else:
                avail_status = "ON_BENCH"
                curr_proj = None
                curr_assign_id = None

            candidate = contractor_to_candidate(
                contractor,
                status=avail_status,
                current_project=curr_proj,
                current_assignment_id=curr_assign_id,
            )
            candidates.append(candidate)

        # 4. Parse project criteria
        req_skills = parse_skills(project.required_skills)
        min_exp = parse_experience(project.description)

        match_request = AssignmentMatchRequest(
            project_id=project.id,
            project_name=project.name,
            role=project.role,
            required_skills=req_skills,
            minimum_experience_years=min_exp,
            location=project.location,
            top_n=top_n,
            generate_explanations=True,
        )

        # 5. Rank recommendations using matching engine (45/20/15/20)
        recommendations = rank_contractors(
            assignment=match_request,
            contractors=candidates,
        )

        # 6. Generate AI explanations
        llm_service = LLMExplanationService()
        for rec in recommendations:
            cand = next((c for c in candidates if c.id == rec.contractor_id), None)
            if not cand:
                continue

            rec.explanation = llm_service.generate_explanation(
                project_name=project.name,
                required_skills=req_skills,
                minimum_experience_years=min_exp,
                required_location=project.location,
                contractor_name=cand.name,
                contractor_skills=cand.skills,
                contractor_experience=cand.experience_years,
                contractor_location=cand.location,
                match_score=rec.match_score,
                skill_score=rec.skill_score,
                experience_score=rec.experience_score,
                location_score=rec.location_score,
                availability_score=rec.availability_score,
                matched_skills=rec.matched_skills,
                missing_skills=rec.missing_skills,
                recommendation=rec.recommendation,
                status=rec.status,
                current_project=rec.current_project,
            )

        return ProjectRecommendationsResponse(
            project_id=project.id,
            project_name=project.name,
            role=project.role,
            required_skills=req_skills,
            location=project.location,
            total_candidates=len(candidates),
            recommendations=recommendations,
        )

    def match(
        self,
        request: AssignmentMatchRequest,
    ) -> tuple[int, list[ContractorRecommendation]]:
        contractors = (
            self.db.query(Contractor)
            .filter(Contractor.status != ContractorStatus.INACTIVE)
            .all()
        )

        candidates = [
            contractor_to_candidate(contractor)
            for contractor in contractors
        ]

        recommendations = rank_contractors(
            assignment=request,
            contractors=candidates,
        )

        recommendations = recommendations[: request.top_n]

        return len(contractors), recommendations