from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
from datetime import datetime
import json

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Teaching Assistant LMS", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase configuration")

supabase: Client = create_client(supabase_url, supabase_key)

# Pydantic models
class User(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class CourseCreate(BaseModel):
    title: str
    description: str
    course_code: str
    teacher_id: str

class Course(BaseModel):
    id: str
    title: str
    description: str
    course_code: str
    teacher_id: str
    created_at: str

class RubricItem(BaseModel):
    id: str
    criteria: str
    max_points: int
    description: str

class AssignmentCreate(BaseModel):
    title: str
    description: str
    instructions: str
    max_score: int
    due_date: str
    course_id: str
    rubric: List[RubricItem]

class Assignment(BaseModel):
    id: str
    title: str
    description: str
    instructions: str
    max_score: int
    due_date: str
    course_id: str
    rubric: List[RubricItem]
    created_at: str

class SubmissionCreate(BaseModel):
    assignment_id: str
    student_id: str
    file_name: str
    file_url: str

class Submission(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    file_name: str
    file_url: str
    submitted_at: str
    grade: Optional[int] = None
    feedback: Optional[str] = None
    graded_at: Optional[str] = None

class GradeUpdate(BaseModel):
    grade: int
    feedback: str

class EnrollmentCreate(BaseModel):
    course_id: str
    student_id: str

# Helper function to get current user (simplified for demo)
def get_current_user(user_id: str = None) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**result.data[0])

# Routes

@app.get("/")
async def root():
    return {"message": "AI Teaching Assistant LMS API"}

# User routes
@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**result.data[0])

# Course routes
@app.get("/courses", response_model=List[Course])
async def get_courses():
    result = supabase.table("courses").select("*").execute()
    return [Course(**course) for course in result.data]

@app.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str):
    result = supabase.table("courses").select("*").eq("id", course_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return Course(**result.data[0])

@app.post("/courses", response_model=Course)
async def create_course(course_data: CourseCreate):
    course_dict = course_data.dict()
    course_dict['id'] = str(uuid.uuid4())
    course_dict['created_at'] = datetime.utcnow().isoformat()
    
    result = supabase.table("courses").insert(course_dict).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create course")
    
    return Course(**result.data[0])

# Assignment routes
@app.get("/courses/{course_id}/assignments", response_model=List[Assignment])
async def get_course_assignments(course_id: str):
    result = supabase.table("assignments").select("*").eq("course_id", course_id).execute()
    assignments = []
    for assignment in result.data:
        assignment['rubric'] = json.loads(assignment['rubric']) if isinstance(assignment['rubric'], str) else assignment['rubric']
        assignments.append(Assignment(**assignment))
    return assignments

@app.get("/assignments/{assignment_id}", response_model=Assignment)
async def get_assignment(assignment_id: str):
    result = supabase.table("assignments").select("*").eq("id", assignment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment = result.data[0]
    assignment['rubric'] = json.loads(assignment['rubric']) if isinstance(assignment['rubric'], str) else assignment['rubric']
    return Assignment(**assignment)

@app.post("/assignments", response_model=Assignment)
async def create_assignment(assignment_data: AssignmentCreate):
    assignment_dict = assignment_data.dict()
    assignment_dict['id'] = str(uuid.uuid4())
    assignment_dict['created_at'] = datetime.utcnow().isoformat()
    assignment_dict['rubric'] = json.dumps([item.dict() for item in assignment_data.rubric])
    
    result = supabase.table("assignments").insert(assignment_dict).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create assignment")
    
    assignment = result.data[0]
    assignment['rubric'] = json.loads(assignment['rubric'])
    return Assignment(**assignment)

# Submission routes
@app.get("/assignments/{assignment_id}/submissions", response_model=List[Submission])
async def get_assignment_submissions(assignment_id: str):
    result = supabase.table("submissions").select("*").eq("assignment_id", assignment_id).execute()
    return [Submission(**submission) for submission in result.data]

@app.get("/submissions/{submission_id}", response_model=Submission)
async def get_submission(submission_id: str):
    result = supabase.table("submissions").select("*").eq("id", submission_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Submission not found")
    return Submission(**result.data[0])

@app.post("/submissions", response_model=Submission)
async def create_submission(submission_data: SubmissionCreate):
    submission_dict = submission_data.dict()
    submission_dict['id'] = str(uuid.uuid4())
    submission_dict['submitted_at'] = datetime.utcnow().isoformat()
    
    result = supabase.table("submissions").insert(submission_dict).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create submission")
    
    return Submission(**result.data[0])

@app.patch("/submissions/{submission_id}/grade", response_model=Submission)
async def update_submission_grade(submission_id: str, grade_data: GradeUpdate):
    update_data = {
        "grade": grade_data.grade,
        "feedback": grade_data.feedback,
        "graded_at": datetime.utcnow().isoformat()
    }
    
    result = supabase.table("submissions").update(update_data).eq("id", submission_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return Submission(**result.data[0])

# File upload route
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    student_id: str = Form(...),
    assignment_id: str = Form(...)
):
    # Validate file size and type
    max_size = int(os.getenv("MAX_FILE_SIZE", 10485760))  # 10MB default
    allowed_types = os.getenv("ALLOWED_FILE_TYPES", ".pdf,.doc,.docx,.txt,.py,.java,.cpp,.js,.html,.css").split(",")
    
    if file.size > max_size:
        raise HTTPException(status_code=413, detail="File too large")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=415, detail="File type not supported")
    
    # Generate unique filename
    unique_filename = f"{student_id}/{assignment_id}/{uuid.uuid4()}{file_ext}"
    
    try:
        # Upload to Supabase Storage
        file_content = await file.read()
        result = supabase.storage.from_("assignment-files").upload(unique_filename, file_content)
        
        if result.get("error"):
            raise HTTPException(status_code=500, detail="Failed to upload file")
        
        # Get public URL
        file_url = supabase.storage.from_("assignment-files").get_public_url(unique_filename)
        
        return {
            "file_name": file.filename,
            "file_url": file_url,
            "storage_path": unique_filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# Enrollment routes
@app.get("/students/{student_id}/enrollments")
async def get_student_enrollments(student_id: str):
    result = supabase.table("course_enrollments").select(
        "*, courses(*)"
    ).eq("student_id", student_id).execute()
    return result.data

@app.get("/courses/{course_id}/enrollments")
async def get_course_enrollments(course_id: str):
    result = supabase.table("course_enrollments").select(
        "*, users(*)"
    ).eq("course_id", course_id).execute()
    return result.data

@app.post("/enrollments")
async def create_enrollment(enrollment_data: EnrollmentCreate):
    enrollment_dict = enrollment_data.dict()
    enrollment_dict['id'] = str(uuid.uuid4())
    enrollment_dict['enrolled_at'] = datetime.utcnow().isoformat()
    
    result = supabase.table("course_enrollments").insert(enrollment_dict).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create enrollment")
    
    return result.data[0]

@app.get("/students/{student_id}/available-courses")
async def get_available_courses(student_id: str):
    # Get enrolled course IDs
    enrolled_result = supabase.table("course_enrollments").select("course_id").eq("student_id", student_id).execute()
    enrolled_course_ids = [enrollment["course_id"] for enrollment in enrolled_result.data]
    
    # Get all courses not in enrolled list
    if enrolled_course_ids:
        result = supabase.table("courses").select("*").not_.in_("id", enrolled_course_ids).execute()
    else:
        result = supabase.table("courses").select("*").execute()
    
    return [Course(**course) for course in result.data]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("DEBUG", "True").lower() == "true"
    )