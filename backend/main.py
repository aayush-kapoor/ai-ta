"""
Main FastAPI application for AI Teaching Assistant Agent
Clean, modular entry point that imports and registers all components
"""
import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Import configuration and validation
from config import validate_config, CORS_ORIGINS, HOST, PORT

# Import API routers
from api.agent import router as agent_router
from api.debug import router as debug_router
from api.voice_agent import router as voice_agent_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Validate configuration on startup
validate_config()

# Initialize FastAPI app
app = FastAPI(
    title="Mylo - AI Teaching Assistant Agent", 
    version="1.0.0",
    description="Intelligent AI agent for managing courses and assignments"
)

# Request logging middleware for debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Register API routers
app.include_router(agent_router, prefix="/api/agent", tags=["agent"])
app.include_router(debug_router, prefix="/debug", tags=["debug"])
app.include_router(voice_agent_router)

# Basic routes
@app.get("/")
async def root():
    return {"message": "Mylo AI Teaching Assistant Agent", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "agent": "Mylo", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT) 