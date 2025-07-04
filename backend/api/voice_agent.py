"""
Voice Agent API Endpoints
Handles ElevenLabs voice agent context updates and management
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from models import VoiceAgentRequest, VoiceAgentResponse
from auth import verify_auth_token
from agent.elevenlabs_agent import ElevenLabsAgentService, CourseContextBuilder
from database import get_authenticated_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice-agent", tags=["voice-agent"])

# Initialize services
try:
    elevenlabs_service = ElevenLabsAgentService()
    logger.info("ElevenLabs service initialized successfully")
except Exception as e:
    logger.warning(f"ElevenLabs service initialization failed: {e}")
    elevenlabs_service = None

@router.options("/update-context")
async def update_context_options():
    """Handle CORS preflight request for update-context endpoint"""
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })

@router.post("/update-context", response_model=VoiceAgentResponse)
async def update_voice_agent_context(
    request: VoiceAgentRequest
):
    """
    Update the voice agent's knowledge base with current course context for a specific student
    This endpoint should be called when a student navigates to a course page
    NOTE: Authentication removed for testing purposes
    """
    try:
        logger.info(f"Updating voice agent context for student {request.student_id} in course {request.course_id}")
        
        # Check if ElevenLabs service is available
        if not elevenlabs_service:
            return VoiceAgentResponse(
                success=False,
                message="ElevenLabs service is not available. Please check ELEVENLABS_API_KEY configuration.",
                context=None,
                agent_id=None,
                knowledge_base_updated=False
            )
        
        # Get the agent_id - should be provided by the frontend
        agent_id = request.agent_id if hasattr(request, 'agent_id') and request.agent_id else None
        
        if not agent_id:
            return VoiceAgentResponse(
                success=False,
                message="No agent_id provided. Please specify which ElevenLabs agent to update.",
                context=None,
                agent_id=None,
                knowledge_base_updated=False
            )
            
        # Verify the agent exists
        try:
            agent_exists = await elevenlabs_service.get_existing_agent(agent_id)
            if not agent_exists:
                return VoiceAgentResponse(
                    success=False,
                    message=f"Agent {agent_id} not found in ElevenLabs",
                    context=None,
                    agent_id=agent_id,
                    knowledge_base_updated=False
                )
        except Exception as e:
            logger.error(f"Failed to verify agent: {e}")
            return VoiceAgentResponse(
                success=False,
                message=f"Failed to verify agent: {str(e)}",
                context=None,
                agent_id=agent_id,
                knowledge_base_updated=False
            )
        
        # Update the agent's knowledge base with ALL STUDENTS' context for this course
        knowledge_base_updated = await elevenlabs_service.update_knowledge_base_all_students(agent_id, request.course_id)
        
        if knowledge_base_updated:
            logger.info(f"Successfully updated voice agent {agent_id} with ALL STUDENTS for course {request.course_id}")
            return VoiceAgentResponse(
                success=True,
                message=f"Voice agent context updated successfully with ALL STUDENTS for course {request.course_id}",
                context=None,  # We don't return individual context anymore since it's all students
                agent_id=agent_id,
                knowledge_base_updated=True
            )
        else:
            logger.warning(f"Failed to update knowledge base for agent {agent_id}")
            return VoiceAgentResponse(
                success=False,
                message="Failed to update voice agent knowledge base with all students.",
                context=None,
                agent_id=agent_id,
                knowledge_base_updated=False
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating voice agent context: {e}")
        return VoiceAgentResponse(
            success=False,
            message=f"Internal server error: {str(e)}",
            context=None,
            agent_id=None,
            knowledge_base_updated=False
        )

@router.get("/context/{student_id}/{course_id}")
async def get_voice_agent_context(
    student_id: str,
    course_id: str,
    user = Depends(verify_auth_token),
    authorization: str = Header(None)
):
    """
    Get the current voice agent context for a student in a specific course
    This is useful for debugging or displaying current context information
    """
    try:
        # Verify that the authenticated user is the student requesting the context
        if user.id != student_id:
            raise HTTPException(
                status_code=403, 
                detail="You can only view context for your own account"
            )
        
        # Extract the token from the authorization header
        user_token = None
        if authorization and authorization.startswith("Bearer "):
            user_token = authorization.split(" ")[1]
        
        # Build the course context for this student  
        # Use service role after authentication verification to bypass RLS
        context_builder = CourseContextBuilder()  # No token = service role
        course_context = await context_builder.build_context(student_id, course_id)
        
        if not course_context:
            raise HTTPException(
                status_code=404,
                detail="Course context not found. Please ensure you are enrolled in this course."
            )
        
        return JSONResponse(content={
            "success": True,
            "context": course_context.dict(),
            "message": f"Context retrieved for {course_context.course.title}"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving voice agent context: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/test-context")
async def test_voice_agent_context(
    request: VoiceAgentRequest
):
    """
    Test endpoint for voice agent context (development only)
    This bypasses authentication for testing purposes
    """
    try:
        logger.info(f"TEST: Building context for student {request.student_id} in course {request.course_id}")
        
        # Build the course context for this student (without authentication)
        context_builder = CourseContextBuilder()
        course_context = await context_builder.build_context(request.student_id, request.course_id)
        
        if not course_context:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Course context not found. Please ensure the student is enrolled in this course.",
                    "context": None
                }
            )
        
        return JSONResponse(content={
            "success": True,
            "context": course_context.dict(),
            "message": f"Test context built successfully for {course_context.course.title}",
            "note": "This is a test endpoint - context was not uploaded to ElevenLabs"
        })
        
    except Exception as e:
        logger.error(f"Error in test context building: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Internal server error: {str(e)}",
                "context": None
            }
        )

@router.get("/health")
async def voice_agent_health():
    """
    Health check endpoint for voice agent service
    """
    return {
        "status": "healthy",
        "elevenlabs_service_available": elevenlabs_service is not None,
        "message": "Voice agent service is running"
    }

@router.get("/agents")
async def list_available_agents():
    """
    List all available agents in your ElevenLabs account
    """
    try:
        agents = elevenlabs_service.client.conversational_ai.agents.list()
        agent_list = []
        
        for agent in agents.agents:
            agent_list.append({
                "agent_id": agent.agent_id,
                "name": agent.name,
                "description": getattr(agent, 'description', 'No description available')
            })
        
        return {
            "success": True,
            "agents": agent_list,
            "total_agents": len(agent_list),
            "message": "Use any of these agent_id values in your requests"
        }
        
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        return {
            "success": False,
            "error": str(e),
            "agents": [],
            "message": "Failed to retrieve agents from ElevenLabs"
        }

@router.get("/knowledge-base")
async def list_knowledge_base_documents():
    """
    List all knowledge base documents in your ElevenLabs account
    """
    try:
        documents = elevenlabs_service.client.conversational_ai.knowledge_base.list()
        doc_list = []
        
        for doc in documents.documents:
            doc_list.append({
                "id": doc.id,
                "name": doc.name,
                "type": getattr(doc, 'type', 'unknown'),
                "created_at": getattr(doc.metadata, 'created_at_unix_secs', None),
                "size_bytes": getattr(doc.metadata, 'size_bytes', None)
            })
        
        return {
            "success": True,
            "documents": doc_list,
            "total_documents": len(doc_list),
            "message": "Current knowledge base documents"
        }
        
    except Exception as e:
        logger.error(f"Error listing knowledge base documents: {e}")
        return {
            "success": False,
            "error": str(e),
            "documents": [],
            "message": "Failed to retrieve knowledge base documents from ElevenLabs"
        }

@router.get("/rag-status")
async def get_rag_index_status():
    """
    Get RAG index status for all knowledge base documents
    """
    try:
        documents = elevenlabs_service.client.conversational_ai.knowledge_base.list()
        rag_status = []
        
        for doc in documents.documents:
            try:
                # Get RAG indices for this document
                rag_response = elevenlabs_service.client.conversational_ai.get_document_rag_indexes(
                    documentation_id=doc.id
                )
                
                doc_rag_info = {
                    "document_id": doc.id,
                    "document_name": doc.name,
                    "rag_indices": []
                }
                
                for rag_index in rag_response.indexes:
                    doc_rag_info["rag_indices"].append({
                        "id": rag_index.id,
                        "model": rag_index.model,
                        "status": rag_index.status,
                        "progress_percentage": rag_index.progress_percentage,
                        "used_bytes": getattr(rag_index.document_model_index_usage, 'used_bytes', None)
                    })
                
                rag_status.append(doc_rag_info)
                
            except Exception as e:
                logger.warning(f"Could not get RAG status for document {doc.id}: {e}")
                rag_status.append({
                    "document_id": doc.id,
                    "document_name": doc.name,
                    "rag_indices": [],
                    "error": str(e)
                })
        
        return {
            "success": True,
            "rag_status": rag_status,
            "message": "RAG index status for all documents"
        }
        
    except Exception as e:
        logger.error(f"Error getting RAG index status: {e}")
        return {
            "success": False,
            "error": str(e),
            "rag_status": [],
            "message": "Failed to retrieve RAG index status"
        }

@router.get("/agent-config/{agent_id}")
async def get_agent_configuration(agent_id: str):
    """
    Debug endpoint to check agent configuration including attached knowledge base
    """
    try:
        # Get agent details to check knowledge base attachment
        agents = elevenlabs_service.client.conversational_ai.agents.list()
        
        target_agent = None
        for agent in agents.agents:
            if agent.agent_id == agent_id:
                target_agent = agent
                break
        
        if not target_agent:
            return {
                "success": False,
                "error": f"Agent {agent_id} not found",
                "agent_id": agent_id
            }
        
        # Extract knowledge base information
        knowledge_base_info = []
        if hasattr(target_agent, 'conversation_config') and target_agent.conversation_config:
            agent_config = target_agent.conversation_config.get('agent', {})
            prompt_config = agent_config.get('prompt', {})
            knowledge_base = prompt_config.get('knowledge_base', [])
            
            for kb_item in knowledge_base:
                knowledge_base_info.append({
                    "type": kb_item.get("type"),
                    "name": kb_item.get("name"),
                    "id": kb_item.get("id"),
                    "usage_mode": kb_item.get("usage_mode")
                })
        
        return {
            "success": True,
            "agent_id": agent_id,
            "agent_name": target_agent.name,
            "knowledge_base_attached": len(knowledge_base_info) > 0,
            "knowledge_base_documents": knowledge_base_info,
            "total_kb_documents": len(knowledge_base_info)
        }
        
    except Exception as e:
        logger.error(f"Error getting agent configuration for {agent_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "agent_id": agent_id,
            "message": f"Failed to retrieve agent configuration for {agent_id}"
        }

@router.get("/debug/available-data")
async def get_available_data():
    """
    Debug endpoint to show available students and courses for testing
    """
    try:
        from database import get_authenticated_client
        
        # Use service client to bypass RLS for debugging
        db_client = get_authenticated_client()
        
        # Get students
        students_result = db_client.table("users").select("id, email, full_name").eq("role", "student").execute()
        students = students_result.data or []
        
        # Get courses
        courses_result = db_client.table("courses").select("id, title").execute()
        courses = courses_result.data or []
        
        # Get enrollments
        enrollments_result = db_client.table("enrollments").select(
            "student_id, course_id, users!student_id(full_name), courses!course_id(title)"
        ).execute()
        enrollments = enrollments_result.data or []
        
        return {
            "students": students,
            "courses": courses, 
            "enrollments": enrollments,
            "message": "Use any student_id and course_id from enrollments for testing"
        }
        
    except Exception as e:
        logger.error(f"Error getting debug data: {e}")
        return {
            "error": str(e),
            "students": [],
            "courses": [],
            "enrollments": []
        }

@router.post("/retry-attachment/{agent_id}")
async def retry_agent_attachment(agent_id: str):
    """
    Retry attaching the latest knowledge base document to the agent
    Useful when ElevenLabs servers were temporarily down during knowledge base update
    """
    try:
        logger.info(f"Manual retry of agent attachment for {agent_id}")
        
        # Get the most recent knowledge base document (likely the one that failed to attach)
        documents = elevenlabs_service.client.conversational_ai.knowledge_base.list()
        
        if not documents.documents:
            return {
                "success": False,
                "message": "No knowledge base documents found to attach",
                "agent_id": agent_id
            }
        
        # Sort by creation time and get the most recent
        latest_doc = documents.documents[0]  # Assuming they're sorted by recency
        for doc in documents.documents:
            # Look for CS500 course context document
            if "course_context" in doc.name and "CS500" in doc.name:
                latest_doc = doc
                break
        
        logger.info(f"Found document to attach: {latest_doc.id} - {latest_doc.name}")
        
        # Attempt to attach the knowledge base to the agent
        attachment_success = await elevenlabs_service._attach_knowledge_base_to_agent(
            agent_id, latest_doc.id, latest_doc.name
        )
        
        if attachment_success:
            return {
                "success": True,
                "message": f"Successfully attached knowledge base document to agent {agent_id}",
                "agent_id": agent_id,
                "document_id": latest_doc.id,
                "document_name": latest_doc.name
            }
        else:
            return {
                "success": False,
                "message": f"Failed to attach knowledge base document to agent {agent_id} (ElevenLabs servers may still be down)",
                "agent_id": agent_id,
                "document_id": latest_doc.id,
                "document_name": latest_doc.name,
                "retry_suggestion": "Wait a few minutes and try again"
            }
        
    except Exception as e:
        logger.error(f"Error in manual agent attachment retry: {e}")
        return {
            "success": False,
            "error": str(e),
            "agent_id": agent_id,
            "message": "Failed to retry agent attachment"
        }
