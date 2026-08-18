import re

from app.ai.schemas import ContractorCandidate


def parse_experience(value) -> float:
    """
    Convert values such as:
        "5 years"
        "4 years"
        5
        4.5
    into float years.
    """

    if value is None:
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()

    match = re.search(r"(\d+(?:\.\d+)?)", text)

    if not match:
        return 0.0

    return float(match.group(1))


def normalize_skill(skill: str) -> str:
    """
    Normalize common skill naming variations.
    """

    value = skill.strip().lower()

    aliases = {
        "react.js": "react",
        "reactjs": "react",
        "react js": "react",
        "node.js": "node",
        "nodejs": "node",
        "javascript": "javascript",
        "java script": "javascript",
        "typescript": "typescript",
        "ts": "typescript",
        "rest api": "rest api",
        "rest apis": "rest api",
        "restful api": "rest api",
        "springboot": "spring boot",
        "spring boot": "spring boot",
    }

    return aliases.get(value, value)


def parse_skills(value) -> list[str]:
    """
    Convert database skill string into normalized list.

    Example:
        "Java, Spring Boot"
        ->
        ["java", "spring boot"]
    """

    if value is None:
        return []

    if isinstance(value, list):
        raw_skills = value
    else:
        raw_skills = str(value).split(",")

    return [
        normalize_skill(skill)
        for skill in raw_skills
        if str(skill).strip()
    ]


def contractor_to_candidate(contractor) -> ContractorCandidate:
    """
    Convert your SQLAlchemy Contractor model into
    the AI-independent schema.
    """

    return ContractorCandidate(
        id=contractor.id,
        name=contractor.name,
        skills=parse_skills(contractor.skills),
        experience_years=parse_experience(contractor.experience),
        location=contractor.location,
        status=contractor.status,
    )