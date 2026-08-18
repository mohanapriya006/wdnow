import os
from dotenv import load_dotenv

from app.ai.prompts import (
    SYSTEM_PROMPT,
    build_recommendation_prompt,
)

load_dotenv()


class LLMExplanationService:

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash",
        )
        self.client = None

        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.client = None

    def generate_explanation(
        self,
        *,
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
        # If Gemini client is active, try to generate AI response
        if self.client:
            try:
                from google.genai import types
                prompt = build_recommendation_prompt(
                    project_name=project_name,
                    required_skills=required_skills,
                    minimum_experience_years=minimum_experience_years,
                    required_location=required_location,
                    contractor_name=contractor_name,
                    contractor_skills=contractor_skills,
                    contractor_experience=contractor_experience,
                    contractor_location=contractor_location,
                    match_score=match_score,
                    skill_score=skill_score,
                    experience_score=experience_score,
                    location_score=location_score,
                    availability_score=availability_score,
                    matched_skills=matched_skills,
                    missing_skills=missing_skills,
                    recommendation=recommendation,
                    status=status,
                    current_project=current_project,
                )

                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.2,
                        max_output_tokens=200,
                    ),
                )

                if response and response.text:
                    return response.text.strip()
            except Exception:
                pass  # Fall back to heuristic explanation

        # Rule-based fallback explanation
        return self._generate_heuristic_explanation(
            contractor_name=contractor_name,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            contractor_experience=contractor_experience,
            minimum_experience_years=minimum_experience_years,
            location=contractor_location,
            required_location=required_location,
            status=status,
            current_project=current_project,
            match_score=match_score,
            recommendation=recommendation,
        )

    def _generate_heuristic_explanation(
        self,
        *,
        contractor_name: str,
        matched_skills: list[str],
        missing_skills: list[str],
        contractor_experience: float,
        minimum_experience_years: float,
        location: str | None,
        required_location: str | None,
        status: str,
        current_project: str | None,
        match_score: float,
        recommendation: str,
    ) -> str:
        parts = []

        if matched_skills:
            skills_str = ", ".join(s.title() for s in matched_skills[:3])
            parts.append(f"Demonstrates strong alignment with core skills ({skills_str})")
        elif missing_skills:
            parts.append("Has foundational capabilities but lacks some required skills")

        if contractor_experience > 0:
            if minimum_experience_years > 0 and contractor_experience >= minimum_experience_years:
                parts.append(f"meets experience criteria ({contractor_experience:g} yrs vs {minimum_experience_years:g} yrs req)")
            else:
                parts.append(f"brings {contractor_experience:g} years of professional experience")

        if status == "ON_BENCH":
            avail_str = "is currently on bench and available immediately"
        else:
            proj_str = f" to '{current_project}'" if current_project else ""
            avail_str = f"is currently active and assigned{proj_str}"

        parts_text = "; ".join(parts)
        if parts_text:
            return f"{contractor_name} {parts_text}. {contractor_name} {avail_str}."
        return f"{contractor_name} is evaluated as a {recommendation.replace('_', ' ').title()} ({match_score}% match). {contractor_name} {avail_str}."