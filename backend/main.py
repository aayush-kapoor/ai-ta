from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, Callable
import os
import logging
import json
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Mylo - AI Teaching Assistant Agent", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")

# Test user configuration (for development)
test_user_id = os.getenv("TEST_USER_ID")
test_user_email = os.getenv("TEST_USER_EMAIL")
test_user_name = os.getenv("TEST_USER_NAME")

if not all([supabase_url, supabase_key, openai_api_key]):
    raise ValueError("Missing required environment variables: SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY")

# Initialize clients
supabase: Client = create_client(supabase_url, supabase_key)
openai_client = AsyncOpenAI(api_key=openai_api_key)

# Pydantic models
class AgentRequest(BaseModel):
    message: str
    user_id: str
    context: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    response: str
    action_taken: Optional[str] = None
    success: bool
    data: Optional[Dict[str, Any]] = None

# Authentication helper
async def verify_auth_token(authorization: str = Header(None)):
    """Verify Supabase auth token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    try:
        # Verify token with Supabase - use the correct method
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return response.user
    except Exception as e:
        logger.error(f"Auth verification failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# Simple auth bypass for testing (remove in production)
async def get_test_user():
    """Simple test user for development"""
    return {"id": test_user_id, "email": test_user_email}

async def ensure_test_user_exists():
    """Ensure the test user exists in the database"""
    try:
        # Use service role client to bypass RLS for this check
        service_key = supabase_service_key or supabase_key
        admin_client = create_client(supabase_url, service_key)
        
        # Check if user exists
        result = admin_client.table("users").select("id").eq("id", test_user_id).execute()
        
        if not result.data:
            # User doesn't exist, create them
            logger.info("Creating test user in database")
            admin_client.table("users").insert({
                "id": test_user_id,
                "email": test_user_email,
                "name": test_user_name,
                "role": "teacher"
            }).execute()
            logger.info("Test user created successfully")
        else:
            logger.info("Test user already exists in database")
            
    except Exception as e:
        logger.error(f"Error ensuring test user exists: {e}")
        # Don't fail the request, just log the error

# Agent Core
class MyloAgent:
    def __init__(self):
        self.system_prompt = """
        You are Mylo, an AI teaching assistant agent. You help teachers manage their courses and assignments efficiently.
        
        Your core capabilities include:
        
        🏗️ COURSE MANAGEMENT:
        - create_course: Create new courses
          Params: title/course_code (required), description (optional)
          
        - update_course: Edit existing courses
          Params: course_name/course_id (required), title, description (at least one required)
        
        📝 ASSIGNMENT MANAGEMENT:
        - create_assignment: Create new assignments
          Params: title, course (required), points, description, publish (optional)
          
        - update_assignment: Edit existing assignments
          Params: assignment_name/assignment_id (required), title, description, points, due_date, status (at least one update required)
          
        - delete_assignment: Remove assignments
          Params: assignment_name/assignment_id (required)
          
        - update_rubric: Change assignment rubrics
          Params: assignment_name/assignment_id, rubric_text/rubric (both required)
          
        - publish_assignment: Publish/unpublish assignments
          Params: assignment_name/assignment_id (required), action (publish/unpublish, default: publish)
        
        📊 ANALYTICS & INFO:
        - get_submission_count: Count submissions for assignments
          Params: assignment_name/assignment_id (required)
          
        - get_info: Get detailed information
          Params: type (course/assignment/general), name/id (for specific items)
        
        🎯 PARAMETER EXTRACTION RULES:
        
        COURSE IDENTIFICATION:
        - "CS500", "MATH101", "course CS500" → course: "CS500"
        - "Machine Learning course" → course: "MACHINE LEARNING"
        
        ASSIGNMENT IDENTIFICATION:
        - "assignment Homework 1" → assignment_name: "Homework 1"
        - "the midterm exam" → assignment_name: "midterm exam"
        - "Top 10 AI startups project" → title: "Top 10 AI Startups Project"
        
        ACTIONS:
        - "publish", "make visible", "release to students" → publish: true
        - "unpublish", "hide", "make draft" → action: "unpublish"
        - "change rubric to X" → rubric_text: "X"
        - "worth 100 points", "100 pts" → points: 100
        - "delete", "remove" → intent: delete_assignment
        - "how many submitted", "submission count" → intent: get_submission_count
        - "edit", "change", "update", "modify" → intent: update_assignment/update_course
        
        QUESTION HANDLING:
        - "How many students submitted Homework 1?" → get_submission_count(assignment_name: "Homework 1")
        - "What assignments are in CS500?" → get_info(type: "course", name: "CS500")
        - "Show me details about the midterm" → get_info(type: "assignment", name: "midterm")
        
        MULTI-STEP REQUESTS:
        Break complex requests into primary actions:
        - "Create assignment X and publish it" → create_assignment(publish: true)
        - "Update homework 1 points to 50 and change due date" → update_assignment(points: 50, due_date: extracted_date)
        
        Always respond in JSON format:
        {
            "intent": "action_name",
            "parameters": {
                "title": "Assignment Title",
                "course": "COURSE_CODE",
                "points": 100,
                "assignment_name": "Assignment Name",
                "rubric_text": "New rubric content"
            },
            "response": "Clear explanation of what you'll do",
            "confidence": 0.8
        }
        
        Be smart about context and make reasonable assumptions when information is partially provided.
        """
    
    async def process_message(self, message: str, user_id: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process user message and determine intent and parameters"""
        try:
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": f"Teacher request: {message}"}
            ]
            
            if context:
                messages.insert(-1, {
                    "role": "system", 
                    "content": f"Current context: {json.dumps(context)}"
                })
            
            response = await openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.1,
                max_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Agent processed message: {message} -> {result['intent']}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "intent": "error",
                "parameters": {},
                "response": "I encountered an error processing your request. Please try again.",
                "confidence": 0.0
            }

