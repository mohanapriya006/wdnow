from fastapi import APIRouter, HTTPException

from app.ai.llm import LLMExplanationService
from app.ai.matching_engine import rank_contractors
from app.ai.schemas import (
    MatchRequest,
    MatchResponse,
)


router = APIRouter()


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
                        if contractor.id
                        == recommendation.contractor_id
                    ),
                    None,
                )

                if contractor is None:
                    continue

                recommendation.explanation = (
                    llm_service.generate_explanation(
                        project_name=request.project_name,
                        required_skills=request.required_skills,
                        minimum_experience_years=(
                            request.minimum_experience_years
                        ),
                        required_location=request.location,
                        contractor_name=contractor.name,
                        contractor_skills=contractor.skills,
                        contractor_experience=(
                            contractor.experience_years
                        ),
                        contractor_location=contractor.location,
                        match_score=recommendation.match_score,
                        skill_score=recommendation.skill_score,
                        experience_score=(
                            recommendation.experience_score
                        ),
                        location_score=(
                            recommendation.location_score
                        ),
                        availability_score=(
                            recommendation.availability_score
                        ),
                        matched_skills=(
                            recommendation.matched_skills
                        ),
                        missing_skills=(
                            recommendation.missing_skills
                        ),
                        recommendation=(
                            recommendation.recommendation
                        ),
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