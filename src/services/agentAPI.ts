/**
 * Agent API Service for AI Teaching Assistant
 * Handles communication with the backend Mylo agent
 */
import { buildApiUrl, API_CONFIG } from '../config/api'
import { AgentRequest, AgentResponse } from '../types'
import { supabase } from '../lib/supabase'

// Get auth token from current session
const getAuthToken = async (): Promise<string | null> => {
  try {
    // First try to get the token directly from Supabase client
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      console.log('✅ Got auth token from Supabase session')
      return session.access_token
    }
    
    // Fallback: try to get token from localStorage where Supabase stores it
    const authKey = 'ai-ta-supabase-auth-token'
    const authData = localStorage.getItem(authKey)
    
    if (authData) {
      const parsed = JSON.parse(authData)
      console.log('📋 Auth data structure:', Object.keys(parsed))
      
      // Supabase stores session data in this format:
      // { access_token: "...", refresh_token: "...", expires_at: ..., etc }
      // OR it might be nested under a session property
      
      if (parsed.access_token) {
        console.log('✅ Got auth token from localStorage (direct)')
        return parsed.access_token
      }
      
      // Check if it's nested under session
      if (parsed.session && parsed.session.access_token) {
        console.log('✅ Got auth token from localStorage (nested)')
        return parsed.session.access_token
      }
      
      // Check if it's in the format that includes user data
      if (parsed.user && parsed.access_token) {
        console.log('✅ Got auth token from localStorage (with user)')
        return parsed.access_token
      }
    }
    
    console.warn('❌ No auth token found')
  } catch (e) {
    console.warn('❌ Failed to get auth token:', e)
  }
  
  return null
}

// Agent API functions
export const agentAPI = {
  /**
   * Send message to AI agent for processing
   */
  async sendMessage(message: string, userId: string, threadId?: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const token = await getAuthToken()
    
    console.log('🚀 Sending message to agent:', { 
      message, 
      userId, 
      hasToken: !!token,
      endpoint: buildApiUrl(API_CONFIG.ENDPOINTS.AGENT_PROCESS)
    })
    
    const requestData: AgentRequest = {
      message,
      user_id: userId,
      thread_id: threadId,
      context
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
      
      console.log('📤 Request headers:', headers)
      console.log('📤 Request body:', requestData)
      
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AGENT_PROCESS), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      })

      console.log('📥 Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Response error body:', errorText)
        throw new Error(`Agent API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result: AgentResponse = await response.json()
      console.log('✅ Agent response:', result)
      return result
      
    } catch (error) {
      console.error('❌ Error communicating with agent:', error)
      
      // Fallback response for errors
      return {
        response: "I'm sorry, I encountered an error processing your request. Please try again.",
        success: false,
        action_taken: "error",
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  },

  /**
   * Send test message (for development)
   */
  async sendTestMessage(message: string, userId: string, threadId?: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const requestData: AgentRequest = {
      message,
      user_id: userId,
      thread_id: threadId,
      context
    }

    try {
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AGENT_TEST), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status} ${response.statusText}`)
      }

      const result: AgentResponse = await response.json()
      return result
      
    } catch (error) {
      console.error('Error communicating with test agent:', error)
      
      return {
        response: "I'm sorry, I encountered an error processing your request. Please try again.",
        success: false,
        action_taken: "error",
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  },

  /**
   * Generate thread title using backend MyloAgent and OpenAI
   */
  async generateThreadTitle(firstMessage: string, firstResponse: string): Promise<string> {
    const token = await getAuthToken()
    
         console.log('🎯 Generating thread title using MyloAgent:', { 
       firstMessage: firstMessage.substring(0, 50) + '...', 
       hasToken: !!token,
       endpoint: buildApiUrl('/api/agent/generate-thread-title')
     })
    
    const requestData = {
      first_message: firstMessage,
      first_response: firstResponse
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
      
             const response = await fetch(buildApiUrl('/api/agent/generate-thread-title'), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        console.warn('❌ Failed to generate title via backend, using fallback')
        // Fallback to simple client-side generation
        return firstMessage.split(' ').slice(0, 3).join(' ')
      }

      const result = await response.json()
      
      if (result.success && result.title) {
        console.log('✅ Generated title via MyloAgent:', result.title)
        return result.title
      } else {
        console.warn('❌ Backend returned error:', result.error)
        return result.title || firstMessage.split(' ').slice(0, 3).join(' ')
      }
      
    } catch (error) {
      console.error('❌ Error calling backend title generation:', error)
      
      // Fallback to test endpoint
      try {
          const testResponse = await fetch(buildApiUrl('/api/agent/test/generate-thread-title'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
        
        if (testResponse.ok) {
          const testResult = await testResponse.json()
          if (testResult.success && testResult.title) {
            console.log('✅ Generated title via test endpoint:', testResult.title)
            return testResult.title
          }
        }
      } catch (testError) {
        console.error('❌ Test endpoint also failed:', testError)
      }
      
      // Final fallback
      return firstMessage.split(' ').slice(0, 3).join(' ')
    }
  },

  /**
   * Check if backend is available
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl('/health'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      return response.ok
    } catch (error) {
      console.error('Backend health check failed:', error)
      return false
    }
  }
} 