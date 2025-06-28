"""
Configuration module for AI Teaching Assistant Agent
Handles all environment variables and configuration settings
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase Configuration (Required)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# OpenAI Configuration (Required)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Test user configuration (for development)
TEST_USER_ID = os.getenv("TEST_USER_ID")
TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL")
TEST_USER_NAME = os.getenv("TEST_USER_NAME")

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# CORS Configuration
CORS_ORIGINS = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174"
]

# Validation
def validate_config():
    """Validate that all required environment variables are set"""
    required_vars = {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_KEY": SUPABASE_KEY,
        "OPENAI_API_KEY": OPENAI_API_KEY
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return True 