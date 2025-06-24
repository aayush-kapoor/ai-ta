import { supabase } from '../lib/supabase'
import { 
  Course, 
  Assignment, 
  Submission, 
  Enrollment, 
  User,
  CreateCourseData, 
  CreateAssignmentData, 
  CreateSubmissionData, 
  UpdateSubmissionData, 
  GradeSubmissionData 
} from '../types'

// Course API
export const courseAPI = {
  async getAll(): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        teacher:users!teacher_id(id, full_name, email, role)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getByTeacher(teacherId: string): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        teacher:users!teacher_id(id, full_name, email, role)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        teacher:users!teacher_id(id, full_name, email, role)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(courseData: CreateCourseData): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert([courseData])
      .select(`
        *,
        teacher:users!teacher_id(id, full_name, email, role)
      `)
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, courseData: Partial<CreateCourseData>): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .update({ ...courseData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        teacher:users!teacher_id(id, full_name, email, role)
      `)
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Assignment API
export const assignmentAPI = {
  async getByCourse(courseId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        course:courses(id, title, teacher_id)
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        course:courses(id, title, teacher_id)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async create(assignmentData: CreateAssignmentData): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .insert([assignmentData])
      .select(`
        *,
        course:courses(id, title, teacher_id)
      `)
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, assignmentData: Partial<CreateAssignmentData>): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update({ ...assignmentData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        course:courses(id, title, teacher_id)
      `)
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Submission API
export const submissionAPI = {
  async getByAssignment(assignmentId: string): Promise<Submission[]> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getByStudent(studentId: string): Promise<Submission[]> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points, due_date),
        student:users!student_id(id, full_name, email)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async create(submissionData: CreateSubmissionData): Promise<Submission> {
    const { data, error } = await supabase
      .from('submissions')
      .insert([submissionData])
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, submissionData: UpdateSubmissionData): Promise<Submission> {
    const { data, error } = await supabase
      .from('submissions')
      .update({ ...submissionData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .single()

    if (error) throw error
    return data
  },

  async grade(id: string, gradeData: GradeSubmissionData): Promise<Submission> {
    const { data, error } = await supabase
      .from('submissions')
      .update({ 
        ...gradeData, 
        status: 'graded',
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .single()

    if (error) throw error
    return data
  }
}

// Enrollment API
export const enrollmentAPI = {
  async getByCourse(courseId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        student:users!student_id(id, full_name, email, role),
        course:courses(id, title, teacher_id)
      `)
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getByStudent(studentId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        student:users!student_id(id, full_name, email, role),
        course:courses(id, title, description, teacher_id)
      `)
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async enroll(courseId: string, studentId: string): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .insert([{ course_id: courseId, student_id: studentId }])
      .select(`
        *,
        student:users!student_id(id, full_name, email, role),
        course:courses(id, title, description, teacher_id)
      `)
      .single()

    if (error) throw error
    return data
  },

  async unenroll(courseId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId)

    if (error) throw error
  }
}

// User API
export const userAPI = {
  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
} 