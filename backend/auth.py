"""
Authentication module for AI Teaching Assistant Agent
Handles user authentication, token verification, and test user management
"""
from fastapi import HTTPException, Header
from database import supabase, get_authenticated_client
from config import TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME
import logging

logger = logging.getLogger(__name__)

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

async def get_test_user():
    """Simple test user for development"""
    return {"id": TEST_USER_ID, "email": TEST_USER_EMAIL}

async def ensure_test_user_exists():
    """Ensure the test user exists in the database"""
    try:
        # Use service role client to bypass RLS for this check
        admin_client = get_authenticated_client()
        
        # Check if user exists
        result = admin_client.table("users").select("id").eq("id", TEST_USER_ID).execute()
        
        if not result.data:
            # User doesn't exist, create them
            logger.info("Creating test user in database")
            admin_client.table("users").insert({
                "id": TEST_USER_ID,
                "email": TEST_USER_EMAIL,
                "name": TEST_USER_NAME,
                "role": "teacher"
            }).execute()
            logger.info("Test user created successfully")
        else:
            logger.info("Test user already exists in database")
            
    except Exception as e:
        logger.error(f"Error ensuring test user exists: {e}")
        # Don't fail the request, just log the error 