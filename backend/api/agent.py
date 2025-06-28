"""
Agent API endpoints for AI Teaching Assistant
Handles main agent processing requests and auto-grading functionality
"""
import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from models import AgentRequest, AgentResponse
from auth import verify_auth_token, get_test_user, ensure_test_user_exists
from agent import MyloAgent, ActionHandlers
from agent.grading_agent import GradingAgent
from agent.pdf_processor import PDFProcessor
from database import supabase, get_authenticated_client
from config import SUPABASE_URL
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# Initialize agents and handlers
mylo = MyloAgent()
action_handlers = ActionHandlers(supabase)
grading_agent = GradingAgent()
pdf_processor = PDFProcessor()

# Grading request model
class GradingRequest(BaseModel):
    submission_id: str
    assignment_id: str
    course_id: str

class GradingResponse(BaseModel):
    success: bool
    grade: Optional[float] = None
    feedback: Optional[str] = None
    confidence: Optional[float] = None
    detailed_result: Optional[dict] = None
    error: Optional[str] = None

@router.post("/process", response_model=AgentResponse)
async def process_agent_request(
    request: AgentRequest,
    user = Depends(verify_auth_token),
    authorization: str = Header(None)
):
    """Main endpoint for processing agent requests"""
    try:
        logger.info(f"Processing request from user {user.id}: {request.message}")
        
        # Extract the token from the authorization header
        user_token = None
        if authorization and authorization.startswith("Bearer "):
            user_token = authorization.split(" ")[1]
        
        # Get thread history for context if thread_id is provided
        thread_history = []
        if request.thread_id:
            try:
                # Get previous messages in this thread for context
                messages_result = supabase.table("chat_messages").select("message, response").eq("thread_id", request.thread_id).order("created_at", desc=False).execute()
                thread_history = messages_result.data if messages_result.data else []
            except Exception as e:
                logger.warning(f"Could not fetch thread history: {e}")
        
        # Process message with Mylo to get intent and parameters
        intent_result = await mylo.process_message(
            message=request.message,
            user_id=user.id,
            thread_history=thread_history,
            context=request.context
        )
        
        # If there was an error in intent processing, return it
        if intent_result.get("intent") == "error":
            return AgentResponse(
                response=intent_result.get("response", "I encountered an error."),
                action_taken="error",
                success=False,
                data=intent_result
            )
        
        # Execute the action based on the intent - use authenticated user's ID
        intent = intent_result.get("intent", "unknown")
        parameters = intent_result.get("parameters", {})
        
        logger.info(f"Executing action: {intent} with params: {parameters}")
        
        # Handle conversational responses differently - use AI response directly
        if intent == "conversation":
            return AgentResponse(
                response=intent_result.get("response", "Hello! I'm here to help with your teaching tasks."),
                action_taken="conversation",
                success=True,
                thread_id=request.thread_id,
                data={
                    "intent_analysis": intent_result,
                    "type": "conversational"
                }
            )
        
        # For task-oriented intents, execute the action handler
        action_result = await action_handlers.execute(intent, parameters, user.id, user_token)
        
        # Determine the final response
        if action_result["success"]:
            response_message = action_result["message"]
            success = True
        else:
            response_message = f"I understood your request but {action_result['message']}"
            success = False
        
        return AgentResponse(
            response=response_message,
            action_taken=intent,
            success=success,
            thread_id=request.thread_id,
            data={
                "intent_analysis": intent_result,
                "action_result": action_result
            }
        )
        
    except Exception as e:
        logger.error(f"Error processing agent request: {e}")
        return AgentResponse(
            response="I encountered an error. Please try again.",
            action_taken="error",
            success=False,
            thread_id=request.thread_id,
            data={"error": str(e)}
        )

