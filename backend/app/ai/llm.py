import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.ai.prompts import (
    SYSTEM_PROMPT,
    build_recommendation_prompt,
)

load_dotenv()


class LLMExplanationService:

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured."
            )

        self.client = genai.Client(
            api_key=api_key
        )

        self.model = os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash",
        )

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
    ) -> str:

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

        if not response.text:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        return response.text.strip()