# Initialize agent
mylo = MyloAgent()

# Action Handlers
class ActionHandlers:
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.handlers: Dict[str, Callable] = {
            "create_assignment": self.create_assignment,
            "update_assignment": self.update_assignment,
            "update_rubric": self.update_rubric,
            "delete_assignment": self.delete_assignment,
            "publish_assignment": self.publish_assignment,
            "create_course": self.create_course,
            "update_course": self.update_course,
            "get_submission_count": self.get_submission_count,
            "get_info": self.get_info,
        }
    
    def get_authenticated_client(self, user_token: str = None) -> Client:
        """Get a Supabase client authenticated as the teacher"""
        if user_token:
            # Create a client with the user's session token
            logger.info("Using user token for database access")
            auth_client = create_client(supabase_url, supabase_key)
            auth_client.auth.set_session(user_token, "")
            return auth_client
        else:
            # For testing, use service role client that bypasses RLS
            logger.info("Using service key for database access (bypassing RLS)")
            service_key = supabase_service_key or supabase_key
            if service_key == supabase_key:
                logger.warning("No SUPABASE_SERVICE_KEY found, using anon key - this might cause RLS issues")
            return create_client(supabase_url, service_key)
    
    async def execute(self, intent: str, parameters: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Execute an action based on intent and parameters"""
        if intent not in self.handlers:
            return {
                "success": False,
                "message": f"I don't know how to handle '{intent}' yet.",
                "data": None
            }
        
        try:
            handler = self.handlers[intent]
            result = await handler(parameters, user_id, user_token)
            return result
        except Exception as e:
            logger.error(f"Error executing {intent}: {e}")
            return {
                "success": False,
                "message": f"I encountered an error while trying to {intent.replace('_', ' ')}.",
                "data": {"error": str(e)}
            }
    
    async def create_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Create a new assignment"""
        try:
            # Get authenticated client that can bypass RLS or use teacher's session
            db_client = self.get_authenticated_client(user_token)
            
            # Extract parameters with defaults
            title = params.get("title", "New Assignment")
            description = params.get("description", "")
            course_code = params.get("course", "").upper()
            points = params.get("points", 100)
            publish = params.get("publish", False)
            
            # Find course by course code or create if not exists
            course_id = await self._find_or_create_course(course_code, user_id, db_client)
            if not course_id:
                return {
                    "success": False,
                    "message": f"I couldn't find or create course '{course_code}'.",
                    "data": None
                }
            
            # Create assignment with teacher's user_id
            assignment_data = {
                "id": str(uuid.uuid4()),
                "title": title,
                "description": description,
                "course_id": course_id,
                "total_points": points,
                "status": "published" if publish else "draft",
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),  # Default: 1 week
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            result = db_client.table("assignments").insert(assignment_data).execute()
            
            if result.data:
                assignment = result.data[0]
                status_msg = "published and visible to students" if publish else "saved as draft"
                return {
                    "success": True,
                    "message": f"✅ Created assignment '{title}' for {course_code} worth {points} points and {status_msg}!",
                    "data": {
                        "assignment_id": assignment["id"],
                        "title": assignment["title"],
                        "course": course_code,
                        "points": points,
                        "status": assignment["status"]
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to create assignment in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error creating assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while creating the assignment.",
                "data": {"error": str(e)}
            }
    
    async def _find_or_create_course(self, course_code: str, user_id: str, db_client: Client) -> Optional[str]:
        """Find course by code or create it if it doesn't exist"""
        try:
            # Try to find existing course
            result = db_client.table("courses").select("id").eq("title", course_code).execute()
            
            if result.data:
                return result.data[0]["id"]
            
            # Create new course if not found - with teacher's user_id
            course_data = {
                "id": str(uuid.uuid4()),
                "title": course_code,
                "description": f"Course {course_code}",
                "teacher_id": user_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            result = db_client.table("courses").insert(course_data).execute()
            if result.data:
                logger.info(f"Created new course: {course_code}")
                return result.data[0]["id"]
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding/creating course {course_code}: {e}")
            return None
    
    async def update_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update an existing assignment"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            # Extract parameters - be flexible with assignment identification
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")  # LLM might put assignment name here
            )
            
            # For updates, separate the new title from the identifier
            new_title = params.get("new_title") or (params.get("title") if "assignment_name" in params or "assignment_id" in params else None)
            description = params.get("description")
            points = params.get("points")
            due_date = params.get("due_date")
            status = params.get("status")
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or ID to update it.",
                    "data": None
                }
            
            # Find assignment by name or ID
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            if not assignment:
                return {
                    "success": False,
                    "message": f"I couldn't find assignment '{assignment_identifier}'.",
                    "data": None
                }
            
            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}
            changes = []
            
            if new_title:
                update_data["title"] = new_title
                changes.append(f"title to '{new_title}'")
            if description:
                update_data["description"] = description
                changes.append("description")
            if points:
                update_data["total_points"] = points
                changes.append(f"points to {points}")
            if due_date:
                update_data["due_date"] = due_date
                changes.append(f"due date to {due_date}")
            if status:
                update_data["status"] = status
                changes.append(f"status to {status}")
            
            if not changes:
                return {
                    "success": False,
                    "message": "I need to know what you want to update about the assignment.",
                    "data": None
                }
            
            # Update assignment
            result = db_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
            
            if result.data:
                return {
                    "success": True,
                    "message": f"✅ Updated assignment '{assignment['title']}' - changed {', '.join(changes)}!",
                    "data": {
                        "assignment_id": assignment["id"],
                        "changes": changes,
                        "updated_fields": update_data
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to update assignment in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error updating assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while updating the assignment.",
                "data": {"error": str(e)}
            }
    
    async def update_rubric(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update assignment rubric"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            rubric_text = params.get("rubric_text") or params.get("rubric")
            
            if not assignment_identifier or not rubric_text:
                return {
                    "success": False,
                    "message": "I need an assignment name and the new rubric content.",
                    "data": None
                }
            
            # Find assignment
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            if not assignment:
                return {
                    "success": False,
                    "message": f"I couldn't find assignment '{assignment_identifier}'.",
                    "data": None
                }
            
            # Update rubric
            update_data = {
                "rubric_markdown": rubric_text,
                "updated_at": datetime.now().isoformat()
            }
            
            result = db_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
            
            if result.data:
                return {
                    "success": True,
                    "message": f"✅ Updated rubric for assignment '{assignment['title']}'!",
                    "data": {
                        "assignment_id": assignment["id"],
                        "assignment_title": assignment["title"],
                        "new_rubric": rubric_text
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to update rubric in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error updating rubric: {e}")
            return {
                "success": False,
                "message": "I encountered an error while updating the rubric.",
                "data": {"error": str(e)}
            }
    
    async def delete_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Delete an assignment"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or ID to delete it.",
                    "data": None
                }
            
            # Find assignment
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            if not assignment:
                return {
                    "success": False,
                    "message": f"I couldn't find assignment '{assignment_identifier}'.",
                    "data": None
                }
            
            # Delete assignment
            result = db_client.table("assignments").delete().eq("id", assignment["id"]).execute()
            
            if result.data is not None:  # Supabase returns [] for successful delete
                return {
                    "success": True,
                    "message": f"✅ Deleted assignment '{assignment['title']}'!",
                    "data": {
                        "deleted_assignment": assignment["title"],
                        "assignment_id": assignment["id"]
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to delete assignment from database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error deleting assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while deleting the assignment.",
                "data": {"error": str(e)}
            }
    
    async def get_submission_count(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get submission count for an assignment"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or ID to count submissions.",
                    "data": None
                }
            
            # Enhanced assignment finding with course fallback
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            if not assignment:
                # Additional fallback: Check if we can find a course and list its assignments
                if "assignment" in assignment_identifier.lower():
                    course_keywords = assignment_identifier.lower().replace("assignment", "").replace("the", "").strip()
                    course = await self._find_course(course_keywords, db_client)
                    if course:
                        # Get all assignments in the course
                        assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                        assignments = assignments_result.data or []
                        
                        if assignments:
                            return {
                                "success": True,
                                "message": f"📚 Found {len(assignments)} assignment(s) in '{course['title']}' course. Here's the submission summary:",
                                "data": {
                                    "course_title": course["title"],
                                    "assignments_summary": [
                                        {
                                            "title": a["title"],
                                            "id": a["id"]
                                        } for a in assignments
                                    ]
                                }
                            }
                        else:
                            return {
                                "success": False,
                                "message": f"I found course '{course['title']}' but it has no assignments yet.",
                                "data": None
                            }
                
                return {
                    "success": False,
                    "message": f"I couldn't find assignment '{assignment_identifier}'.",
                    "data": None
                }
            
            # Get submission count for the found assignment
            submissions_result = db_client.table("submissions").select("id", count="exact").eq("assignment_id", assignment["id"]).execute()
            submission_count = submissions_result.count or 0
            
            # Check if assignment was found via course lookup (provide context)
            found_via_course = "assignment" in assignment_identifier.lower() and assignment_identifier.lower() != assignment["title"].lower()
            
            if found_via_course:
                # Get course info for context
                course_result = db_client.table("courses").select("title").eq("id", assignment["course_id"]).execute()
                course_title = course_result.data[0]["title"] if course_result.data else "Unknown Course"
                
                message = f"📊 Found assignment '{assignment['title']}' in '{course_title}' course - {submission_count} student(s) have submitted their work."
            else:
                message = f"📊 Assignment '{assignment['title']}' has {submission_count} submission(s)."
            
            return {
                "success": True,
                "message": message,
                "data": {
                    "assignment_title": assignment["title"],
                    "assignment_id": assignment["id"],
                    "submission_count": submission_count,
                    "found_via_course_lookup": found_via_course
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting submission count: {e}")
            return {
                "success": False,
                "message": "I encountered an error while checking submission count.",
                "data": {"error": str(e)}
            }
    
    async def create_course(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Create a new course"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            title = params.get("title") or params.get("course_code")
            description = params.get("description", f"Course {title}")
            
            if not title:
                return {
                    "success": False,
                    "message": "I need a course title or code to create it.",
                    "data": None
                }
            
            # Create course
            course_data = {
                "id": str(uuid.uuid4()),
                "title": title.upper(),
                "description": description,
                "teacher_id": user_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            result = db_client.table("courses").insert(course_data).execute()
            
            if result.data:
                course = result.data[0]
                return {
                    "success": True,
                    "message": f"✅ Created course '{course['title']}'!",
                    "data": {
                        "course_id": course["id"],
                        "course_title": course["title"],
                        "description": course["description"]
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to create course in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error creating course: {e}")
            return {
                "success": False,
                "message": "I encountered an error while creating the course.",
                "data": {"error": str(e)}
            }
    
    async def update_course(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update an existing course"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            course_identifier = params.get("course_id") or params.get("course_name")
            title = params.get("title")
            description = params.get("description")
            
            if not course_identifier:
                return {
                    "success": False,
                    "message": "I need a course name or ID to update it.",
                    "data": None
                }
            
            # Find course
            course = await self._find_course(course_identifier, db_client)
            if not course:
                return {
                    "success": False,
                    "message": f"I couldn't find course '{course_identifier}'.",
                    "data": None
                }
            
            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}
            changes = []
            
            if title:
                update_data["title"] = title.upper()
                changes.append(f"title to '{title.upper()}'")
            if description:
                update_data["description"] = description
                changes.append("description")
            
            if not changes:
                return {
                    "success": False,
                    "message": "I need to know what you want to update about the course.",
                    "data": None
                }
            
            # Update course
            result = db_client.table("courses").update(update_data).eq("id", course["id"]).execute()
            
            if result.data:
                return {
                    "success": True,
                    "message": f"✅ Updated course '{course['title']}' - changed {', '.join(changes)}!",
                    "data": {
                        "course_id": course["id"],
                        "changes": changes,
                        "updated_fields": update_data
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to update course in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error updating course: {e}")
            return {
                "success": False,
                "message": "I encountered an error while updating the course.",
                "data": {"error": str(e)}
            }

    async def _find_assignment(self, identifier: str, db_client: Client, user_id: str = None) -> Optional[Dict]:
        """Find assignment by ID or name, with fallback to course-based lookup"""
        try:
            # Try by ID first
            if len(identifier) == 36:  # UUID length
                result = db_client.table("assignments").select("*").eq("id", identifier).execute()
                if result.data:
                    return result.data[0]
            
            # Try by exact title match (case insensitive)
            result = db_client.table("assignments").select("*").ilike("title", f"%{identifier}%").execute()
            if result.data:
                return result.data[0]
            
            # FALLBACK: Check if identifier could be "course + assignment" pattern
            # e.g., "machine learning assignment" -> look for assignments in "machine learning" course
            if "assignment" in identifier.lower():
                # Extract potential course name by removing "assignment" and common words
                course_keywords = identifier.lower().replace("assignment", "").replace("the", "").strip()
                
                if course_keywords:
                    logger.info(f"Searching for assignments in course matching: '{course_keywords}'")
                    
                    # Find course by the extracted keywords
                    course = await self._find_course(course_keywords, db_client)
                    if course:
                        logger.info(f"Found course '{course['title']}', looking for assignments...")
                        
                        # Get assignments in this course
                        assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                        assignments = assignments_result.data or []
                        
                        if assignments:
                            # If there's only one assignment, return it
                            if len(assignments) == 1:
                                logger.info(f"Found single assignment '{assignments[0]['title']}' in course '{course['title']}'")
                                return assignments[0]
                            else:
                                # Multiple assignments - return the first one but log this ambiguity
                                logger.info(f"Found {len(assignments)} assignments in course '{course['title']}', returning first one")
                                return assignments[0]
            
            return None
        except Exception as e:
            logger.error(f"Error finding assignment {identifier}: {e}")
            return None
    
    async def _find_course(self, identifier: str, db_client: Client) -> Optional[Dict]:
        """Find course by ID or name"""
        try:
            # Try by ID first
            if len(identifier) == 36:  # UUID length
                result = db_client.table("courses").select("*").eq("id", identifier).execute()
                if result.data:
                    return result.data[0]
            
            # Try by title (case insensitive)
            result = db_client.table("courses").select("*").ilike("title", f"%{identifier}%").execute()
            if result.data:
                return result.data[0]
            
            return None
        except Exception as e:
            logger.error(f"Error finding course {identifier}: {e}")
            return None

    async def publish_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Publish or unpublish an assignment"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            action = params.get("action", "publish")  # publish or unpublish
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or ID to publish/unpublish it.",
                    "data": None
                }
            
            # Find assignment
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            if not assignment:
                return {
                    "success": False,
                    "message": f"I couldn't find assignment '{assignment_identifier}'.",
                    "data": None
                }
            
            # Update status
            new_status = "published" if action == "publish" else "draft"
            update_data = {
                "status": new_status,
                "updated_at": datetime.now().isoformat()
            }
            
            result = db_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
            
            if result.data:
                action_msg = "published and visible to students" if new_status == "published" else "unpublished and hidden from students"
                return {
                    "success": True,
                    "message": f"✅ Assignment '{assignment['title']}' has been {action_msg}!",
                    "data": {
                        "assignment_id": assignment["id"],
                        "assignment_title": assignment["title"],
                        "new_status": new_status
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to update assignment status in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"Error publishing assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while updating the assignment status.",
                "data": {"error": str(e)}
            }

    async def get_info(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get information about courses, assignments, or general stats"""
        try:
            db_client = self.get_authenticated_client(user_token)
            
            info_type = params.get("type", "general")  # course, assignment, general
            identifier = params.get("name") or params.get("id")
            
            if info_type == "course" and identifier:
                course = await self._find_course(identifier, db_client)
                if not course:
                    return {
                        "success": False,
                        "message": f"I couldn't find course '{identifier}'.",
                        "data": None
                    }
                
                # Get assignments in course
                assignments_result = db_client.table("assignments").select("title, status, total_points").eq("course_id", course["id"]).execute()
                assignments = assignments_result.data or []
                
                return {
                    "success": True,
                    "message": f"📚 Course '{course['title']}' has {len(assignments)} assignment(s).",
                    "data": {
                        "course_title": course["title"],
                        "description": course["description"],
                        "assignment_count": len(assignments),
                        "assignments": assignments
                    }
                }
            
            elif info_type == "assignment" and identifier:
                assignment = await self._find_assignment(identifier, db_client, user_id)
                if not assignment:
                    return {
                        "success": False,
                        "message": f"I couldn't find assignment '{identifier}'.",
                        "data": None
                    }
                
                # Get submission count
                submissions_result = db_client.table("submissions").select("id", count="exact").eq("assignment_id", assignment["id"]).execute()
                submission_count = submissions_result.count or 0
                
                return {
                    "success": True,
                    "message": f"📝 Assignment '{assignment['title']}' worth {assignment['total_points']} points has {submission_count} submission(s).",
                    "data": {
                        "assignment_title": assignment["title"],
                        "description": assignment["description"],
                        "total_points": assignment["total_points"],
                        "status": assignment["status"],
                        "due_date": assignment.get("due_date"),
                        "submission_count": submission_count
                    }
                }
            
            else:
                # General info - all courses and assignments
                courses_result = db_client.table("courses").select("*").eq("teacher_id", user_id).execute()
                courses = courses_result.data or []
                
                assignments_result = db_client.table("assignments").select("id, title, status").execute()
                assignments = assignments_result.data or []
                
                return {
                    "success": True,
                    "message": f"📊 You have {len(courses)} course(s) and {len(assignments)} assignment(s) total.",
                    "data": {
                        "total_courses": len(courses),
                        "total_assignments": len(assignments),
                        "courses": [{"title": c["title"], "id": c["id"]} for c in courses],
                        "recent_assignments": [{"title": a["title"], "status": a["status"]} for a in assignments[:5]]
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting info: {e}")
            return {
                "success": False,
                "message": "I encountered an error while retrieving information.",
                "data": {"error": str(e)}
            }

# Initialize action handlers
action_handlers = ActionHandlers(supabase)

# Routes
@app.get("/")
async def root():
    return {"message": "Mylo AI Teaching Assistant Agent", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "agent": "Mylo", "version": "1.0.0"}

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to check configuration"""
    return {
        "supabase_url_set": bool(supabase_url),
        "supabase_key_set": bool(supabase_key),
        "openai_key_set": bool(openai_api_key),
        "openai_key_prefix": openai_api_key[:7] + "..." if openai_api_key else "NOT_SET"
    }

@app.post("/debug/openai-test")
async def test_openai():
    """Test OpenAI connection"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10
        )
        return {
            "success": True,
            "response": response.choices[0].message.content
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/agent/process", response_model=AgentResponse)
async def process_agent_request(
    request: AgentRequest,
    user: dict = Depends(verify_auth_token),
    authorization: str = Header(None)
):
    """Main endpoint for processing agent requests"""
    try:
        logger.info(f"Processing request from user {user['id']}: {request.message}")
        
        # Extract the token from the authorization header
        user_token = None
        if authorization and authorization.startswith("Bearer "):
            user_token = authorization.split(" ")[1]
        
        # Process message with Mylo to get intent and parameters
        intent_result = await mylo.process_message(
            message=request.message,
            user_id=user["id"],
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
        action_result = await action_handlers.execute(intent, parameters, user["id"], user_token)
        
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
        logger.error(f"Error processing agent request: {e}")
        return AgentResponse(
            response="I encountered an error. Please try again.",
            action_taken="error",
            success=False,
            data={"error": str(e)}
        )

@app.post("/api/agent/test", response_model=AgentResponse)
async def test_agent_request(
    request: AgentRequest,
    user: dict = Depends(get_test_user)
):
    """Test endpoint without authentication for development"""
    try:
        # Ensure test user exists in database before processing
        await ensure_test_user_exists()
        
        logger.info(f"TEST: Processing request from user {user['id']}: {request.message}")
        
        # Process message with Mylo to get intent and parameters
        intent_result = await mylo.process_message(
            message=request.message,
            user_id=user["id"],
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

@app.get("/debug/test-user")
async def check_test_user():
    """Debug endpoint to check if test user exists"""
    try:
        service_key = supabase_service_key or supabase_key
        admin_client = create_client(supabase_url, service_key)
        
        # Check if user exists
        result = admin_client.table("users").select("*").eq("id", test_user_id).execute()
        
        return {
            "test_user_id": test_user_id,
            "test_user_email": test_user_email,
            "test_user_name": test_user_name,
            "user_exists": bool(result.data),
            "user_data": result.data[0] if result.data else None,
            "using_service_key": service_key != supabase_key
        }
        
    except Exception as e:
        return {
            "test_user_id": test_user_id,
            "error": str(e),
            "user_exists": False
        }

@app.get("/debug/list-data")
async def list_all_data():
    """Debug endpoint to list all courses and assignments"""
    try:
        service_key = supabase_service_key or supabase_key
        admin_client = create_client(supabase_url, service_key)
        
        # Get all courses
        courses_result = admin_client.table("courses").select("id, title, teacher_id").execute()
        courses = courses_result.data or []
        
        # Get all assignments with course info
        assignments_result = admin_client.table("assignments").select("id, title, course_id").execute()
        assignments = assignments_result.data or []
        
        # Join assignment data with course data
        enriched_assignments = []
        for assignment in assignments:
            course_info = next((c for c in courses if c["id"] == assignment["course_id"]), None)
            enriched_assignments.append({
                "assignment_id": assignment["id"],
                "assignment_title": assignment["title"],
                "course_id": assignment["course_id"],
                "course_title": course_info["title"] if course_info else "Unknown Course"
            })
        
        return {
            "total_courses": len(courses),
            "total_assignments": len(assignments),
            "courses": courses,
            "assignments": enriched_assignments
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "courses": [],
            "assignments": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
