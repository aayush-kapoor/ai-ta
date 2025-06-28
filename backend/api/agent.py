"""
Agent API endpoints for AI Teaching Assistant
Handles main agent processing requests
"""
import logging
from fastapi import APIRouter, Depends, Header
from models import AgentRequest, AgentResponse
from auth import verify_auth_token, get_test_user, ensure_test_user_exists
from agent import MyloAgent, ActionHandlers
from database import supabase

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# Initialize agent and handlers
mylo = MyloAgent()
action_handlers = ActionHandlers(supabase)

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