@router.post("/test", response_model=AgentResponse)
async def test_agent_request(
    request: AgentRequest,
    user: dict = Depends(get_test_user)
):
    """Test endpoint without authentication for development"""
    try:
        # Ensure test user exists in database before processing
        await ensure_test_user_exists()
        
        logger.info(f"TEST: Processing request from user {user['id']}: {request.message}")
        
        # Get thread history for context if thread_id is provided
        thread_history = []
        if request.thread_id:
            try:
                # Get previous messages in this thread for context
                messages_result = supabase.table("chat_messages").select("message, response").eq("thread_id", request.thread_id).order("created_at", desc=False).execute()
                thread_history = messages_result.data if messages_result.data else []
            except Exception as e:
                logger.warning(f"Could not fetch thread history: {e}")
        
        # Process message with Mylo to get intent and parameters
        intent_result = await mylo.process_message(
            message=request.message,
            user_id=user["id"],
            thread_history=thread_history,
            context=request.context
        )
        
        # If there was an error in intent processing, return it
        if intent_result.get("intent") == "error":
            return AgentResponse(
                response=intent_result.get("response", "I encountered an error."),
                action_taken="error",
                success=False,
                data=intent_result
            )
        
        # Execute the action based on the intent - use test user's valid UUID
        intent = intent_result.get("intent", "unknown")
        parameters = intent_result.get("parameters", {})
        
        logger.info(f"TEST: Executing action: {intent} with params: {parameters}")
        
        # Handle conversational responses differently - use AI response directly
        if intent == "conversation":
            return AgentResponse(
                response=intent_result.get("response", "Hello! I'm here to help with your teaching tasks."),
                action_taken="conversation",
                success=True,
                data={
                    "intent_analysis": intent_result,
                    "type": "conversational"
                }
            )
        
        # For task-oriented intents, execute the action handler
        action_result = await action_handlers.execute(intent, parameters, user["id"], None)
        
        # Determine the final response
        if action_result["success"]:
            response_message = action_result["message"]
            success = True
        else:
            response_message = f"I understood your request but {action_result['message']}"
            success = False
        
        return AgentResponse(
            response=response_message,
            action_taken=intent,
            success=success,
            data={
                "intent_analysis": intent_result,
                "action_result": action_result
            }
        )
        
    except Exception as e:
        logger.error(f"Error processing test agent request: {e}")
        return AgentResponse(
            response="I encountered an error. Please try again.",
            action_taken="error",
            success=False,
            data={"error": str(e)}
        )

@router.post("/generate-thread-title")
async def generate_thread_title(
    request: dict,
    user = Depends(verify_auth_token)
):
    """Generate a thread title based on first message exchange"""
    try:
        first_message = request.get("first_message", "")
        first_response = request.get("first_response", "")
        
        if not first_message or not first_response:
            return {"error": "Both first_message and first_response are required"}
        
        logger.info(f"Generating thread title for user {user.id}")
        
        # Use MyloAgent to generate the title
        title = await mylo.generate_thread_title(first_message, first_response)
        
        return {
            "success": True,
            "title": title
        }
        
    except Exception as e:
        logger.error(f"Error generating thread title: {e}")
        return {
            "success": False,
            "error": str(e),
            "title": " ".join(first_message.split()[:3])  # Fallback
        }

@router.post("/test/generate-thread-title")
async def test_generate_thread_title(
    request: dict,
    user: dict = Depends(get_test_user)
):
    """Test endpoint for generating thread titles"""
    try:
        first_message = request.get("first_message", "")
        first_response = request.get("first_response", "")
        
        if not first_message or not first_response:
            return {"error": "Both first_message and first_response are required"}
        
        logger.info(f"TEST: Generating thread title for user {user['id']}")
        
        # Use MyloAgent to generate the title
        title = await mylo.generate_thread_title(first_message, first_response)
        
        return {
            "success": True,
            "title": title
        }
        
    except Exception as e:
        logger.error(f"Error generating thread title: {e}")
        return {
            "success": False,
            "error": str(e),
            "title": " ".join(first_message.split()[:3])  # Fallback
        }

