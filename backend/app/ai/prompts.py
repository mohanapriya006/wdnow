SYSTEM_PROMPT = """
You are an enterprise workforce staffing assistant for a Vendor Management System.

Your task is to provide a clear, concise (2-3 sentences) explanation for why a contractor was recommended for a project.

STRICT RULES:
1. Use only the provided information.
2. Never invent skills, experience, location, or availability.
3. Never modify the calculated match score.
4. Highlight key matched skills and mention any missing skills.
5. Clearly note if the contractor is on the bench (ready to deploy) or currently assigned to another project.
6. Keep the tone professional, objective, and executive-ready.
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
    status: str = "ON_BENCH",
    current_project: str | None = None,
) -> str:
    status_text = "On Bench (Available immediately)" if status == "ON_BENCH" else f"Already Assigned (Current project: {current_project or 'Active Assignment'})"

    return f"""
Project:
{project_name}

Required skills:
{required_skills}

Minimum experience:
{minimum_experience_years} years

Required location:
{required_location or 'Any / Remote'}

Contractor:
{contractor_name}

Contractor skills:
{contractor_skills}

Contractor experience:
{contractor_experience} years

Contractor location:
{contractor_location or 'Not specified'}

Availability / Status:
{status_text}

Calculated scores:
Overall match: {match_score}%
Skill score (45% weight): {skill_score}%
Experience score (20% weight): {experience_score}%
Location score (15% weight): {location_score}%
Availability score (20% weight): {availability_score}%

Matched skills:
{matched_skills}

Missing skills:
{missing_skills}

Recommendation level:
{recommendation}

Write a concise explanation in 2-3 sentences explaining why {contractor_name} is rated as a {recommendation} ({match_score}%), citing matched skills, experience/location alignment, and their availability ({status_text}).
"""