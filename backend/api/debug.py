"""
Debug API endpoints for AI Teaching Assistant
Handles debugging, testing, and development endpoints
"""
import logging
from fastapi import APIRouter
from config import SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME
from database import get_authenticated_client
from agent.mylo import openai_client

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

@router.get("/config")
async def debug_config():
    """Debug endpoint to check configuration"""
    return {
        "supabase_url_set": bool(SUPABASE_URL),
        "supabase_key_set": bool(SUPABASE_KEY),
        "openai_key_set": bool(OPENAI_API_KEY),
        "openai_key_prefix": OPENAI_API_KEY[:7] + "..." if OPENAI_API_KEY else "NOT_SET"
    }

@router.post("/openai-test")
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

@router.get("/test-user")
async def check_test_user():
    """Debug endpoint to check if test user exists"""
    try:
        admin_client = get_authenticated_client()
        
        # Check if user exists
        result = admin_client.table("users").select("*").eq("id", TEST_USER_ID).execute()
        
        return {
            "test_user_id": TEST_USER_ID,
            "test_user_email": TEST_USER_EMAIL,
            "test_user_name": TEST_USER_NAME,
            "user_exists": bool(result.data),
            "user_data": result.data[0] if result.data else None,
            "using_service_key": True
        }
        
    except Exception as e:
        return {
            "test_user_id": TEST_USER_ID,
            "error": str(e),
            "user_exists": False
        }

@router.get("/list-data")
async def list_all_data():
    """Debug endpoint to list all courses and assignments"""
    try:
        admin_client = get_authenticated_client()
        
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