@router.post("/grade-submission", response_model=GradingResponse)
async def grade_submission(
    request: GradingRequest,
    user = Depends(verify_auth_token),
    authorization: str = Header(None)
):
    """Auto-grade a student submission using Mylo's grading agent"""
    try:
        logger.info(f"Auto-grading request from user {user.id} for submission {request.submission_id}")
        
        # Verify user is a teacher and has access to this course
        course_result = supabase.table("courses").select("*").eq("id", request.course_id).execute()
        if not course_result.data or course_result.data[0]["teacher_id"] != user.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not the teacher of this course")
        
        # Get submission data using service role client (bypasses RLS after teacher verification)
        admin_client = get_authenticated_client()  # Service role client
        submission_result = admin_client.table("submissions").select(
            "*, student:users(*), assignment:assignments(*)"
        ).eq("id", request.submission_id).execute()
        
        if not submission_result.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        submission = submission_result.data[0]
        assignment = submission["assignment"]
        
        # Verify assignment belongs to the course
        if assignment["course_id"] != request.course_id:
            raise HTTPException(status_code=400, detail="Assignment does not belong to the specified course")
        
        # Extract text from submission file
        submission_text = None
        
        if submission.get("file_path"):
            # Construct direct URL to Supabase Storage
            try:
                # Build the direct storage URL using environment variable
                storage_base_url = f"{SUPABASE_URL}/storage/v1/object/assignment-files/"
                file_url = storage_base_url + submission["file_path"]
                
                logger.info(f"Constructed file URL: {file_url}")
                
                # Extract text from the URL
                submission_text = await pdf_processor.extract_text_from_url(file_url)
                
            except Exception as e:
                logger.error(f"Error processing file via direct URL: {e}")
                # Fall back to trying the file_url if available
                if submission.get("file_url"):
                    logger.info("Falling back to file_url extraction")
                    submission_text = await pdf_processor.extract_text_from_url(submission["file_url"])
        elif submission.get("file_url"):
            # Try to extract from file_url (legacy submissions)
            submission_text = await pdf_processor.extract_text_from_url(submission["file_url"])
        elif submission.get("content"):
            # Use text content directly
            submission_text = submission["content"]
        
        if not submission_text:
            return GradingResponse(
                success=False,
                error="Could not extract text content from submission. The file may be corrupted, encrypted, or in an unsupported format."
            )
        
        # Prepare assignment details for grading
        assignment_details = {
            "title": assignment["title"],
            "description": assignment.get("description", ""),
            "total_points": assignment["total_points"]
        }
        
        # Get rubric if available
        rubric = assignment.get("rubric_markdown")
        
        # Grade the submission
        grading_result = await grading_agent.grade_submission(
            submission_content=submission_text,
            assignment_details=assignment_details,
            rubric=rubric,
            max_points=assignment["total_points"]
        )
        
        if grading_result["success"]:
            return GradingResponse(
                success=True,
                grade=grading_result["grade"],
                feedback=grading_result["feedback"],
                confidence=grading_result.get("detailed_result", {}).get("confidence_level", 0.8),
                detailed_result=grading_result.get("detailed_result")
            )
        else:
            return GradingResponse(
                success=False,
                error=grading_result.get("error", "Unknown error occurred during grading")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in auto-grading: {e}")
        return GradingResponse(
            success=False,
            error=f"Internal server error: {str(e)}"
        )

@router.post("/test/grade-submission", response_model=GradingResponse)
async def test_grade_submission(
    request: GradingRequest,
    user: dict = Depends(get_test_user)
):
    """Test endpoint for auto-grading without authentication"""
    try:
        await ensure_test_user_exists()
        logger.info(f"TEST: Auto-grading request from user {user['id']} for submission {request.submission_id}")
        
        # Get submission data using service role client (simplified for testing)
        admin_client = get_authenticated_client()  # Service role client
        submission_result = admin_client.table("submissions").select(
            "*, student:users(*), assignment:assignments(*)"
        ).eq("id", request.submission_id).execute()
        
        if not submission_result.data:
            return GradingResponse(
                success=False,
                error="Submission not found"
            )
        
        submission = submission_result.data[0]
        assignment = submission["assignment"]
        
        # Extract text from submission (for testing, we'll use a mock if extraction fails)
        submission_text = None
        
        if submission.get("file_path"):
            # Construct direct URL to Supabase Storage
            try:
                # Build the direct storage URL using environment variable
                storage_base_url = f"{SUPABASE_URL}/storage/v1/object/assignment-files/"
                file_url = storage_base_url + submission["file_path"]
                
                logger.info(f"TEST: Constructed file URL: {file_url}")
                
                # Extract text from the URL
                submission_text = await pdf_processor.extract_text_from_url(file_url)
                
            except Exception as e:
                logger.error(f"TEST: Error processing file via direct URL: {e}")
                # Fall back to trying the file_url if available
                if submission.get("file_url"):
                    logger.info("TEST: Falling back to file_url extraction")
                    submission_text = await pdf_processor.extract_text_from_url(submission["file_url"])
        elif submission.get("file_url"):
            submission_text = await pdf_processor.extract_text_from_url(submission["file_url"])
        elif submission.get("content"):
            submission_text = submission["content"]
        
        # For testing, use mock content if extraction fails
        if not submission_text:
            submission_text = "This is a mock submission content for testing the auto-grading functionality. The student has provided a comprehensive analysis of the topic with good supporting evidence."
        
        # Prepare assignment details
        assignment_details = {
            "title": assignment["title"],
            "description": assignment.get("description", ""),
            "total_points": assignment["total_points"]
        }
        
        rubric = assignment.get("rubric_markdown")
        
        # Grade the submission
        grading_result = await grading_agent.grade_submission(
            submission_content=submission_text,
            assignment_details=assignment_details,
            rubric=rubric,
            max_points=assignment["total_points"]
        )
        
        if grading_result["success"]:
            return GradingResponse(
                success=True,
                grade=grading_result["grade"],
                feedback=grading_result["feedback"],
                confidence=grading_result.get("detailed_result", {}).get("confidence_level", 0.8),
                detailed_result=grading_result.get("detailed_result")
            )
        else:
            return GradingResponse(
                success=False,
                error=grading_result.get("error", "Unknown error occurred during grading")
            )
        
    except Exception as e:
        logger.error(f"Error in test auto-grading: {e}")
        return GradingResponse(
            success=False,
            error=f"Internal server error: {str(e)}"
        )