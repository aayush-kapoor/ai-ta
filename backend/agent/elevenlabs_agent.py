"""
ElevenLabs Voice Agent Service
Handles ElevenLabs Conversational AI agent creation, knowledge base updates, and context management
"""
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from config import ELEVENLABS_API_KEY
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
        Update the knowledge base with the latest course context
        Note: Knowledge base documents are global in ElevenLabs, not per-agent
        """
        try:
            logger.info(f"Creating/updating knowledge base document for course {context.course.id} and student {context.student.id}")
            
            # Create a comprehensive context document
            context_document = self._create_context_document(context)
            document_name = f"course_context_{context.course.id}_{context.student.id}"
            
            # First, check if a document with this name already exists
            existing_doc_id = await self._find_existing_document(document_name)
            
            if existing_doc_id:
                # Update existing document
                logger.info(f"Updating existing document: {existing_doc_id}")
                # Note: The update endpoint only allows updating the name, not content
                # So we'll delete and recreate for now
                try:
                    self.client.conversational_ai.knowledge_base.documents.delete(
                        documentation_id=existing_doc_id
                    )
                    logger.info(f"Deleted existing document: {existing_doc_id}")
                except Exception as e:
                    logger.warning(f"Could not delete existing document {existing_doc_id}: {e}")
            
            # Create new knowledge base document from text
            response = self.client.conversational_ai.knowledge_base.documents.create_from_text(
                text=context_document,
                name=document_name
            )
            
            logger.info(f"Successfully created knowledge base document: {response.id} - {response.name}")
            return True
                
        except Exception as e:
            logger.error(f"Error updating knowledge base for agent {agent_id}: {e}")
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
        Create a comprehensive context document for the knowledge base
        """
        doc = f"""COURSE CONTEXT FOR AI TEACHING ASSISTANT
Generated: {context.context_updated_at}

=== STUDENT INFORMATION ===
Student Name: {context.student.name}
Student ID: {context.student.id}
Student Email: {context.student.email}

IMPORTANT: This knowledge base is ONLY for {context.student.name}. Do not share or reference information about other students.

=== COURSE INFORMATION ===
Course ID: {context.course.id}
Course Title: {context.course.title}
Course Description: {context.course.description or "No description available"}

=== ASSIGNMENTS IN THIS COURSE ===
Total Assignments: {len(context.course.assignments)}

"""
        
        for i, assignment in enumerate(context.course.assignments, 1):
            doc += f"""
--- ASSIGNMENT {i}: {assignment.title} ---
Assignment ID: {assignment.id}
Title: {assignment.title}
Description: {assignment.description or "No description available"}
Due Date: {assignment.due_date or "No due date set"}
Total Points: {assignment.total_points}
Status: {assignment.status}

RUBRIC:
{assignment.rubric or "No rubric available"}

STUDENT'S SUBMISSION STATUS:
Has Submitted: {"Yes" if assignment.has_submission else "No"}
"""
            
            if assignment.has_submission:
                doc += f"""Submission Status: {assignment.submission_status or "Unknown"}
Grade: {assignment.grade if assignment.grade is not None else "Not yet graded"}
Feedback: {assignment.feedback or "No feedback provided yet"}

SUBMISSION CONTENT:
{assignment.submission_content or "No content available (file-based submission)"}
"""
            else:
                doc += "No submission yet - student should be reminded about the assignment and deadline.\n"
            
            doc += "\n" + "="*80 + "\n"
        
        doc += f"""
=== SUMMARY FOR AI ASSISTANT ===
You are helping {context.student.name} with the {context.course.title} course.

Key things to remember:
1. Only discuss {context.student.name}'s own work and progress
2. Help them understand assignment requirements and rubrics
3. If they have questions about grades/feedback, refer to the specific information above
4. Encourage them to complete missing assignments
5. Be supportive and educational in your responses
6. If you don't have specific information, guide them to contact their instructor

PRIVACY: Never mention or discuss other students' work or performance.
"""
        
        return doc

class CourseContextBuilder:
    """
    Builds comprehensive course context for a specific student
    """
    
    def __init__(self, user_token: str = None):
        self.db_client = get_authenticated_client(user_token)
    
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