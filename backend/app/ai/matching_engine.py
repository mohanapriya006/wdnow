from typing import List, Optional, Union
from app.ai.schemas import (
    MatchRequest,
    AssignmentMatchRequest,
    ContractorCandidate,
    ContractorRecommendation,
)
from app.ai.scoring import (
    calculate_skill_score,
    calculate_experience_score,
    calculate_location_score,
    calculate_availability_score,
    calculate_final_score,
    classify_score,
)


def rank_contractors(
    request: Optional[Union[MatchRequest, AssignmentMatchRequest]] = None,
    contractors: Optional[List[ContractorCandidate]] = None,
    assignment: Optional[AssignmentMatchRequest] = None,
) -> list[ContractorRecommendation]:
    """
    Rank contractor candidates for a project or assignment.
    """
    req = assignment or request
    candidate_list = contractors if contractors is not None else (req.contractors if hasattr(req, "contractors") else [])

    required_skills = getattr(req, "required_skills", []) or []
    minimum_experience_years = getattr(req, "minimum_experience_years", 0.0) or 0.0
    location = getattr(req, "location", None)
    top_n = getattr(req, "top_n", 5)

    recommendations = []

    for contractor in candidate_list:
        status_str = getattr(contractor, "status", "ON_BENCH")
        if hasattr(status_str, "value"):
            status_str = status_str.value
        status_str = str(status_str).upper()

        # Ignore inactive contractors
        if status_str == "INACTIVE":
            continue

        skill_score, matched_skills, missing_skills = calculate_skill_score(
            required_skills,
            contractor.skills,
        )

        experience_score = calculate_experience_score(
            minimum_experience_years,
            contractor.experience_years,
        )

        location_score = calculate_location_score(
            location,
            contractor.location,
        )

        availability_score = calculate_availability_score(
            status_str,
        )

        final_score = calculate_final_score(
            skill_score=skill_score,
            experience_score=experience_score,
            location_score=location_score,
            availability_score=availability_score,
        )

        # Standardize status representation: "ON_BENCH" or "ALREADY_ASSIGNED"
        standard_status = "ALREADY_ASSIGNED" if status_str in ("ACTIVE", "ALREADY_ASSIGNED") else "ON_BENCH"

        recommendations.append(
            ContractorRecommendation(
                contractor_id=contractor.id,
                name=contractor.name,
                match_score=final_score,
                skill_score=skill_score,
                experience_score=experience_score,
                location_score=location_score,
                availability_score=availability_score,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                experience_years=contractor.experience_years,
                experience=contractor.experience,
                location=contractor.location,
                status=standard_status,
                current_project=contractor.current_project,
                current_assignment_id=contractor.current_assignment_id,
                recommendation=classify_score(final_score),
            )
        )

    recommendations.sort(
        key=lambda x: x.match_score,
        reverse=True,
    )

    if top_n and top_n > 0:
        return recommendations[:top_n]
    return recommendations