from typing import List, Optional

from pydantic import BaseModel, Field


class DummyContractor(BaseModel):
    id: str
    name: str
    skills: List[str] = Field(default_factory=list)
    experience_years: float = 0
    location: Optional[str] = None
    status: str = "BENCH"


class MatchRequest(BaseModel):
    project_name: str

    required_skills: List[str] = Field(
        default_factory=list
    )

    minimum_experience_years: float = Field(
        default=0,
        ge=0,
    )

    location: Optional[str] = None

    contractors: List[DummyContractor] = Field(
        default_factory=list
    )

    top_n: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    generate_explanations: bool = True


class ContractorRecommendation(BaseModel):
    contractor_id: str
    name: str

    match_score: float

    skill_score: float
    experience_score: float
    location_score: float
    availability_score: float

    matched_skills: List[str] = Field(
        default_factory=list
    )

    missing_skills: List[str] = Field(
        default_factory=list
    )

    recommendation: str

    explanation: Optional[str] = None


class MatchResponse(BaseModel):
    project_name: str

    total_contractors: int

    recommendations: List[ContractorRecommendation] = Field(
        default_factory=list
    )