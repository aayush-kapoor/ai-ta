# AI Teaching Assistant LMS

A modern Learning Management System with AI-powered grading assistance built with React, FastAPI, and Supabase.

## Features

### For Teachers
- Create and manage courses with detailed information
- Design assignments with custom rubrics
- View and manage student enrollments
- Review student submissions with built-in PDF viewer
- AI-assisted grading with visual breakdown (coming soon)
- Grade management and feedback system

### For Students
- Browse and register for available courses
- View course information and assignments
- Submit assignments via drag-and-drop or file upload
- Track submission status and grades
- Receive detailed feedback from instructors

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Python FastAPI
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for file uploads
- **Authentication**: Static demo accounts (production would use Supabase Auth)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Supabase account

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to SQL Editor and run the migration file from `supabase/migrations/create_lms_schema.sql`
4. Enable Storage and create a bucket named `assignment-files`

### 2. Frontend Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Create `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Update `.env` with your Supabase credentials:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm run dev
```

### 3. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file in the backend directory:
```bash
cp .env.example .env
```

5. Update backend `.env` with your Supabase service role key:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
```

6. Start the FastAPI server:
```bash
python main.py
```

## Demo Accounts

The system includes pre-configured demo accounts:

### Teacher Account
- **Email**: `teacher@university.edu`
- **Password**: `password123`
- **Role**: Teacher/Instructor

### Student Accounts
- **Email**: `john.doe@student.edu` | **Name**: John Doe
- **Email**: `jane.smith@student.edu` | **Name**: Jane Smith  
- **Email**: `mike.wilson@student.edu` | **Name**: Mike Wilson
- **Email**: `lisa.chen@student.edu` | **Name**: Lisa Chen
- **Password**: `password123` (for all student accounts)

## Environment Variables

### Frontend (.env)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)

### Backend (backend/.env)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service role key
- `API_HOST` - API host (default: 0.0.0.0)
- `API_PORT` - API port (default: 8000)
- `DEBUG` - Debug mode (default: True)
- `MAX_FILE_SIZE` - Maximum file upload size in bytes (default: 10MB)
- `ALLOWED_FILE_TYPES` - Comma-separated list of allowed file extensions

## File Upload Configuration

The system supports various file types for assignment submissions:
- Documents: `.pdf`, `.doc`, `.docx`, `.txt`
- Code files: `.py`, `.java`, `.cpp`, `.js`, `.html`, `.css`
- Maximum file size: 10MB (configurable)

## API Endpoints

### Courses
- `GET /courses` - Get all courses
- `GET /courses/{course_id}` - Get specific course
- `POST /courses` - Create new course

### Assignments
- `GET /courses/{course_id}/assignments` - Get course assignments
- `GET /assignments/{assignment_id}` - Get specific assignment
- `POST /assignments` - Create new assignment

### Submissions
- `GET /assignments/{assignment_id}/submissions` - Get assignment submissions
- `GET /submissions/{submission_id}` - Get specific submission
- `POST /submissions` - Create new submission
- `PATCH /submissions/{submission_id}/grade` - Update submission grade

### File Upload
- `POST /upload` - Upload assignment file

### Enrollments
- `GET /students/{student_id}/enrollments` - Get student enrollments
- `GET /courses/{course_id}/enrollments` - Get course enrollments
- `POST /enrollments` - Create new enrollment

## Development

### Running Tests
```bash
# Frontend tests (when available)
npm test

# Backend tests (when available)
cd backend
python -m pytest
```

### Building for Production
```bash
# Frontend build
npm run build

# Backend deployment
# Configure your production environment variables
# Deploy using your preferred method (Docker, cloud platforms, etc.)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Future Enhancements

- **AI Grading Integration**: Connect with OpenAI API for automated grading
- **Video Conferencing**: Integrate with Google Meet/Zoom APIs
- **Real-time Chat**: Add student-teacher communication features
- **Advanced Analytics**: Course and student performance insights
- **Mobile App**: React Native mobile application
- **Notification System**: Email and in-app notifications

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please open an issue in the GitHub repository.