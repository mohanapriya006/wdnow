from app.ai.schemas import (
    DummyContractor,
    MatchRequest,
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
    request: MatchRequest,
) -> list[ContractorRecommendation]:

    recommendations = []

    for contractor in request.contractors:

        # Ignore inactive contractors
        if contractor.status.upper() == "INACTIVE":
            continue

        skill_score, matched_skills, missing_skills = (
            calculate_skill_score(
                request.required_skills,
                contractor.skills,
            )
        )

        experience_score = calculate_experience_score(
            request.minimum_experience_years,
            contractor.experience_years,
        )

        location_score = calculate_location_score(
            request.location,
            contractor.location,
        )

        availability_score = calculate_availability_score(
            contractor.status,
        )

        final_score = calculate_final_score(
            skill_score=skill_score,
            experience_score=experience_score,
            location_score=location_score,
            availability_score=availability_score,
        )

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
                recommendation=classify_score(
                    final_score
                ),
            )
        )

    recommendations.sort(
        key=lambda x: x.match_score,
        reverse=True,
    )

    return recommendations[:request.top_n]