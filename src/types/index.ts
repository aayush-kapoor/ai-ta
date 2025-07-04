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
  detailed_feedback_json?: GradingResult['detailed_result'] | null // New: Detailed AI feedback structure
  show_detailed_feedback?: boolean // New: Toggle for detailed feedback visibility
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
  show_detailed_feedback?: boolean
  detailed_feedback_json?: GradingResult['detailed_result'] | null
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

export interface GradingResult {
  success: boolean
  grade?: number
  feedback?: string
  confidence?: number
  detailed_result?: {
    grade: number
    percentage: number
    feedback: {
      overall: string
      strengths: string[]
      areas_for_improvement: string[]
      missing_elements: string[]
      specific_comments: {
        section: string
        comment: string
        points_awarded: number
        points_possible: number
      }[]
    }
    rubric_breakdown: {
      criteria: string
      points_earned: number
      max_points: number
      justification: string
      found_in_submission: boolean
      quality_assessment: string
    }[]
    confidence_level: number
    recommendations: string[]
  }
  error?: string
}

export interface UpdateAssignmentData {
  title?: string
  description?: string
  due_date?: string
  total_points?: number
  status?: AssignmentStatus
  rubric_markdown?: string
}

export interface ChatThread {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_at: string | null
  user?: User
}

export interface ChatMessage {
  id: string
  thread_id: string
  user_id: string
  message: string
  response: string | null
  created_at: string
  updated_at: string
  user?: User
  thread?: ChatThread
}

export interface CreateChatThreadData {
  user_id: string
  title: string
}

export interface CreateChatMessageData {
  thread_id: string
  user_id: string
  message: string
  response?: string
}

// Agent API types
export interface AgentRequest {
  message: string
  user_id: string
  thread_id?: string
  context?: Record<string, unknown>
}

export interface AgentResponse {
  response: string
  action_taken?: string
  success: boolean
  thread_id?: string
  thread_title?: string
  data?: Record<string, unknown>
}