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

# ElevenLabs Configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
CS500_COURSE_ID = os.getenv("CS500_COURSE_ID")

# Test user configuration (for development)
TEST_USER_ID = os.getenv("TEST_USER_ID")
TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL")
TEST_USER_NAME = os.getenv("TEST_USER_NAME")

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# CORS Configuration
CORS_ORIGINS = [
    "https://mylo-ta.vercel.app",    # Production Vercel domain
    "http://localhost:5173",         # Local Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:5174",         # Alternative Vite port
    "http://127.0.0.1:5174",
    "http://localhost:3000",         # Alternative React port
    "*"  # Allow all origins temporarily for debugging
]

# Allow environment variable to override CORS origins
if os.getenv("CORS_ORIGINS"):
    CORS_ORIGINS = os.getenv("CORS_ORIGINS").split(",")

# Print CORS origins for debugging
print(f"CORS_ORIGINS configured: {CORS_ORIGINS}")

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