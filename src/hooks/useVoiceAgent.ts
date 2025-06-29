/**
 * React Hook for Voice Agent Management
 * Provides easy-to-use interface for managing ElevenLabs voice agent context
 */
import { useState, useEffect, useCallback } from 'react'
import { voiceAgentAPI, VoiceAgentContext, VoiceAgentHealthResponse } from '../services/voiceAgentAPI'
import { useAuth } from '../contexts/AuthContext'

interface UseVoiceAgentState {
  context: VoiceAgentContext | null
  isUpdating: boolean
  isHealthy: boolean
  lastUpdated: Date | null
  error: string | null
  agentId: string | null
}

interface UseVoiceAgentActions {
  updateContext: (courseId: string, agentId?: string) => Promise<boolean>
  refreshContext: (courseId: string) => Promise<VoiceAgentContext | null>
  checkHealth: () => Promise<VoiceAgentHealthResponse>
  testContext: (courseId: string) => Promise<VoiceAgentContext | null>
  clearError: () => void
}

interface UseVoiceAgentReturn extends UseVoiceAgentState, UseVoiceAgentActions {}

export const useVoiceAgent = (): UseVoiceAgentReturn => {
  const { user } = useAuth()
  
  const [state, setState] = useState<UseVoiceAgentState>({
    context: null,
    isUpdating: false,
    isHealthy: false,
    lastUpdated: null,
    error: null,
    agentId: null
  })

  // Update voice agent context for the current course
  const updateContext = useCallback(async (courseId: string, agentId?: string): Promise<boolean> => {
    if (!user?.id) {
      console.warn('❌ No user found for voice agent update')
      setState(prev => ({ ...prev, error: 'User not authenticated' }))
      return false
    }

    setState(prev => ({ ...prev, isUpdating: true, error: null }))

    try {
      console.log('🎤 Updating voice agent context for course:', courseId)
      
      const result = await voiceAgentAPI.updateContext(user.id, courseId, agentId)
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          context: result.context || null,
          agentId: result.agent_id || null,
          lastUpdated: new Date(),
          isUpdating: false,
          error: null
        }))
        
        console.log('✅ Voice agent context updated successfully')
        return result.knowledge_base_updated
      } else {
        setState(prev => ({
          ...prev,
          isUpdating: false,
          error: result.message
        }))
        
        console.warn('⚠️ Voice agent update failed:', result.message)
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        isUpdating: false,
        error: errorMessage
      }))
      
      console.error('❌ Voice agent update error:', error)
      return false
    }
  }, [user?.id])

  // Get current context for debugging/display
  const refreshContext = useCallback(async (courseId: string): Promise<VoiceAgentContext | null> => {
    if (!user?.id) {
      console.warn('❌ No user found for context refresh')
      return null
    }

    try {
      const context = await voiceAgentAPI.getContext(user.id, courseId)
      
      setState(prev => ({
        ...prev,
        context,
        error: null
      }))
      
      return context
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      
      console.error('❌ Context refresh error:', error)
      return null
    }
  }, [user?.id])

  // Check service health
  const checkHealth = useCallback(async (): Promise<VoiceAgentHealthResponse> => {
    try {
      const healthResult = await voiceAgentAPI.checkHealth()
      
      setState(prev => ({
        ...prev,
        isHealthy: healthResult.elevenlabs_service_available,
        error: healthResult.status === 'healthy' ? null : healthResult.message
      }))
      
      return healthResult
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check failed'
      
      setState(prev => ({
        ...prev,
        isHealthy: false,
        error: errorMessage
      }))
      
      return {
        status: 'unhealthy',
        elevenlabs_service_available: false,
        message: errorMessage
      }
    }
  }, [])

  // Test context building (development)
  const testContext = useCallback(async (courseId: string): Promise<VoiceAgentContext | null> => {
    if (!user?.id) {
      console.warn('❌ No user found for test context')
      return null
    }

    try {
      const context = await voiceAgentAPI.testContext(user.id, courseId)
      
      setState(prev => ({
        ...prev,
        context,
        error: null
      }))
      
      return context
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test context failed'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      
      console.error('❌ Test context error:', error)
      return null
    }
  }, [user?.id])

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Check health on mount
  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  return {
    // State
    context: state.context,
    isUpdating: state.isUpdating,
    isHealthy: state.isHealthy,
    lastUpdated: state.lastUpdated,
    error: state.error,
    agentId: state.agentId,
    
    // Actions
    updateContext,
    refreshContext,
    checkHealth,
    testContext,
    clearError
  }
}

/**
 * Hook specifically for course pages to automatically manage voice agent context
 */
export const useVoiceAgentForCourse = (courseId: string | undefined) => {
  const voiceAgent = useVoiceAgent()
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true)

  // Auto-update context when course changes (if enabled)
  useEffect(() => {
    if (courseId && autoUpdateEnabled && !voiceAgent.isUpdating) {
      console.log('🔄 Auto-updating voice agent for course:', courseId)
      voiceAgent.updateContext(courseId)
    }
  }, [courseId, autoUpdateEnabled, voiceAgent.updateContext, voiceAgent.isUpdating])

  return {
    ...voiceAgent,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    
    // Convenience function to manually trigger update for current course
    updateCurrentCourse: useCallback(() => {
      if (courseId) {
        return voiceAgent.updateContext(courseId)
      }
      return Promise.resolve(false)
    }, [courseId, voiceAgent.updateContext])
  }
} 