"""
ElevenLabs Voice Agent Service
Handles ElevenLabs Conversational AI agent creation, knowledge base updates, and context management
"""
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from config import ELEVENLABS_API_KEY, CS500_COURSE_ID, ELEVENLABS_AGENT_ID
from models import VoiceAgentContext, StudentInfo, CourseContext, AssignmentContext
from database import get_authenticated_client, supabase
import tempfile
import os

logger = logging.getLogger(__name__)

from elevenlabs import ElevenLabs

class ElevenLabsAgentService:
    def __init__(self):
        if not ELEVENLABS_API_KEY:
            logger.error("ELEVENLABS_API_KEY not found in environment variables")
            raise ValueError("ElevenLabs API key is required")
        
        self.client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        self.agents = {}  # Cache for agent instances
    
    async def get_existing_agent(self, agent_id: str) -> bool:
        """
        Verify that an agent exists
        Returns True if agent exists, False otherwise
        """

        try:
            # Try to get agent details to verify it exists
            agents = self.client.conversational_ai.agents.list()
            for agent in agents.agents:
                if agent.agent_id == agent_id:
                    logger.info(f"Found existing agent: {agent_id}")
                    return True
            
            logger.warning(f"Agent {agent_id} not found")
            return False
            
        except Exception as e:
            logger.error(f"Error checking agent {agent_id}: {e}")
            return False
    
    async def update_knowledge_base(self, agent_id: str, context: VoiceAgentContext) -> bool:
        """
        Update the knowledge base with the latest course context and RAG indexing
        Flow: Delete old RAG indices -> Upload new document -> Create RAG index -> Clean up old documents
        """
        try:
            logger.info(f"Starting knowledge base update for course {context.course.id} and student {context.student.id}")
            
            # Step 1: Delete existing RAG indices for any existing documents
            await self._delete_existing_rag_indices()
            
            # Step 2: Create a comprehensive context document in JSON format
            context_document = self._create_context_document(context)
            
            # Parse the JSON, set the agent_id, and convert back to string
            context_json = json.loads(context_document)
            context_json["agent_id"] = agent_id
            context_document = json.dumps(context_json, indent=2, ensure_ascii=False)
            
            document_name = f"course_context_{context.course.id}_{context.student.id}"
            
            # Step 3: Create new knowledge base document from text (JSON as text)
            response = self.client.conversational_ai.knowledge_base.documents.create_from_text(
                text=context_document,
                name=document_name
            )
            new_doc_id = response.id
            logger.info(f"Successfully created knowledge base document: {new_doc_id} - {response.name}")
            
            # Step 4: Create RAG index for the new document
            await self._create_rag_index(new_doc_id)
            
            # Step 5: Delete all old knowledge base documents except the new one
            await self._cleanup_old_documents(new_doc_id)
            
            # Step 6: Update the agent to attach the knowledge base
            attachment_success = await self._attach_knowledge_base_to_agent(agent_id, new_doc_id, document_name)
            
            if attachment_success:
                logger.info(f"✅ Successfully completed knowledge base update with RAG indexing and agent attachment")
            else:
                logger.warning(f"⚠️  Knowledge base updated successfully, but agent attachment failed (will retry automatically)")
            
            return True  # Return True even if attachment fails - KB update succeeded
                
        except Exception as e:
            logger.error(f"Error updating knowledge base for agent {agent_id}: {e}")
            return False

    async def update_knowledge_base_all_students(self, agent_id: str, course_id: str) -> bool:
        """
        Update the ElevenLabs agent's knowledge base with ALL STUDENTS' context for a course
        Complete pipeline: delete RAG indices → create document → create RAG index → cleanup old docs → attach to agent
        """
        try:
            logger.info(f"Starting knowledge base update for agent {agent_id} with ALL STUDENTS in course {course_id}")
            
            # Step 1: Delete all existing RAG indices
            await self._delete_existing_rag_indices()
            
            # Step 2: Build context for all students in the course
            context_builder = CourseContextBuilder()  # Use service role
            all_students_context = await context_builder.build_context_for_all_students(course_id)
            
            if not all_students_context:
                logger.error(f"Failed to build context for all students in course {course_id}")
                return False
            
            # Step 3: Create context document text with ALL students
            context_text = self._create_all_students_context_document(
                all_students_context, 
                all_students_context["course"]["title"]
            )
            
            # Parse the JSON, set the agent_id, and convert back to string
            context_json = json.loads(context_text)
            context_json["agent_id"] = agent_id
            context_text = json.dumps(context_json, indent=2, ensure_ascii=False)
            
            document_name = f"course_context_ALL_STUDENTS_{all_students_context['course']['title']}_{course_id}"
            
            # Step 4: Upload new knowledge base document
            response = self.client.conversational_ai.knowledge_base.documents.create_from_text(
                name=document_name,
                text=context_text
            )
            
            new_document_id = response.id
            logger.info(f"Created knowledge base document with ALL STUDENTS: {new_document_id} - {document_name}")
            
            # Step 5: Create RAG index for the new document
            await self._create_rag_index(new_document_id)
            
            # Step 6: Clean up old documents (keep only the new one)
            await self._cleanup_old_documents(new_document_id)
            
            # Step 7: Attach knowledge base to agent
            attachment_success = await self._attach_knowledge_base_to_agent(agent_id, new_document_id, document_name)
            
            if attachment_success:
                logger.info(f"✅ Successfully updated knowledge base for agent {agent_id} with {len(all_students_context['students'])} students")
            else:
                logger.warning(f"⚠️  Knowledge base updated for {len(all_students_context['students'])} students, but agent attachment failed (will retry automatically)")
            
            return True  # Return True even if attachment fails - KB update succeeded
            
        except Exception as e:
            logger.error(f"Error updating knowledge base with all students for agent {agent_id}: {e}")
            return False
    
    async def _delete_existing_rag_indices(self) -> None:
        """
        Delete all existing RAG indices from all knowledge base documents
        """
        try:
            logger.info("Deleting existing RAG indices...")
            
            # Get all knowledge base documents
            documents = self.client.conversational_ai.knowledge_base.list()
            
            for doc in documents.documents:
                try:
                    # Get RAG indices for this document
                    rag_response = self.client.conversational_ai.get_document_rag_indexes(
                        documentation_id=doc.id
                    )
                    
                    # Delete each RAG index
                    for rag_index in rag_response.indexes:
                        try:
                            self.client.conversational_ai.delete_document_rag_index(
                                documentation_id=doc.id,
                                rag_index_id=rag_index.id
                            )
                            logger.info(f"Deleted RAG index {rag_index.id} for document {doc.id}")
                        except Exception as e:
                            logger.warning(f"Could not delete RAG index {rag_index.id}: {e}")
                            
                except Exception as e:
                    logger.warning(f"Could not get/delete RAG indices for document {doc.id}: {e}")
            
            logger.info("Completed deleting existing RAG indices")
            
        except Exception as e:
            logger.error(f"Error deleting existing RAG indices: {e}")
    
    async def _create_rag_index(self, document_id: str) -> None:
        """
        Create RAG index for the specified document
        """
        try:
            logger.info(f"Creating RAG index for document {document_id}...")
            
            # Create RAG index using the recommended embedding model
            embedding_model = "e5_mistral_7b_instruct"
            
            response = self.client.conversational_ai.knowledge_base.document.compute_rag_index(
                documentation_id=document_id,
                model=embedding_model
            )
            
            logger.info(f"RAG index creation initiated for document {document_id} with model {embedding_model}")
            logger.info(f"RAG index ID: {response.id}, Status: {response.status}")
            
            # Note: The indexing happens asynchronously, so we don't wait for completion here
            # The status can be checked later if needed
            
        except Exception as e:
            logger.error(f"Error creating RAG index for document {document_id}: {e}")
    
    async def _cleanup_old_documents(self, keep_doc_id: str) -> None:
        """
        Delete all knowledge base documents except the one specified
        """
        try:
            logger.info(f"Cleaning up old documents, keeping document {keep_doc_id}...")
            
            # Get all knowledge base documents
            documents = self.client.conversational_ai.knowledge_base.list()
            
            deleted_count = 0
            for doc in documents.documents:
                if doc.id != keep_doc_id:
                    try:
                        self.client.conversational_ai.knowledge_base.documents.delete(
                            documentation_id=doc.id,
                            force=True  # Force delete even if used by agents
                        )
                        logger.info(f"Deleted old document: {doc.id} - {doc.name}")
                        deleted_count += 1
                    except Exception as e:
                        logger.warning(f"Could not delete document {doc.id}: {e}")
            
            logger.info(f"Cleanup completed. Deleted {deleted_count} old documents, kept {keep_doc_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up old documents: {e}")
    
    async def _attach_knowledge_base_to_agent(self, agent_id: str, document_id: str, document_name: str) -> bool:
        """
        Update the agent to attach the knowledge base document
        Returns True if successful, False if failed
        """
        import asyncio
        import httpx
        
        max_retries = 3
        retry_delay = 20  # seconds
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    logger.info(f"Retrying agent attachment (attempt {attempt + 1}/{max_retries}) after {retry_delay}s delay...")
                    await asyncio.sleep(retry_delay)
                
                logger.info(f"Attaching knowledge base document {document_id} to agent {agent_id}...")
                
                # Update the agent to include the knowledge base in its configuration
                self.client.conversational_ai.agents.update(
                    agent_id=agent_id,
                    conversation_config={
                        "agent": {
                            "prompt": {
                                "knowledge_base": [
                                    {
                                        "type": "file",
                                        "name": document_name,
                                        "id": document_id,
                                        "usage_mode": "prompt"
                                    }
                                ]
                            }
                        }
                    }
                )
                
                logger.info(f"✅ Successfully attached knowledge base document {document_id} to agent {agent_id}")
                return True
                
            except Exception as e:
                error_str = str(e)
                
                # Check if this is a 502 Bad Gateway (temporary server error)
                if "502" in error_str or "Bad Gateway" in error_str:
                    logger.warning(f"⚠️  ElevenLabs server temporarily unavailable (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        logger.error(f"❌ Failed to attach knowledge base after {max_retries} attempts due to server issues")
                else:
                    logger.error(f"❌ Error attaching knowledge base to agent {agent_id}: {e}")
                    break
        
        logger.error(f"Document ID: {document_id}, Document Name: {document_name}")
        logger.info("💡 Knowledge base was uploaded successfully - agent attachment can be retried later")
        return False
    
    async def _find_existing_document(self, document_name: str) -> Optional[str]:
        """
        Find if a document with the given name already exists
        Returns document ID if found, None otherwise
        """
        try:
            # List knowledge base documents and search for our document
            documents = self.client.conversational_ai.knowledge_base.list()
            
            for doc in documents.documents:
                if doc.name == document_name:
                    return doc.id
            
            return None
            
        except Exception as e:
            logger.error(f"Error searching for existing document {document_name}: {e}")
            return None
    
    def _create_context_document(self, context: VoiceAgentContext) -> str:
        """
        Create a comprehensive context document for the knowledge base in JSON format
        matching the KB.json structure exactly, but returned as a text string
        """
        
        # Convert assignments to the exact format shown in KB.json
        assignments_json = []
        for assignment in context.course.assignments:
            assignment_dict = {
                "id": assignment.id,
                "title": assignment.title,
                "description": assignment.description,
                "due_date": assignment.due_date,
                "total_points": assignment.total_points,
                "status": assignment.status,
                "rubric": assignment.rubric,
                "has_submission": assignment.has_submission,
                "submission_status": assignment.submission_status,
                "submission_file_path": assignment.submission_file_path,
                "submission_content": assignment.submission_content,
                "grade": assignment.grade,
                "feedback": assignment.feedback
            }
            assignments_json.append(assignment_dict)
        
        # Create the complete JSON structure matching KB.json exactly
        knowledge_base_json = {
            "success": True,
            "message": f"Voice agent context updated successfully for {context.course.title}",
            "context": {
                "student": {
                    "id": context.student.id,
                    "name": context.student.name,
                    "email": context.student.email
                },
                "course": {
                    "id": context.course.id,
                    "title": context.course.title,
                    "description": context.course.description,
                    "assignments": assignments_json
                },
                "context_updated_at": context.context_updated_at
            },
            "agent_id": None,  # Will be set by the calling function
            "knowledge_base_updated": True
        }
        
        # Return as formatted JSON text
        return json.dumps(knowledge_base_json, indent=2, ensure_ascii=False)

    def _create_all_students_context_document(self, context_data: Dict[str, Any], course_title: str) -> str:
        """
        Create a comprehensive context document for ALL students in the course
        Returns JSON format with all students' information
        """
        
        # Create the complete JSON structure with ALL students
        knowledge_base_json = {
            "success": True,
            "message": f"Voice agent context updated successfully for {course_title} - ALL STUDENTS",
            "context": {
                "course": context_data["course"],
                "students": context_data["students"],
                "context_updated_at": context_data["context_updated_at"]
            },
            "agent_id": None,  # Will be set by the calling function
            "knowledge_base_updated": True
        }
        
        # Return as formatted JSON text
        return json.dumps(knowledge_base_json, indent=2, ensure_ascii=False)

    async def trigger_knowledge_base_update_for_course(self, course_id: str, agent_id: str = None) -> None:
        """
        Trigger knowledge base update with ALL STUDENTS for a course
        Only updates for CS500 course
        Uses the new all-students approach for comprehensive context
        """
        try:
            # Use default agent ID if not provided
            if not agent_id:
                agent_id = ELEVENLABS_AGENT_ID
                
            # Only update for CS500 course
            if course_id != CS500_COURSE_ID:
                return
            
            logger.info(f"Triggering knowledge base update for ALL STUDENTS in course {course_id}")
            
            # Update knowledge base with ALL students' information
            success = await self.update_knowledge_base_all_students(agent_id, course_id)
            
            if success:
                print(f"✅ Knowledge base push successful for ALL STUDENTS in CS500")
                logger.info(f"Successfully updated knowledge base with all students for course {course_id}")
            else:
                logger.error(f"Failed to update knowledge base with all students for course {course_id}")
                    
        except Exception as e:
            logger.error(f"Error triggering knowledge base update for course {course_id}: {e}")

class CourseContextBuilder:
    """
    Builds comprehensive course context for a specific student
    """
    
    def __init__(self, user_token: str = None):
        self.db_client = get_authenticated_client(user_token)
    
    async def build_context_for_all_students(self, course_id: str) -> Optional[Dict[str, Any]]:
        """
        Build complete course context including ALL students in the course
        Returns a comprehensive context dictionary with all students' information
        """
        try:
            logger.info(f"Building context for ALL students in course {course_id}")
            
            # Get course information
            course_info = await self._get_course_info(course_id)
            if not course_info:
                logger.error(f"Course {course_id} not found")
                return None
            
            # Get all enrolled students
            all_students = await self._get_all_enrolled_students(course_id)
            if not all_students:
                logger.error(f"No students found enrolled in course {course_id}")
                return None
                
            # Get all assignments for the course (once, since they're the same for all students)
            assignments_result = self.db_client.table("assignments").select(
                "id, title, description, due_date, total_points, status, rubric_markdown"
            ).eq("course_id", course_id).order("created_at", desc=False).execute()
            
            # Build students data with their submissions
            students_data = []
            for student in all_students:
                student_assignments = []
                
                # For each assignment, get this student's submission
                for assignment_data in assignments_result.data:
                    submission_data = await self._get_student_submission(assignment_data["id"], student["id"])
                    
                    assignment_context = {
                        "id": assignment_data["id"],
                        "title": assignment_data["title"],
                        "description": assignment_data.get("description"),
                        "due_date": assignment_data.get("due_date"),
                        "total_points": assignment_data["total_points"],
                        "status": assignment_data["status"],
                        "rubric": assignment_data.get("rubric_markdown"),
                        "has_submission": submission_data is not None,
                        "submission_status": submission_data.get("status") if submission_data else None,
                        "submission_file_path": submission_data.get("file_path") if submission_data else None,
                        "submission_content": submission_data.get("content") if submission_data else None,
                        "grade": submission_data.get("grade") if submission_data else None,
                        "feedback": submission_data.get("feedback") if submission_data else None
                    }
                    student_assignments.append(assignment_context)
                
                # Add student with their assignments
                student_data = {
                    "id": student["id"],
                    "name": student["full_name"],
                    "email": student["email"],
                    "assignments": student_assignments
                }
                students_data.append(student_data)
            
            # Build the complete context
            context = {
                "course": {
                    "id": course_info["id"],
                    "title": course_info["title"],
                    "description": course_info.get("description"),
                    "total_students": len(students_data)
                },
                "students": students_data,
                "context_updated_at": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Successfully built context for {len(students_data)} students with {len(assignments_result.data)} assignments each")
            return context
            
        except Exception as e:
            logger.error(f"Error building context for all students in course {course_id}: {e}")
            return None

    async def _get_all_enrolled_students(self, course_id: str) -> List[Dict[str, Any]]:
        """Get all students enrolled in the course"""
        try:
            result = self.db_client.table("enrollments").select(
                "student:users!student_id(id, full_name, email)"
            ).eq("course_id", course_id).execute()
            
            students = []
            for enrollment in result.data:
                if enrollment.get("student"):
                    students.append(enrollment["student"])
            
            return students
            
        except Exception as e:
            logger.error(f"Error fetching enrolled students for course {course_id}: {e}")
            return []

    async def build_context(self, student_id: str, course_id: str) -> Optional[VoiceAgentContext]:
        """
        Build complete course context for a specific student
        """
        try:
            logger.info(f"Building context for student {student_id} in course {course_id}")
            
            # Get student information
            student_info = await self._get_student_info(student_id)
            if not student_info:
                logger.error(f"Student {student_id} not found")
                return None
            
            # Get course information
            course_info = await self._get_course_info(course_id)
            if not course_info:
                logger.error(f"Course {course_id} not found")
                return None
            
            # Check if student is enrolled in the course
            if not await self._is_student_enrolled(student_id, course_id):
                logger.error(f"Student {student_id} is not enrolled in course {course_id}")
                return None
            
            # Get assignments for the course
            assignments = await self._get_course_assignments(course_id, student_id)
            
            # Build the complete context
            context = VoiceAgentContext(
                student=StudentInfo(
                    id=student_info["id"],
                    name=student_info["full_name"],
                    email=student_info["email"]
                ),
                course=CourseContext(
                    id=course_info["id"],
                    title=course_info["title"],
                    description=course_info.get("description"),
                    assignments=assignments
                ),
                context_updated_at=datetime.utcnow().isoformat()
            )
            
            logger.info(f"Successfully built context with {len(assignments)} assignments")
            return context
            
        except Exception as e:
            logger.error(f"Error building context for student {student_id} in course {course_id}: {e}")
            return None
    
    async def _get_student_info(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get student information"""
        try:
            result = self.db_client.table("users").select("id, full_name, email, role").eq("id", student_id).eq("role", "student").single().execute()
            return result.data
        except Exception as e:
            logger.error(f"Error fetching student {student_id}: {e}")
            return None
    
    async def _get_course_info(self, course_id: str) -> Optional[Dict[str, Any]]:
        """Get course information"""
        try:
            result = self.db_client.table("courses").select("id, title, description").eq("id", course_id).single().execute()
            return result.data
        except Exception as e:
            logger.error(f"Error fetching course {course_id}: {e}")
            return None
    
    async def _is_student_enrolled(self, student_id: str, course_id: str) -> bool:
        """Check if student is enrolled in the course"""
        try:
            result = self.db_client.table("enrollments").select("id").eq("student_id", student_id).eq("course_id", course_id).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error checking enrollment for student {student_id} in course {course_id}: {e}")
            return False
    
    async def _get_course_assignments(self, course_id: str, student_id: str) -> List[AssignmentContext]:
        """Get all assignments for the course with student's submission information"""
        try:
            # Get all assignments for the course
            assignments_result = self.db_client.table("assignments").select(
                "id, title, description, due_date, total_points, status, rubric_markdown"
            ).eq("course_id", course_id).order("created_at", desc=False).execute()
            
            assignments = []
            
            for assignment_data in assignments_result.data:
                # Get student's submission for this assignment
                submission_data = await self._get_student_submission(assignment_data["id"], student_id)
                
                assignment_context = AssignmentContext(
                    id=assignment_data["id"],
                    title=assignment_data["title"],
                    description=assignment_data.get("description"),
                    due_date=assignment_data.get("due_date"),
                    total_points=assignment_data["total_points"],
                    status=assignment_data["status"],
                    rubric=assignment_data.get("rubric_markdown"),
                    has_submission=submission_data is not None,
                    submission_status=submission_data.get("status") if submission_data else None,
                    submission_file_path=submission_data.get("file_path") if submission_data else None,
                    submission_content=submission_data.get("content") if submission_data else None,
                    grade=submission_data.get("grade") if submission_data else None,
                    feedback=submission_data.get("feedback") if submission_data else None
                )
                
                assignments.append(assignment_context)
            
            return assignments
            
        except Exception as e:
            logger.error(f"Error fetching assignments for course {course_id}: {e}")
            return []
    
    async def _get_student_submission(self, assignment_id: str, student_id: str) -> Optional[Dict[str, Any]]:
        """Get student's submission for a specific assignment"""
        try:
            result = self.db_client.table("submissions").select(
                "id, status, content, file_path, grade, feedback"
            ).eq("assignment_id", assignment_id).eq("student_id", student_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Error fetching submission for assignment {assignment_id}, student {student_id}: {e}")
            return None 