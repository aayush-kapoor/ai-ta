"""
Pydantic models for AI Teaching Assistant Agent
Defines request/response schemas for API endpoints
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class AgentRequest(BaseModel):
    """Request model for agent endpoints"""
    message: str
    user_id: Optional[str] = None  # User ID comes from authentication, not request body
    thread_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    """Response model for agent endpoints"""
    response: str
    action_taken: Optional[str] = None
    success: bool
    thread_id: Optional[str] = None
    thread_title: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

# Grading-specific models
class DetailedFeedback(BaseModel):
    """Model for detailed AI-generated feedback"""
    overall: str
    strengths: List[str]
    areas_for_improvement: List[str]
    missing_elements: List[str]
    specific_comments: List[Dict[str, Any]]

class RubricBreakdown(BaseModel):
    """Model for rubric breakdown analysis"""
    criteria: str
    points_earned: int
    max_points: int
    justification: str
    found_in_submission: bool
    quality_assessment: str

class GradeSubmissionRequest(BaseModel):
    """Request model for grading submissions"""
    grade: float
    feedback: str
    show_detailed_feedback: bool = False
    detailed_feedback_json: Optional[Dict[str, Any]] = None 