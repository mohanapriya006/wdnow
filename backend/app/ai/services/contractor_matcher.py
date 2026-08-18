from sqlalchemy.orm import Session

from app.ai.adapters.contractor_adapter import contractor_to_candidate
from app.ai.matching_engine import rank_contractors
from app.ai.schemas import (
    AssignmentMatchRequest,
    ContractorRecommendation,
)
from app.models import Contractor


class ContractorMatcherService:
    """
    Orchestrates contractor retrieval and AI matching.

    This is the only AI service that directly knows about
    the existing Contractor database model.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_active_contractors(self):
        """
        Fetch only candidates who are currently active.
        """

        return (
            self.db.query(Contractor)
            .filter(Contractor.status == "ACTIVE")
            .all()
        )

    def match(
        self,
        request: AssignmentMatchRequest,
    ) -> tuple[int, list[ContractorRecommendation]]:

        contractors = self.get_active_contractors()

        candidates = [
            contractor_to_candidate(contractor)
            for contractor in contractors
        ]

        recommendations = rank_contractors(
            assignment=request,
            contractors=candidates,
        )

        recommendations = recommendations[:request.top_n]

        return len(contractors), recommendations