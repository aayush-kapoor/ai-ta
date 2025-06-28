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
from .date_utils import process_date_expression

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
            "conversation": self.handle_conversation,
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
            logger.info(f"📝 CREATE_ASSIGNMENT: Starting with params: {params}")
            logger.info(f"📝 CREATE_ASSIGNMENT: User ID: {user_id}")
            
            # Use service role to bypass RLS for now
            logger.info("📝 CREATE_ASSIGNMENT: Using service role to bypass RLS")
            db_client = get_authenticated_client()  # No user token = service role
            
            # Extract parameters with defaults
            title = params.get("title", "New Assignment")
            description = params.get("description", "")
            course_code = params.get("course", "").upper()
            points = params.get("points", 100)
            publish = params.get("publish", False)
            
            logger.info(f"📝 CREATE_ASSIGNMENT: Creating '{title}' for course '{course_code}'")
            
            # Find course by course code or create if not exists
            course_id = await self._find_or_create_course(course_code, user_id, db_client)
            if not course_id:
                logger.error(f"📝 CREATE_ASSIGNMENT: Failed to find/create course '{course_code}'")
                return {
                    "success": False,
                    "message": f"I couldn't find or create course '{course_code}'.",
                    "data": None
                }
            
            logger.info(f"📝 CREATE_ASSIGNMENT: Using course ID: {course_id}")
            
            # Create assignment data with all required fields
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
            
            logger.info(f"📝 CREATE_ASSIGNMENT: Assignment data: {assignment_data}")
            logger.info(f"📝 CREATE_ASSIGNMENT: Inserting assignment...")
            
            result = db_client.table("assignments").insert(assignment_data).execute()
            
            logger.info(f"📝 CREATE_ASSIGNMENT: Insert result: {result}")
            logger.info(f"📝 CREATE_ASSIGNMENT: Result data: {result.data}")
            
            if result.data:
                assignment = result.data[0]
                status_msg = "published and visible to students" if publish else "saved as draft"
                logger.info(f"📝 CREATE_ASSIGNMENT: Successfully created assignment '{assignment['id']}'")
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
                logger.error("📝 CREATE_ASSIGNMENT: Insert returned no data")
                return {
                    "success": False,
                    "message": "Failed to create assignment in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"📝 CREATE_ASSIGNMENT: Exception occurred: {e}")
            logger.error(f"📝 CREATE_ASSIGNMENT: Exception type: {type(e)}")
            import traceback
            logger.error(f"📝 CREATE_ASSIGNMENT: Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "message": "I encountered an error while creating the assignment.",
                "data": {"error": str(e), "type": str(type(e))}
            }
    
    async def _find_or_create_course(self, course_code: str, user_id: str, db_client: Client) -> Optional[str]:
        """Find course by code or create it if it doesn't exist - uses intelligent matching"""
        try:
            logger.info(f"📚 FIND_OR_CREATE_COURSE: Looking for course '{course_code}' (using service role)")
            
            # Clean up the course name - remove "course" suffix and extra whitespace
            cleaned_course_name = course_code.strip()
            if cleaned_course_name.lower().endswith(" course"):
                cleaned_course_name = cleaned_course_name[:-7].strip()  # Remove " course"
            
            logger.info(f"📚 FIND_OR_CREATE_COURSE: Cleaned course name: '{cleaned_course_name}'")
            
            # Try to find existing course using flexible matching (same as _find_course)
            # First try exact match with cleaned name
            result = db_client.table("courses").select("id, teacher_id, title").ilike("title", cleaned_course_name).execute()
            
            if not result.data:
                # Try partial match
                result = db_client.table("courses").select("id, teacher_id, title").ilike("title", f"%{cleaned_course_name}%").execute()
            
            if result.data:
                # Filter by teacher to ensure we only match courses owned by this user
                user_courses = [course for course in result.data if course["teacher_id"] == user_id]
                if user_courses:
                    course = user_courses[0]  # Take the first match
                    logger.info(f"📚 FIND_OR_CREATE_COURSE: Found existing course: '{course['title']}' (ID: {course['id']})")
                    return course["id"]
                else:
                    logger.info(f"📚 FIND_OR_CREATE_COURSE: Found courses matching '{cleaned_course_name}' but none owned by user {user_id}")
            
            # No existing course found, create new one using the cleaned name
            logger.info(f"📚 FIND_OR_CREATE_COURSE: Creating new course '{cleaned_course_name}'")
            course_data = {
                "id": str(uuid.uuid4()),
                "title": cleaned_course_name,  # Use cleaned name
                "description": f"Course {cleaned_course_name}",
                "teacher_id": user_id,  # Associate with the requesting user
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            logger.info(f"📚 FIND_OR_CREATE_COURSE: Course data: {course_data}")
            result = db_client.table("courses").insert(course_data).execute()
            
            if result.data:
                course_id = result.data[0]["id"]
                logger.info(f"📚 FIND_OR_CREATE_COURSE: Created new course: '{cleaned_course_name}' (ID: {course_id})")
                return course_id
            else:
                logger.error(f"📚 FIND_OR_CREATE_COURSE: Failed to create course - no data returned")
                return None
            
        except Exception as e:
            logger.error(f"📚 FIND_OR_CREATE_COURSE: Error with course {course_code}: {e}")
            import traceback
            logger.error(f"📚 FIND_OR_CREATE_COURSE: Traceback: {traceback.format_exc()}")
            return None
    
    async def update_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update an existing assignment"""
        try:
            logger.info(f"🔧 UPDATE_ASSIGNMENT: Starting with params: {params}")
            logger.info(f"🔧 UPDATE_ASSIGNMENT: User ID: {user_id}")
            
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Extract parameters - be flexible with assignment identification
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")  # LLM might put assignment name here
            )
            
            logger.info(f"🔧 UPDATE_ASSIGNMENT: Assignment identifier: '{assignment_identifier}'")
            
            # For updates, separate the new title from the identifier
            new_title = params.get("new_title") or (params.get("title") if "assignment_name" in params or "assignment_id" in params else None)
            description = params.get("description")
            points = params.get("points")
            due_date = params.get("due_date")
            status = params.get("status")
            
            logger.info(f"🔧 UPDATE_ASSIGNMENT: Extracted values - new_title: {new_title}, points: {points}, description: {description}, due_date: {due_date}")
            
            if not assignment_identifier:
                logger.warning("🔧 UPDATE_ASSIGNMENT: No assignment identifier provided")
                return {
                    "success": False,
                    "message": "I need an assignment name or course name to update assignments.",
                    "data": None
                }
            
            # First, try to find assignment by direct name/ID
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            
            if assignment:
                # Found specific assignment, update it
                logger.info(f"🔧 UPDATE_ASSIGNMENT: Found specific assignment: {assignment['title']}")
                return await self._update_single_assignment(assignment, params, user_id, user_token)
            
            # If no direct assignment found, check if this might be a course-based request
            logger.info(f"🔧 UPDATE_ASSIGNMENT: No direct assignment found, checking for course-based request...")
            
            # Extract course keywords from identifier
            course_keywords = assignment_identifier.lower()
            
            # Remove common words that don't help identify the course
            course_keywords = course_keywords.replace("assignment", "").replace("the", "").replace("in", "").replace("course", "").strip()
            
            if course_keywords:
                logger.info(f"🔧 UPDATE_ASSIGNMENT: Searching for assignments in course matching: '{course_keywords}'")
                
                # Find course by keywords
                course = await self._find_course(course_keywords, db_client, user_id)
                if course:
                    logger.info(f"🔧 UPDATE_ASSIGNMENT: Found course '{course['title']}', looking for assignments...")
                    
                    # Get all assignments in this course
                    assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                    assignments = assignments_result.data or []
                    
                    logger.info(f"🔧 UPDATE_ASSIGNMENT: Found {len(assignments)} assignments in course '{course['title']}'")
                    
                    if not assignments:
                        return {
                            "success": False,
                            "message": f"No assignments found in course '{course['title']}'.",
                            "data": None
                        }
                    elif len(assignments) == 1:
                        # Single assignment - update it
                        assignment = assignments[0]
                        logger.info(f"🔧 UPDATE_ASSIGNMENT: Updating single assignment '{assignment['title']}' in course '{course['title']}'")
                        result = await self._update_single_assignment(assignment, params, user_id, user_token)
                        
                        # Enhance the message to mention the course context
                        if result["success"]:
                            result["message"] = result["message"].replace("assignment", f"assignment in course '{course['title']}'")
                        
                        return result
                    else:
                        # Multiple assignments - update all of them
                        logger.info(f"🔧 UPDATE_ASSIGNMENT: Updating {len(assignments)} assignments in course '{course['title']}'")
                        return await self._update_multiple_assignments(assignments, params, course['title'], user_id, user_token)
                else:
                    logger.warning(f"🔧 UPDATE_ASSIGNMENT: No course found matching '{course_keywords}'")
            
            # If we get here, nothing was found
            return {
                "success": False,
                "message": f"I couldn't find any assignment or course matching '{assignment_identifier}'. Please provide a specific assignment name or course name.",
                "data": None
            }
            
        except Exception as e:
            logger.error(f"🔧 UPDATE_ASSIGNMENT: Exception occurred: {e}")
            logger.error(f"🔧 UPDATE_ASSIGNMENT: Exception type: {type(e)}")
            import traceback
            logger.error(f"🔧 UPDATE_ASSIGNMENT: Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "message": "I encountered an error while updating the assignment.",
                "data": {"error": str(e), "type": str(type(e))}
            }

    async def _update_single_assignment(self, assignment: Dict, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update a single assignment"""
        try:
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Verify the assignment belongs to this user's courses (security check)
            course_check = db_client.table("courses").select("teacher_id").eq("id", assignment["course_id"]).execute()
            if not course_check.data or course_check.data[0]["teacher_id"] != user_id:
                logger.warning(f"🔧 UPDATE_ASSIGNMENT: User {user_id} doesn't own assignment {assignment['id']}")
                return {
                    "success": False,
                    "message": "You can only update assignments in your own courses.",
                    "data": None
                }
            
            # Extract update parameters
            new_title = params.get("new_title") or (params.get("title") if "assignment_name" in params or "assignment_id" in params else None)
            description = params.get("description")
            points = params.get("points")
            due_date = params.get("due_date")
            status = params.get("status")
            
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
                # Process natural language date expressions
                processed_date = process_date_expression(due_date)
                update_data["due_date"] = processed_date
                changes.append(f"due date to {processed_date[:10]}")  # Show just the date part
            if status:
                update_data["status"] = status
                changes.append(f"status to {status}")
            
            if not changes:
                return {
                    "success": False,
                    "message": "I need to know what you want to update about the assignment.",
                    "data": None
                }
            
            # Use service role for the actual update to bypass RLS (after security verification)
            admin_client = get_authenticated_client()  # Service role, no user token
            
            # Update assignment with service role
            result = admin_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
            
            if result.data and len(result.data) > 0:
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
                    "data": {"result": str(result), "update_data": update_data}
                }
                
        except Exception as e:
            logger.error(f"Error updating single assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while updating the assignment.",
                "data": {"error": str(e)}
            }

    async def _update_multiple_assignments(self, assignments: list, params: Dict[str, Any], course_title: str, user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update multiple assignments in a course"""
        try:
            successful_updates = []
            failed_updates = []
            
            for assignment in assignments:
                try:
                    result = await self._update_single_assignment(assignment, params, user_id, user_token)
                    if result["success"]:
                        successful_updates.append(assignment["title"])
                    else:
                        failed_updates.append(assignment["title"])
                except Exception as e:
                    logger.error(f"Failed to update assignment {assignment['title']}: {e}")
                    failed_updates.append(assignment["title"])
            
            # Extract update type for message
            update_types = []
            if params.get("points"):
                update_types.append(f"points to {params['points']}")
            if params.get("due_date"):
                processed_date = process_date_expression(params['due_date'])
                update_types.append(f"due date to {processed_date[:10]}")
            if params.get("description"):
                update_types.append("description")
            if params.get("status"):
                update_types.append(f"status to {params['status']}")
            
            update_desc = ", ".join(update_types) if update_types else "specified fields"
            
            if successful_updates and not failed_updates:
                return {
                    "success": True,
                    "message": f"✅ Successfully updated {len(successful_updates)} assignments in course '{course_title}' - changed {update_desc}: {', '.join(successful_updates)}",
                    "data": {
                        "course_title": course_title,
                        "successful_assignments": successful_updates,
                        "total_updated": len(successful_updates),
                        "changes": update_desc
                    }
                }
            elif successful_updates and failed_updates:
                return {
                    "success": True,
                    "message": f"⚠️ Partially updated assignments in course '{course_title}'. Successful: {', '.join(successful_updates)}. Failed: {', '.join(failed_updates)}",
                    "data": {
                        "course_title": course_title,
                        "successful_assignments": successful_updates,
                        "failed_assignments": failed_updates,
                        "total_updated": len(successful_updates)
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to update any assignments in course '{course_title}'.",
                    "data": {
                        "course_title": course_title,
                        "failed_assignments": failed_updates
                    }
                }
                
        except Exception as e:
            logger.error(f"Error updating multiple assignments: {e}")
            return {
                "success": False,
                "message": f"I encountered an error while trying to update assignments in course '{course_title}'.",
                "data": {"error": str(e)}
            }
    
    async def update_rubric(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Update assignment rubric"""
        try:
            logger.info(f"🔧 UPDATE_RUBRIC: Starting with params: {params}")
            
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            rubric_text = params.get("rubric_text") or params.get("rubric")
            
            logger.info(f"🔧 UPDATE_RUBRIC: Extracted assignment_identifier: '{assignment_identifier}'")
            logger.info(f"🔧 UPDATE_RUBRIC: Extracted rubric_text: '{rubric_text}'")
            
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
            
            # Verify the assignment belongs to this user's courses (security check)
            course_check = db_client.table("courses").select("teacher_id").eq("id", assignment["course_id"]).execute()
            if not course_check.data or course_check.data[0]["teacher_id"] != user_id:
                logger.warning(f"🔧 UPDATE_RUBRIC: User {user_id} doesn't own assignment {assignment['id']}")
                return {
                    "success": False,
                    "message": "You can only update rubrics for assignments in your own courses.",
                    "data": None
                }
            
            # Update rubric
            update_data = {
                "rubric_markdown": rubric_text,
                "updated_at": datetime.now().isoformat()
            }
            
            # Use service role for the actual update to bypass RLS (after security verification)
            admin_client = get_authenticated_client()  # Service role, no user token
            result = admin_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
            
            if result.data and len(result.data) > 0:
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
                    "data": {"result": str(result)}
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
            logger.info(f"🗑️ DELETE_ASSIGNMENT: Starting with params: {params}")
            
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Extract assignment identifier
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            
            logger.info(f"🗑️ DELETE_ASSIGNMENT: Assignment identifier: '{assignment_identifier}'")
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or course name to delete assignments.",
                    "data": None
                }
            
            # First, try to find assignment by direct name/ID
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            
            if assignment:
                # Found specific assignment, delete it
                logger.info(f"🗑️ DELETE_ASSIGNMENT: Found specific assignment: {assignment['title']}")
                return await self._delete_single_assignment(assignment, user_id, user_token)
            
            # If no direct assignment found, check if this might be a course-based request
            logger.info(f"🗑️ DELETE_ASSIGNMENT: No direct assignment found, checking for course-based request...")
            
            # Extract course keywords from identifier
            course_keywords = assignment_identifier.lower()
            course_keywords = course_keywords.replace("assignment", "").replace("the", "").replace("in", "").replace("course", "").strip()
            
            if course_keywords:
                logger.info(f"🗑️ DELETE_ASSIGNMENT: Searching for assignments in course matching: '{course_keywords}'")
                
                # Find course by keywords
                course = await self._find_course(course_keywords, db_client, user_id)
                if course:
                    logger.info(f"🗑️ DELETE_ASSIGNMENT: Found course '{course['title']}', looking for assignments...")
                    
                    # Get all assignments in this course
                    assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                    assignments = assignments_result.data or []
                    
                    logger.info(f"🗑️ DELETE_ASSIGNMENT: Found {len(assignments)} assignments in course '{course['title']}'")
                    
                    if not assignments:
                        return {
                            "success": False,
                            "message": f"No assignments found in course '{course['title']}'.",
                            "data": None
                        }
                    elif len(assignments) == 1:
                        # Single assignment - delete it
                        assignment = assignments[0]
                        logger.info(f"🗑️ DELETE_ASSIGNMENT: Deleting single assignment '{assignment['title']}' in course '{course['title']}'")
                        result = await self._delete_single_assignment(assignment, user_id, user_token)
                        
                        # Enhance the message to mention the course context
                        if result["success"]:
                            result["message"] = result["message"].replace("assignment", f"assignment in course '{course['title']}'")
                        
                        return result
                    else:
                        # Multiple assignments - ask for confirmation or delete all
                        logger.info(f"🗑️ DELETE_ASSIGNMENT: Multiple assignments found in course '{course['title']}'")
                        assignment_titles = [a['title'] for a in assignments]
                        return {
                            "success": False,
                            "message": f"I found {len(assignments)} assignments in course '{course['title']}': {', '.join(assignment_titles)}. Please specify which one you want to delete.",
                            "data": {
                                "course_title": course['title'],
                                "assignments": assignment_titles,
                                "action_needed": "Please specify the exact assignment name to delete."
                            }
                        }
                else:
                    logger.warning(f"🗑️ DELETE_ASSIGNMENT: No course found matching '{course_keywords}'")
            
            # If we get here, nothing was found
            return {
                "success": False,
                "message": f"I couldn't find any assignment or course matching '{assignment_identifier}'. Please provide a specific assignment name or course name.",
                "data": None
            }
            
        except Exception as e:
            logger.error(f"🗑️ DELETE_ASSIGNMENT: Exception occurred: {e}")
            return {
                "success": False,
                "message": "I encountered an error while trying to delete the assignment.",
                "data": {"error": str(e)}
            }

    async def _delete_single_assignment(self, assignment: Dict, user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Delete a single assignment"""
        try:
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Verify ownership
            course_check = db_client.table("courses").select("teacher_id").eq("id", assignment["course_id"]).execute()
            if not course_check.data or course_check.data[0]["teacher_id"] != user_id:
                logger.warning(f"🗑️ DELETE_ASSIGNMENT: User {user_id} doesn't own assignment {assignment['id']}")
                return {
                    "success": False,
                    "message": "You can only delete assignments in your own courses.",
                    "data": None
                }
            
            # Use service role for the actual deletion
            admin_client = get_authenticated_client()  # Service role, no user token
            
            # Delete assignment with service role
            result = admin_client.table("assignments").delete().eq("id", assignment["id"]).execute()
            
            if result.data and len(result.data) > 0:
                return {
                    "success": True,
                    "message": f"✅ Successfully deleted assignment '{assignment['title']}'!",
                    "data": {
                        "assignment_id": assignment["id"],
                        "assignment_title": assignment["title"]
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to delete assignment from database.",
                    "data": {"result": str(result)}
                }
                
        except Exception as e:
            logger.error(f"Error deleting single assignment: {e}")
            return {
                "success": False,
                "message": "I encountered an error while deleting the assignment.",
                "data": {"error": str(e)}
            }
    
    async def get_submission_count(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get submission count for an assignment"""
        try:
            logger.info(f"📊 GET_SUBMISSION_COUNT: Starting with params: {params}")
            
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Extract assignment identifier
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            
            logger.info(f"📊 GET_SUBMISSION_COUNT: Assignment identifier: '{assignment_identifier}'")
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or course name to check submission counts.",
                    "data": None
                }
            
            # First, try to find assignment by direct name/ID
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            
            if assignment:
                # Found specific assignment, get its submission count
                logger.info(f"📊 GET_SUBMISSION_COUNT: Found specific assignment: {assignment['title']}")
                return await self._get_single_assignment_submissions(assignment, user_id, user_token)
            
            # If no direct assignment found, check if this might be a course-based request
            logger.info(f"📊 GET_SUBMISSION_COUNT: No direct assignment found, checking for course-based request...")
            
            # Extract course keywords from identifier
            course_keywords = assignment_identifier.lower()
            course_keywords = course_keywords.replace("assignment", "").replace("the", "").replace("in", "").replace("course", "").replace("submissions", "").replace("submission", "").strip()
            
            if course_keywords:
                logger.info(f"📊 GET_SUBMISSION_COUNT: Searching for assignments in course matching: '{course_keywords}'")
                
                # Find course by keywords
                course = await self._find_course(course_keywords, db_client, user_id)
                if course:
                    logger.info(f"📊 GET_SUBMISSION_COUNT: Found course '{course['title']}', looking for assignments...")
                    
                    # Get all assignments in this course
                    assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                    assignments = assignments_result.data or []
                    
                    logger.info(f"📊 GET_SUBMISSION_COUNT: Found {len(assignments)} assignments in course '{course['title']}'")
                    
                    if not assignments:
                        return {
                            "success": False,
                            "message": f"No assignments found in course '{course['title']}'.",
                            "data": None
                        }
                    elif len(assignments) == 1:
                        # Single assignment - get its submission count
                        assignment = assignments[0]
                        logger.info(f"📊 GET_SUBMISSION_COUNT: Getting submissions for single assignment '{assignment['title']}' in course '{course['title']}'")
                        result = await self._get_single_assignment_submissions(assignment, user_id, user_token)
                        
                        # Enhance the message to mention the course context
                        if result["success"]:
                            result["message"] = result["message"].replace("assignment", f"assignment in course '{course['title']}'")
                        
                        return result
                    else:
                        # Multiple assignments - get submission counts for all
                        logger.info(f"📊 GET_SUBMISSION_COUNT: Getting submissions for {len(assignments)} assignments in course '{course['title']}'")
                        return await self._get_multiple_assignment_submissions(assignments, course['title'], user_id, user_token)
                else:
                    logger.warning(f"📊 GET_SUBMISSION_COUNT: No course found matching '{course_keywords}'")
            
            # If we get here, nothing was found
            return {
                "success": False,
                "message": f"I couldn't find any assignment or course matching '{assignment_identifier}'. Please provide a specific assignment name or course name.",
                "data": None
            }
            
        except Exception as e:
            logger.error(f"📊 GET_SUBMISSION_COUNT: Exception occurred: {e}")
            return {
                "success": False,
                "message": "I encountered an error while getting submission counts.",
                "data": {"error": str(e)}
            }

    async def _get_single_assignment_submissions(self, assignment: Dict, user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get submission count for a single assignment"""
        try:
            logger.info(f"📊 SUBMISSION_COUNT: Assignment details - ID: {assignment['id']}, Title: '{assignment['title']}'")
            
            # Use user token for searching (respects RLS)
            db_client = get_authenticated_client(user_token)
            
            # Verify ownership
            course_check = db_client.table("courses").select("teacher_id").eq("id", assignment["course_id"]).execute()
            if not course_check.data or course_check.data[0]["teacher_id"] != user_id:
                logger.warning(f"📊 GET_SUBMISSION_COUNT: User {user_id} doesn't own assignment {assignment['id']}")
                return {
                    "success": False,
                    "message": "You can only check submissions for assignments in your own courses.",
                    "data": None
                }
            
            # Get submission count - use service role to bypass RLS after ownership verification
            logger.info(f"📊 Getting submissions for assignment ID: {assignment['id']}")
            
            # Try with user token first
            submissions_result = db_client.table("submissions").select("id").eq("assignment_id", assignment["id"]).execute()
            logger.info(f"📊 User token query result: {len(submissions_result.data) if submissions_result.data else 0} submissions found")
            
            # If no results with user token, try with service role (RLS might be blocking)
            if not submissions_result.data:
                logger.info("📊 No submissions found with user token, trying service role...")
                admin_client = get_authenticated_client()  # Service role
                submissions_result = admin_client.table("submissions").select("id").eq("assignment_id", assignment["id"]).execute()
                logger.info(f"📊 Service role query result: {len(submissions_result.data) if submissions_result.data else 0} submissions found")
            
            submission_count = len(submissions_result.data) if submissions_result.data else 0
            logger.info(f"📊 Final submission count: {submission_count}")
            
            return {
                "success": True,
                "message": f"📊 Assignment '{assignment['title']}' has {submission_count} submission{'s' if submission_count != 1 else ''}.",
                "data": {
                    "assignment_id": assignment["id"],
                    "assignment_title": assignment["title"],
                    "submission_count": submission_count
                }
            }
                
        except Exception as e:
            logger.error(f"Error getting single assignment submissions: {e}")
            return {
                "success": False,
                "message": "I encountered an error while getting submission count.",
                "data": {"error": str(e)}
            }

    async def _get_multiple_assignment_submissions(self, assignments: list, course_title: str, user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get submission counts for multiple assignments in a course"""
        try:
            submission_data = []
            total_submissions = 0
            
            for assignment in assignments:
                try:
                    result = await self._get_single_assignment_submissions(assignment, user_id, user_token)
                    if result["success"]:
                        count = result["data"]["submission_count"]
                        submission_data.append({
                            "assignment_title": assignment["title"],
                            "submission_count": count
                        })
                        total_submissions += count
                    else:
                        # If we can't access one assignment, skip it
                        continue
                except Exception as e:
                    logger.error(f"Failed to get submissions for assignment {assignment['title']}: {e}")
                    continue
            
            if not submission_data:
                return {
                    "success": False,
                    "message": f"Unable to access submission data for assignments in course '{course_title}'.",
                    "data": None
                }
            
            # Format the response
            assignment_details = []
            for data in submission_data:
                count = data["submission_count"]
                assignment_details.append(f"{data['assignment_title']}: {count} submission{'s' if count != 1 else ''}")
            
            return {
                "success": True,
                "message": f"📊 Submission counts for course '{course_title}':\n" + "\n".join(assignment_details) + f"\n\nTotal: {total_submissions} submissions across {len(submission_data)} assignments.",
                "data": {
                    "course_title": course_title,
                    "assignments": submission_data,
                    "total_assignments": len(submission_data),
                    "total_submissions": total_submissions
                }
            }
                
        except Exception as e:
            logger.error(f"Error getting multiple assignment submissions: {e}")
            return {
                "success": False,
                "message": f"I encountered an error while getting submission counts for course '{course_title}'.",
                "data": {"error": str(e)}
            }
    
    async def create_course(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Create a new course"""
        try:
            logger.info(f"🏫 CREATE_COURSE: Starting with params: {params}")
            logger.info(f"🏫 CREATE_COURSE: User ID: {user_id}")
            
            # Use service role to bypass RLS for now
            logger.info("🏫 CREATE_COURSE: Using service role to bypass RLS")
            db_client = get_authenticated_client()  # No user token = service role
            
            title = params.get("title") or params.get("course_code", "New Course")
            description = params.get("description", f"Course {title}")
            
            logger.info(f"🏫 CREATE_COURSE: Creating course '{title}'")
            
            # Check if course already exists
            existing = db_client.table("courses").select("id").eq("title", title).execute()
            if existing.data:
                logger.warning(f"🏫 CREATE_COURSE: Course '{title}' already exists")
                return {
                    "success": False,
                    "message": f"Course '{title}' already exists.",
                    "data": {"existing_course_id": existing.data[0]["id"]}
                }
            
            # Create course data
            course_data = {
                "id": str(uuid.uuid4()),
                "title": title,
                "description": description,
                "teacher_id": user_id,  # Associate with the requesting user
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            logger.info(f"🏫 CREATE_COURSE: Course data: {course_data}")
            result = db_client.table("courses").insert(course_data).execute()
            
            logger.info(f"🏫 CREATE_COURSE: Insert result: {result}")
            
            if result.data:
                course = result.data[0]
                logger.info(f"🏫 CREATE_COURSE: Successfully created course '{course['id']}'")
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
                logger.error("🏫 CREATE_COURSE: Insert returned no data")
                return {
                    "success": False,
                    "message": "Failed to create course in database.",
                    "data": None
                }
                
        except Exception as e:
            logger.error(f"🏫 CREATE_COURSE: Exception occurred: {e}")
            import traceback
            logger.error(f"🏫 CREATE_COURSE: Traceback: {traceback.format_exc()}")
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
            course = await self._find_course(course_identifier, db_client, user_id)
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
            logger.info(f"🔍 FIND_ASSIGNMENT: Searching for '{identifier}' (user_id: {user_id})")
            
            # Try by UUID first - check for proper UUID format (8-4-4-4-12 pattern with hyphens)
            import re
            uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            if re.match(uuid_pattern, identifier):
                logger.info(f"🔍 FIND_ASSIGNMENT: Trying UUID lookup for '{identifier}'")
                result = db_client.table("assignments").select("*").eq("id", identifier).execute()
                if result.data:
                    logger.info(f"🔍 FIND_ASSIGNMENT: Found by UUID: {result.data[0]['title']}")
                    return result.data[0]
            
            # Try by exact title match (case insensitive)
            logger.info(f"🔍 FIND_ASSIGNMENT: Trying title search for '{identifier}'")
            result = db_client.table("assignments").select("*").ilike("title", f"%{identifier}%").execute()
            logger.info(f"🔍 FIND_ASSIGNMENT: Title search result: {len(result.data) if result.data else 0} matches")
            
            if result.data:
                logger.info(f"🔍 FIND_ASSIGNMENT: Found by title: {result.data[0]['title']}")
                return result.data[0]
            
            # FALLBACK: Check if identifier could be "course + assignment" pattern
            # e.g., "machine learning assignment" -> look for assignments in "machine learning" course
            if "assignment" in identifier.lower():
                logger.info(f"🔍 FIND_ASSIGNMENT: Trying course-based fallback for '{identifier}'")
                
                # Extract potential course name by removing "assignment" and common words
                course_keywords = identifier.lower().replace("assignment", "").replace("the", "").strip()
                
                if course_keywords:
                    logger.info(f"🔍 FIND_ASSIGNMENT: Searching for assignments in course matching: '{course_keywords}'")
                    
                    # Find course by the extracted keywords
                    course = await self._find_course(course_keywords, db_client, user_id)
                    if course:
                        logger.info(f"🔍 FIND_ASSIGNMENT: Found course '{course['title']}', looking for assignments...")
                        
                        # Get assignments in this course
                        assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                        assignments = assignments_result.data or []
                        logger.info(f"🔍 FIND_ASSIGNMENT: Found {len(assignments)} assignments in course")
                        
                        if assignments:
                            # If there's only one assignment, return it
                            if len(assignments) == 1:
                                logger.info(f"🔍 FIND_ASSIGNMENT: Found single assignment '{assignments[0]['title']}' in course '{course['title']}'")
                                return assignments[0]
                            else:
                                # Multiple assignments - return the first one but log this ambiguity
                                logger.info(f"🔍 FIND_ASSIGNMENT: Found {len(assignments)} assignments in course '{course['title']}', returning first one")
                                return assignments[0]
                    else:
                        logger.info(f"🔍 FIND_ASSIGNMENT: No course found matching '{course_keywords}'")
            
            logger.warning(f"🔍 FIND_ASSIGNMENT: No assignment found for '{identifier}'")
            return None
        except Exception as e:
            logger.error(f"🔍 FIND_ASSIGNMENT: Error finding assignment {identifier}: {e}")
            return None
    
    async def _find_course(self, identifier: str, db_client: Client, user_id: str = None) -> Optional[Dict]:
        """Find course by ID or name"""
        try:
            # Clean up the identifier - remove "course" suffix and extra whitespace
            cleaned_identifier = identifier.strip()
            if cleaned_identifier.lower().endswith(" course"):
                cleaned_identifier = cleaned_identifier[:-7].strip()  # Remove " course"
            
            # Try by ID first
            if len(identifier) == 36:  # UUID length
                result = db_client.table("courses").select("*").eq("id", identifier).execute()
                if result.data:
                    course = result.data[0]
                    # If user_id provided, ensure course belongs to user
                    if user_id and course.get("teacher_id") != user_id:
                        return None
                    return course
            
            # Try exact match first with cleaned name
            result = db_client.table("courses").select("*").ilike("title", cleaned_identifier).execute()
            
            if not result.data:
                # Try partial match
                result = db_client.table("courses").select("*").ilike("title", f"%{cleaned_identifier}%").execute()
            
            if result.data:
                # If user_id provided, filter to only courses owned by that user
                if user_id:
                    user_courses = [course for course in result.data if course.get("teacher_id") == user_id]
                    if user_courses:
                        return user_courses[0]  # Return first match
                else:
                    return result.data[0]  # Return first match
            
            return None
        except Exception as e:
            logger.error(f"Error finding course {identifier}: {e}")
            return None

    async def publish_assignment(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Publish or unpublish an assignment"""
        try:
            logger.info(f"📢 PUBLISH_ASSIGNMENT: Starting with params: {params}")
            logger.info(f"📢 PUBLISH_ASSIGNMENT: User ID: {user_id}")
            
            # Use service role for operations
            db_client = get_authenticated_client()  # Service role
            
            assignment_identifier = (
                params.get("assignment_id") or 
                params.get("assignment_name") or 
                params.get("title")
            )
            action = params.get("action", "publish")  # publish or unpublish
            
            logger.info(f"📢 PUBLISH_ASSIGNMENT: Assignment identifier: '{assignment_identifier}', Action: {action}")
            
            if not assignment_identifier:
                return {
                    "success": False,
                    "message": "I need an assignment name or course name to publish/unpublish assignments.",
                    "data": None
                }
            
            # First, try to find assignment by direct name/ID
            assignment = await self._find_assignment(assignment_identifier, db_client, user_id)
            
            if assignment:
                # Found specific assignment, publish it
                logger.info(f"📢 PUBLISH_ASSIGNMENT: Found specific assignment: {assignment['title']}")
                return await self._publish_single_assignment(assignment, action, db_client)
            
            # If no direct assignment found, check if this might be a course-based request
            logger.info(f"📢 PUBLISH_ASSIGNMENT: No direct assignment found, checking for course-based request...")
            
            # Check if identifier contains course-related keywords
            course_keywords = assignment_identifier.lower()
            
            # Remove common words that don't help identify the course
            course_keywords = course_keywords.replace("assignment", "").replace("the", "").replace("in", "").replace("course", "").strip()
            
            if course_keywords:
                logger.info(f"📢 PUBLISH_ASSIGNMENT: Searching for assignments in course matching: '{course_keywords}'")
                
                # Find course by keywords
                course = await self._find_course(course_keywords, db_client, user_id)
                if course:
                    logger.info(f"📢 PUBLISH_ASSIGNMENT: Found course '{course['title']}', looking for assignments...")
                    
                    # Get all assignments in this course
                    assignments_result = db_client.table("assignments").select("*").eq("course_id", course["id"]).execute()
                    assignments = assignments_result.data or []
                    
                    logger.info(f"📢 PUBLISH_ASSIGNMENT: Found {len(assignments)} assignments in course '{course['title']}'")
                    
                    if not assignments:
                        return {
                            "success": False,
                            "message": f"No assignments found in course '{course['title']}'.",
                            "data": None
                        }
                    elif len(assignments) == 1:
                        # Single assignment - publish it
                        assignment = assignments[0]
                        logger.info(f"📢 PUBLISH_ASSIGNMENT: Publishing single assignment '{assignment['title']}' in course '{course['title']}'")
                        result = await self._publish_single_assignment(assignment, action, db_client)
                        
                        # Enhance the message to mention the course context
                        if result["success"]:
                            action_msg = "published" if action == "publish" else "unpublished"
                            result["message"] = f"✅ Found and {action_msg} assignment '{assignment['title']}' in course '{course['title']}'!"
                        
                        return result
                    else:
                        # Multiple assignments - publish all of them
                        logger.info(f"📢 PUBLISH_ASSIGNMENT: Publishing {len(assignments)} assignments in course '{course['title']}'")
                        return await self._publish_multiple_assignments(assignments, action, course['title'], db_client)
                else:
                    logger.warning(f"📢 PUBLISH_ASSIGNMENT: No course found matching '{course_keywords}'")
            
            # If we get here, nothing was found
            return {
                "success": False,
                "message": f"I couldn't find any assignment or course matching '{assignment_identifier}'. Please provide a specific assignment name or course name.",
                "data": None
            }
                
        except Exception as e:
            logger.error(f"📢 PUBLISH_ASSIGNMENT: Exception occurred: {e}")
            import traceback
            logger.error(f"📢 PUBLISH_ASSIGNMENT: Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "message": "I encountered an error while updating the assignment status.",
                "data": {"error": str(e)}
            }

    async def _publish_single_assignment(self, assignment: Dict, action: str, db_client) -> Dict[str, Any]:
        """Publish or unpublish a single assignment"""
        try:
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
            logger.error(f"Error publishing single assignment: {e}")
            return {
                "success": False,
                "message": "Failed to update assignment status.",
                "data": {"error": str(e)}
            }

    async def _publish_multiple_assignments(self, assignments: list, action: str, course_title: str, db_client) -> Dict[str, Any]:
        """Publish or unpublish multiple assignments in a course"""
        try:
            new_status = "published" if action == "publish" else "draft"
            update_data = {
                "status": new_status,
                "updated_at": datetime.now().isoformat()
            }
            
            successful_updates = []
            failed_updates = []
            
            for assignment in assignments:
                try:
                    result = db_client.table("assignments").update(update_data).eq("id", assignment["id"]).execute()
                    if result.data:
                        successful_updates.append(assignment["title"])
                    else:
                        failed_updates.append(assignment["title"])
                except Exception as e:
                    logger.error(f"Failed to update assignment {assignment['title']}: {e}")
                    failed_updates.append(assignment["title"])
            
            action_msg = "published" if action == "publish" else "unpublished"
            
            if successful_updates and not failed_updates:
                return {
                    "success": True,
                    "message": f"✅ Successfully {action_msg} {len(successful_updates)} assignments in course '{course_title}': {', '.join(successful_updates)}",
                    "data": {
                        "course_title": course_title,
                        "action": action,
                        "successful_assignments": successful_updates,
                        "total_updated": len(successful_updates)
                    }
                }
            elif successful_updates and failed_updates:
                return {
                    "success": True,
                    "message": f"⚠️ Partially {action_msg} assignments in course '{course_title}'. Successful: {', '.join(successful_updates)}. Failed: {', '.join(failed_updates)}",
                    "data": {
                        "course_title": course_title,
                        "action": action,
                        "successful_assignments": successful_updates,
                        "failed_assignments": failed_updates,
                        "total_updated": len(successful_updates)
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to {action} any assignments in course '{course_title}'.",
                    "data": {
                        "course_title": course_title,
                        "failed_assignments": failed_updates
                    }
                }
                
        except Exception as e:
            logger.error(f"Error publishing multiple assignments: {e}")
            return {
                "success": False,
                "message": f"I encountered an error while trying to {action} assignments in course '{course_title}'.",
                "data": {"error": str(e)}
            }

    async def get_info(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Get information about courses, assignments, or general stats"""
        try:
            db_client = get_authenticated_client(user_token)
            
            info_type = params.get("type", "general")  # course, assignment, general
            identifier = params.get("name") or params.get("id")
            
            if info_type == "course" and identifier:
                course = await self._find_course(identifier, db_client, user_id)
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

    async def handle_conversation(self, params: Dict[str, Any], user_id: str, user_token: str = None) -> Dict[str, Any]:
        """Handle conversational interactions like greetings and general questions"""
        try:
            # This handler doesn't need database access - it's for conversational responses
            # The actual response content is already determined by the AI in the MyloAgent
            
            return {
                "success": True,
                "message": "Conversation handled successfully",  # This gets overridden by the AI response
                "data": {
                    "type": "conversation",
                    "user_id": user_id
                }
            }
            
        except Exception as e:
            logger.error(f"Error handling conversation: {e}")
            return {
                "success": False,
                "message": "I encountered an error in our conversation. Please try again.",
                "data": {"error": str(e)}
            } 