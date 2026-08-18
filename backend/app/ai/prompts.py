SYSTEM_PROMPT = """
You are an enterprise workforce staffing assistant.

Your task is to explain why a contractor was recommended
for a project.

STRICT RULES:
1. Use only the information provided.
2. Never invent skills, experience, location, or availability.
3. Never modify the calculated match score.
4. Never claim a missing skill is present.
5. Be concise and professional.
6. Clearly mention strengths and gaps.
7. Your response must be suitable for a vendor hiring manager.
"""


def build_recommendation_prompt(
    project_name: str,
    required_skills: list[str],
    minimum_experience_years: float,
    required_location: str | None,
    contractor_name: str,
    contractor_skills: list[str],
    contractor_experience: float,
    contractor_location: str | None,
    match_score: float,
    skill_score: float,
    experience_score: float,
    location_score: float,
    availability_score: float,
    matched_skills: list[str],
    missing_skills: list[str],
    recommendation: str,
) -> str:

    return f"""
Project:
{project_name}

Required skills:
{required_skills}

Minimum experience:
{minimum_experience_years} years

Required location:
{required_location}

Contractor:
{contractor_name}

Contractor skills:
{contractor_skills}

Contractor experience:
{contractor_experience} years

Contractor location:
{contractor_location}

Calculated scores:
Overall match: {match_score}
Skill score: {skill_score}
Experience score: {experience_score}
Location score: {location_score}
Availability score: {availability_score}

Matched skills:
{matched_skills}

Missing skills:
{missing_skills}

Recommendation:
{recommendation}

Write a concise explanation in 2-4 sentences.
Explain:
- why the contractor matches
- their strongest areas
- any missing skills or concerns
- why the calculated recommendation makes sense

Do not change any score.
"""