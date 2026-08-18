from typing import Iterable


def normalize_skill(skill: str) -> str:
    skill = skill.strip().lower()

    aliases = {
        "react.js": "react",
        "reactjs": "react",
        "react js": "react",

        "node.js": "node",
        "nodejs": "node",

        "springboot": "spring boot",

        "rest apis": "rest api",
        "restful api": "rest api",
    }

    return aliases.get(skill, skill)


def calculate_skill_score(
    required_skills: Iterable[str],
    contractor_skills: Iterable[str],
):
    required = {
        normalize_skill(skill)
        for skill in required_skills
        if skill.strip()
    }

    contractor = {
        normalize_skill(skill)
        for skill in contractor_skills
        if skill.strip()
    }

    if not required:
        return 100.0, [], []

    matched = sorted(required & contractor)
    missing = sorted(required - contractor)

    score = (
        len(matched) / len(required)
    ) * 100

    return round(score, 2), matched, missing


def calculate_experience_score(
    required_years: float,
    contractor_years: float,
) -> float:

    if required_years <= 0:
        return 100.0

    if contractor_years >= required_years:
        return 100.0

    score = (
        contractor_years / required_years
    ) * 100

    return round(max(0, score), 2)


def calculate_location_score(
    required_location: str | None,
    contractor_location: str | None,
) -> float:

    if not required_location or not contractor_location:
        return 50.0

    required = required_location.strip().lower()
    contractor = contractor_location.strip().lower()

    if required == contractor:
        return 100.0

    required_city = required.split(",")[0].strip()
    contractor_city = contractor.split(",")[0].strip()

    if required_city == contractor_city:
        return 100.0

    return 40.0


def calculate_availability_score(
    status: str,
) -> float:

    status = status.upper()

    if status in ("BENCH", "ON_BENCH"):
        return 100.0

    if status in ("ACTIVE", "ALREADY_ASSIGNED"):
        return 50.0

    if status == "INACTIVE":
        return 0.0

    return 50.0


def calculate_final_score(
    skill_score: float,
    experience_score: float,
    location_score: float,
    availability_score: float,
) -> float:

    score = (
        skill_score * 0.45
        + experience_score * 0.20
        + location_score * 0.15
        + availability_score * 0.20
    )

    return round(score, 2)


def classify_score(score: float) -> str:

    if score >= 85:
        return "STRONG_MATCH"

    if score >= 70:
        return "GOOD_MATCH"

    if score >= 50:
        return "POTENTIAL_MATCH"

    return "WEAK_MATCH"