from typing import List, Optional
from pydantic import BaseModel, Field


class ContractorCandidate(BaseModel):
    id: str
    name: str
    skills: List[str] = Field(default_factory=list)
    experience_years: float = 0
    experience: Optional[str] = None
    location: Optional[str] = None
    status: str = "ON_BENCH"  # "ON_BENCH" | "ALREADY_ASSIGNED" | "BENCH" | "ACTIVE"
    current_project: Optional[str] = None
    current_assignment_id: Optional[str] = None


class DummyContractor(ContractorCandidate):
    pass


class AssignmentMatchRequest(BaseModel):
    project_id: Optional[str] = None
    project_name: str
    role: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    minimum_experience_years: float = Field(default=0, ge=0)
    location: Optional[str] = None
    top_n: int = Field(default=10, ge=1, le=50)
    generate_explanations: bool = True


class MatchRequest(BaseModel):
    project_name: str
    required_skills: List[str] = Field(default_factory=list)
    minimum_experience_years: float = Field(default=0, ge=0)
    location: Optional[str] = None
    contractors: List[ContractorCandidate] = Field(default_factory=list)
    top_n: int = Field(default=5, ge=1, le=50)
    generate_explanations: bool = True


class ContractorRecommendation(BaseModel):
    contractor_id: str
    name: str
    match_score: float
    skill_score: float
    experience_score: float
    location_score: float
    availability_score: float
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    experience_years: float = 0
    experience: Optional[str] = None
    location: Optional[str] = None
    status: str = "ON_BENCH"  # "ON_BENCH" or "ALREADY_ASSIGNED"
    current_project: Optional[str] = None
    current_assignment_id: Optional[str] = None
    recommendation: str  # "STRONG_MATCH", "GOOD_MATCH", "POTENTIAL_MATCH", "WEAK_MATCH"
    explanation: Optional[str] = None


class MatchResponse(BaseModel):
    project_name: str
    total_contractors: int
    recommendations: List[ContractorRecommendation] = Field(default_factory=list)


class ProjectRecommendationsResponse(BaseModel):
    project_id: str
    project_name: str
    role: str
    required_skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    total_candidates: int
    recommendations: List[ContractorRecommendation] = Field(default_factory=list)