"""
Pydantic models for AI Teaching Assistant Agent
Defines request/response schemas for API endpoints
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any

class AgentRequest(BaseModel):
    """Request model for agent endpoints"""
    message: str
    user_id: str
    context: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    """Response model for agent endpoints"""
    response: str
    action_taken: Optional[str] = None
    success: bool
    data: Optional[Dict[str, Any]] = None 