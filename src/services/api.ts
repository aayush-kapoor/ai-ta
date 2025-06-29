import { supabase } from '../lib/supabase'
import { 
  Course, 
  Assignment, 
  Submission, 
  Enrollment, 
  User,
  ChatMessage,
  ChatThread,
  CreateCourseData, 
  CreateAssignmentData, 
  UpdateAssignmentData,
  CreateSubmissionData, 
  UpdateSubmissionData, 
  GradeSubmissionData,
  CreateChatMessageData,
  CreateChatThreadData
} from '../types'
import { API_CONFIG } from '../config/api'

// Helper function to trigger knowledge base updates for CS500
const triggerKnowledgeBaseUpdate = async (courseId: string) => {
  if (courseId === API_CONFIG.CS500_COURSE_ID) {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/voice-agent/update-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: "system", // Dummy ID since we get all students now
          course_id: API_CONFIG.CS500_COURSE_ID,
          agent_id: API_CONFIG.ELEVENLABS_AGENT_ID
        })
      })
      console.log('✅ Knowledge base push successful')
    } catch (e) {
      console.error('Failed to trigger knowledge base update:', e)
    }
  }
}

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
    
    // Trigger knowledge base update for CS500 course
    await triggerKnowledgeBaseUpdate(data.id)
    
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
    
    // Trigger knowledge base update for CS500 course
    await triggerKnowledgeBaseUpdate(data.id)
    
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) throw error
    
    // Trigger knowledge base update after deletion
    await triggerKnowledgeBaseUpdate(id)
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

  async getByStudentCourses(studentId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        course:courses!inner(
          id, 
          title, 
          teacher_id,
          enrollments!inner(student_id)
        )
      `)
      .eq('course.enrollments.student_id', studentId)
      .eq('status', 'published')
      .order('due_date', { ascending: true })

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
    
    // Trigger knowledge base update for CS500 course
    if (data.course) {
      await triggerKnowledgeBaseUpdate(data.course.id)
    }
    
    return data
  },

  async update(id: string, assignmentData: Partial<UpdateAssignmentData>): Promise<Assignment> {
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
    
    // Trigger knowledge base update for CS500 course
    if (data.course) {
      await triggerKnowledgeBaseUpdate(data.course.id)
    }
    
    return data
  },

  async updateRubric(id: string, rubric_markdown: string): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update({ rubric_markdown, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        course:courses(id, title, teacher_id)
      `)
      .single()

    if (error) throw error
    
    // Trigger knowledge base update for CS500 course
    if (data.course) {
      await triggerKnowledgeBaseUpdate(data.course.id)
    }
    
    return data
  },

  async delete(id: string): Promise<void> {
    // Get assignment info before deletion to check course
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', id)
      .single()
    
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)

    if (error) throw error
    
    // Trigger knowledge base update for CS500 course after deletion
    if (assignment?.course_id) {
      await triggerKnowledgeBaseUpdate(assignment.course_id)
    }
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
    
            // Trigger knowledge base update for CS500 course
        try {
          if (data.assignment?.course_id === API_CONFIG.CS500_COURSE_ID) {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/voice-agent/update-context`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: submissionData.student_id,
                course_id: API_CONFIG.CS500_COURSE_ID,
                agent_id: API_CONFIG.ELEVENLABS_AGENT_ID
              })
            })
            console.log('✅ Knowledge base push successful after submission creation')
          }
        } catch (e) {
          console.error('Failed to trigger knowledge base update:', e)
        }
    
    return data
  },

  async getByStudentAndAssignment(studentId: string, assignmentId: string): Promise<Submission | null> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .eq('student_id', studentId)
      .eq('assignment_id', assignmentId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async getById(id: string): Promise<Submission | null> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignment:assignments(id, title, course_id, total_points),
        student:users!student_id(id, full_name, email)
      `)
      .eq('id', id)
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
    
            // Trigger knowledge base update for CS500 course
        try {
          if (data.assignment?.course_id === API_CONFIG.CS500_COURSE_ID) {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/voice-agent/update-context`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: data.student_id,
                course_id: API_CONFIG.CS500_COURSE_ID,
                agent_id: API_CONFIG.ELEVENLABS_AGENT_ID
              })
            })
            console.log('✅ Knowledge base push successful after submission update')
          }
        } catch (e) {
          console.error('Failed to trigger knowledge base update:', e)
        }
    
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
    
            // Trigger knowledge base update for CS500 course
        try {
          if (data.assignment?.course_id === API_CONFIG.CS500_COURSE_ID) {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/voice-agent/update-context`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: data.student_id,
                course_id: API_CONFIG.CS500_COURSE_ID,
                agent_id: API_CONFIG.ELEVENLABS_AGENT_ID
              })
            })
            console.log('✅ Knowledge base push successful after submission grading')
          }
        } catch (e) {
          console.error('Failed to trigger knowledge base update:', e)
        }
    
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
    
    // Trigger knowledge base update for CS500 course
    await triggerKnowledgeBaseUpdate(courseId)
    
    return data
  },

  async unenroll(courseId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId)

    if (error) throw error
    
    // Trigger knowledge base update for CS500 course
    await triggerKnowledgeBaseUpdate(courseId)
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
      .order('full_name')

    if (error) throw error
    return data || []
  }
}

// Chat Thread API
export const chatThreadAPI = {
  async getByUser(userId: string): Promise<ChatThread[]> {
    const { data, error } = await supabase
      .from('chat_threads')
      .select(`
        *,
        user:users(id, full_name, email, role)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async create(threadData: CreateChatThreadData): Promise<ChatThread> {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert([{
        ...threadData,
        message_count: 0,
        last_message_at: null
      }])
      .select(`
        *,
        user:users(id, full_name, email, role)
      `)
      .single()

    if (error) throw error
    return data
  },

  async updateTitle(id: string, title: string): Promise<ChatThread> {
    const { data, error } = await supabase
      .from('chat_threads')
      .update({ 
        title, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select(`
        *,
        user:users(id, full_name, email, role)
      `)
      .single()

    if (error) throw error
    return data
  },

  async updateLastMessage(id: string): Promise<ChatThread> {
    const { data, error } = await supabase
      .from('chat_threads')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        user:users(id, full_name, email, role)
      `)
      .single()

    if (error) throw error
    return data
  },

  async incrementMessageCount(id: string): Promise<void> {
    // Get current count and increment
    const { data: thread, error: fetchError } = await supabase
      .from('chat_threads')
      .select('message_count')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        message_count: (thread?.message_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Chat API
export const chatAPI = {
  async getByThread(threadId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(id, full_name, email, role),
        thread:chat_threads(id, title, user_id)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getByUser(userId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(id, full_name, email, role),
        thread:chat_threads(id, title, user_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async create(messageData: CreateChatMessageData): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select(`
        *,
        user:users(id, full_name, email, role),
        thread:chat_threads(id, title, user_id)
      `)
      .single()

    if (error) throw error
    
    // Update thread's last message time and increment message count
    await chatThreadAPI.updateLastMessage(messageData.thread_id)
    await chatThreadAPI.incrementMessageCount(messageData.thread_id)
    
    return data
  },

  async updateResponse(id: string, response: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ 
        response, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select(`
        *,
        user:users(id, full_name, email, role),
        thread:chat_threads(id, title, user_id)
      `)
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
} 