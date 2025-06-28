export type UserRole = 'teacher' | 'student'
export type AssignmentStatus = 'draft' | 'published' | 'closed'
export type SubmissionStatus = 'draft' | 'submitted' | 'graded'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  teacher_id: string
  created_at: string
  updated_at: string
  teacher?: User
}

export interface Assignment {
  id: string
  title: string
  description: string | null
  course_id: string
  due_date: string | null
  total_points: number
  status: AssignmentStatus
  rubric_markdown?: string | null
  created_at: string
  updated_at: string
  course?: Course
}

export interface Enrollment {
  id: string
  student_id: string
  course_id: string
  enrolled_at: string
  student?: User
  course?: Course
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  content: string | null
  file_url: string | null
  file_path?: string | null // New: Storage path
  file_size?: number | null // New: File size in bytes
  original_filename?: string | null // New: Original filename
  status: SubmissionStatus
  grade: number | null
  feedback: string | null
  submitted_at: string | null
  graded_at: string | null
  created_at: string
  updated_at: string
  assignment?: Assignment
  student?: User
}

export interface CreateCourseData {
  title: string
  description?: string
  teacher_id: string
}

export interface CreateAssignmentData {
  title: string
  description?: string
  course_id: string
  due_date?: string
  total_points?: number
  status?: AssignmentStatus
  rubric_markdown?: string
}

export interface CreateSubmissionData {
  assignment_id: string
  student_id: string
  content?: string
  file_url?: string
  file_path?: string
  file_size?: number
  original_filename?: string
  status?: SubmissionStatus
}

export interface UpdateSubmissionData {
  content?: string
  file_url?: string
  file_path?: string
  file_size?: number
  original_filename?: string
  status?: SubmissionStatus
  submitted_at?: string
}

export interface GradeSubmissionData {
  grade: number
  feedback?: string
}

export interface RubricItem {
  id: string
  criteria: string
  max_points: number
  description: string
}

export interface AIGradingResult {
  total_score: number
  max_score: number
  breakdown: {
    criteria: string
    points_earned: number
    max_points: number
    feedback: string
  }[]
  overall_feedback: string
}

export interface UpdateAssignmentData {
  title?: string
  description?: string
  due_date?: string
  total_points?: number
  status?: AssignmentStatus
  rubric_markdown?: string
}

export interface ChatMessage {
  id: string
  user_id: string
  message: string
  response: string | null
  created_at: string
  updated_at: string
  user?: User
}

export interface CreateChatMessageData {
  user_id: string
  message: string
  response?: string
}

// Agent API types
export interface AgentRequest {
  message: string
  user_id: string
  context?: Record<string, unknown>
}

export interface AgentResponse {
  response: string
  action_taken?: string
  success: boolean
  data?: Record<string, unknown>
}