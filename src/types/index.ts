export interface User {
  id: string
  email: string
  role: 'teacher' | 'student'
  name: string
  created_at: string
}

export interface Course {
  id: string
  title: string
  description: string
  course_code: string
  teacher_id: string
  created_at: string
  teacher?: User
}

export interface Assignment {
  id: string
  title: string
  description: string
  instructions: string
  max_score: number
  due_date: string
  course_id: string
  rubric: RubricItem[]
  created_at: string
  course?: Course
}

export interface RubricItem {
  id: string
  criteria: string
  max_points: number
  description: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  file_name: string
  file_url: string
  submitted_at: string
  grade?: number
  feedback?: string
  graded_at?: string
  assignment?: Assignment
  student?: User
}

export interface CourseEnrollment {
  id: string
  course_id: string
  student_id: string
  enrolled_at: string
  course?: Course
  student?: User
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