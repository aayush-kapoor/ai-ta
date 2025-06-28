"""
Database configuration and client setup for AI Teaching Assistant Agent
Handles Supabase client initialization and connection management
"""
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY
import logging

logger = logging.getLogger(__name__)

# Initialize main Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_authenticated_client(user_token: str = None) -> Client:
    """
    Get a Supabase client authenticated as the user or with service role
    
    Args:
        user_token: JWT token for user authentication (optional)
        
    Returns:
        Authenticated Supabase client
    """
    if user_token:
        # Create a client with the user's session token
        logger.info("Using user token for database access")
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        auth_client.auth.set_session(user_token, "")
        return auth_client
    else:
        # For testing, use service role client that bypasses RLS
        logger.info("Using service key for database access (bypassing RLS)")
        service_key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
        if service_key == SUPABASE_KEY:
            logger.warning("No SUPABASE_SERVICE_KEY found, using anon key - this might cause RLS issues")
        return create_client(SUPABASE_URL, service_key) 