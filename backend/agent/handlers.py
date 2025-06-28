"""
Action Handlers for AI Teaching Assistant Agent
Contains all database operations and business logic for teacher actions
"""
import logging
import uuid
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from supabase import Client
from database import get_authenticated_client

logger = logging.getLogger(__name__)

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
            db_client = get_authenticated_client(user_token)
            
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
            db_client = get_authenticated_client(user_token)
            
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
            db_client = get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            rubric_text = params.get("rubric_text") or params.get("rubric")
            
            if not assignment_identifier or not rubric_text:
                return {
                    "success": False,
                    "message": "I need both an assignment name and the new rubric content.",
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
                "rubric": rubric_text,
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
            db_client = get_authenticated_client(user_token)
            
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
            db_client = get_authenticated_client(user_token)
            
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
            db_client = get_authenticated_client(user_token)
            
            title = params.get("title") or params.get("course_code", "New Course")
            description = params.get("description", "")
            
            # Create course with teacher's user_id
            course_data = {
                "id": str(uuid.uuid4()),
                "title": title,
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
                    "message": f"✅ Created course '{title}'!",
                    "data": {
                        "course_id": course["id"],
                        "title": course["title"],
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
            db_client = get_authenticated_client(user_token)
            
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
                update_data["title"] = title
                changes.append(f"title to '{title}'")
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
            db_client = get_authenticated_client(user_token)
            
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
            db_client = get_authenticated_client(user_token)
            
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