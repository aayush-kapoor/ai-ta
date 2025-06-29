/**
 * Voice Agent API Service for ElevenLabs Integration
 * Handles communication with the backend voice agent endpoints
 */
import { buildApiUrl } from '../config/api'
import { supabase } from '../lib/supabase'

// Get auth token from current session
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      console.log('✅ Got auth token from Supabase session')
      return session.access_token
    }
    
    console.warn('❌ No auth token found')
  } catch (e) {
    console.warn('❌ Failed to get auth token:', e)
  }
  
  return null
}

// Types for voice agent API
export interface VoiceAgentRequest {
  student_id: string
  course_id: string
  agent_id?: string  // ElevenLabs agent ID to update
}

export interface StudentInfo {
  id: string
  name: string
  email: string
}

export interface AssignmentContext {
  id: string
  title: string
  description?: string
  due_date?: string
  total_points: number
  status: string
  rubric?: string
  has_submission: boolean
  submission_status?: string
  submission_file_path?: string
  submission_content?: string
  grade?: number
  feedback?: string
}

export interface CourseContext {
  id: string
  title: string
  description?: string
  assignments: AssignmentContext[]
}

export interface VoiceAgentContext {
  student: StudentInfo
  course: CourseContext
  context_updated_at: string
}

export interface VoiceAgentResponse {
  success: boolean
  message: string
  context?: VoiceAgentContext
  agent_id?: string
  knowledge_base_updated: boolean
}

export interface VoiceAgentHealthResponse {
  status: string
  elevenlabs_service_available: boolean
  message: string
}

// Voice Agent API functions
export const voiceAgentAPI = {
  /**
   * Update voice agent context for a student in a specific course
   * This should be called when a student navigates to a course page
   */
  async updateContext(studentId: string, courseId: string, agentId?: string): Promise<VoiceAgentResponse> {
    const token = await getAuthToken()
    
    console.log('🎤 Updating voice agent context:', { 
      studentId, 
      courseId,
      hasToken: !!token,
      endpoint: buildApiUrl('/api/voice-agent/update-context')
    })
    
    const requestData: VoiceAgentRequest = {
      student_id: studentId,
      course_id: courseId,
      ...(agentId && { agent_id: agentId })
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
      
      console.log('📤 Voice agent request:', requestData)
      
      const response = await fetch(buildApiUrl('/api/voice-agent/update-context'), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      })

      console.log('📥 Voice agent response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Voice agent error response:', errorText)
        throw new Error(`Voice Agent API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result: VoiceAgentResponse = await response.json()
      console.log('✅ Voice agent context updated:', result)
      return result
      
    } catch (error) {
      console.error('❌ Error updating voice agent context:', error)
      
      // Fallback response for errors
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error updating voice agent context',
        knowledge_base_updated: false
      }
    }
  },

  /**
   * Get current voice agent context for debugging/display purposes
   */
  async getContext(studentId: string, courseId: string): Promise<VoiceAgentContext | null> {
    const token = await getAuthToken()
    
    console.log('🔍 Getting voice agent context:', { 
      studentId, 
      courseId,
      hasToken: !!token,
      endpoint: buildApiUrl(`/api/voice-agent/context/${studentId}/${courseId}`)
    })

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
      
      const response = await fetch(buildApiUrl(`/api/voice-agent/context/${studentId}/${courseId}`), {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Get context error response:', errorText)
        throw new Error(`Voice Agent API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success && result.context) {
        console.log('✅ Voice agent context retrieved:', result.context)
        return result.context
      } else {
        console.warn('❌ No context found:', result.message)
        return null
      }
      
    } catch (error) {
      console.error('❌ Error getting voice agent context:', error)
      return null
    }
  },

  /**
   * Test voice agent context building (development only)
   */
  async testContext(studentId: string, courseId: string): Promise<VoiceAgentContext | null> {
    console.log('🧪 Testing voice agent context:', { 
      studentId, 
      courseId,
      endpoint: buildApiUrl('/api/voice-agent/test-context')
    })
    
    const requestData: VoiceAgentRequest = {
      student_id: studentId,
      course_id: courseId
    }

    try {
      const response = await fetch(buildApiUrl('/api/voice-agent/test-context'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Test context error response:', errorText)
        throw new Error(`Voice Agent API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success && result.context) {
        console.log('✅ Test context built successfully:', result.context)
        return result.context
      } else {
        console.warn('❌ Test context failed:', result.message)
        return null
      }
      
    } catch (error) {
      console.error('❌ Error testing voice agent context:', error)
      return null
    }
  },

  /**
   * Check voice agent service health
   */
  async checkHealth(): Promise<VoiceAgentHealthResponse> {
    console.log('💗 Checking voice agent health:', { 
      endpoint: buildApiUrl('/api/voice-agent/health')
    })

    try {
      const response = await fetch(buildApiUrl('/api/voice-agent/health'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
      }

      const result: VoiceAgentHealthResponse = await response.json()
      console.log('✅ Voice agent health check:', result)
      return result
      
    } catch (error) {
      console.error('❌ Voice agent health check failed:', error)
      
      return {
        status: 'unhealthy',
        elevenlabs_service_available: false,
        message: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  },

  /**
   * Automatically update context when student navigates to course
   * This is the main function that should be called from course pages
   */
  async autoUpdateContextForCourse(studentId: string, courseId: string, agentId?: string): Promise<boolean> {
    try {
      console.log('🔄 Auto-updating voice agent context for course navigation')
      
      const result = await this.updateContext(studentId, courseId, agentId)
      
      if (result.success && result.knowledge_base_updated) {
        console.log('✅ Voice agent ready for', result.context?.course.title)
        return true
      } else {
        console.warn('⚠️ Voice agent context update had issues:', result.message)
        return false
      }
      
    } catch (error) {
      console.error('❌ Auto-update failed:', error)
      return false
    }
  }
} 