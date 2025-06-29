/**
 * Voice Agent Status Component
 * Shows the current status of the ElevenLabs voice agent and provides controls for testing
 */
import React from 'react'
import { Mic, MicOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useVoiceAgentForCourse } from '../hooks/useVoiceAgent'

interface VoiceAgentStatusProps {
  courseId: string
  courseName: string
  showDetailedStatus?: boolean
  className?: string
}

export const VoiceAgentStatus: React.FC<VoiceAgentStatusProps> = ({
  courseId,
  courseName,
  showDetailedStatus = false,
  className = ''
}) => {
  const {
    context,
    isUpdating,
    isHealthy,
    lastUpdated,
    error,
    agentId,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    updateCurrentCourse,
    testContext,
    checkHealth,
    clearError
  } = useVoiceAgentForCourse(courseId)

  const getStatusIcon = () => {
    if (isUpdating) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
    }
    if (error) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    if (context && isHealthy) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    if (isHealthy) {
      return <Mic className="w-4 h-4 text-gray-500" />
    }
    return <MicOff className="w-4 h-4 text-gray-400" />
  }

  const getStatusText = () => {
    if (isUpdating) return 'Updating voice agent...'
    if (error) return 'Voice agent error'
    if (context && isHealthy) return 'Voice agent ready'
    if (isHealthy) return 'Voice agent available'
    return 'Voice agent unavailable'
  }

  const getStatusColor = () => {
    if (isUpdating) return 'text-blue-600'
    if (error) return 'text-red-600'
    if (context && isHealthy) return 'text-green-600'
    if (isHealthy) return 'text-gray-600'
    return 'text-gray-400'
  }

  const handleManualUpdate = async () => {
    const success = await updateCurrentCourse()
    if (success) {
      console.log('✅ Manual update successful')
    }
  }

  const handleTestContext = async () => {
    const testResult = await testContext(courseId)
    if (testResult) {
      console.log('✅ Test context successful:', testResult)
    }
  }

  const handleHealthCheck = async () => {
    const health = await checkHealth()
    console.log('Health check result:', health)
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Main Status Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </h3>
            {context && (
              <p className="text-sm text-gray-500">
                Context updated for {context.course.title}
              </p>
            )}
          </div>
        </div>

        {/* Toggle Auto-Update */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Auto-update:</label>
          <button
            onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
            className={`w-10 h-5 rounded-full transition-colors ${
              autoUpdateEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full transition-transform ${
                autoUpdateEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Detailed Status (if enabled) */}
      {showDetailedStatus && (
        <div className="mt-4 space-y-3">
          {/* Context Info */}
          {context && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Current Context</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Student:</strong> {context.student.name}</p>
                <p><strong>Course:</strong> {context.course.title}</p>
                <p><strong>Assignments:</strong> {context.course.assignments.length}</p>
                {agentId && <p><strong>Agent ID:</strong> {agentId}</p>}
                {lastUpdated && (
                  <p><strong>Last Updated:</strong> {lastUpdated.toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleManualUpdate}
              disabled={isUpdating}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>
            
            <button
              onClick={handleTestContext}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Test Context
            </button>
            
            <button
              onClick={handleHealthCheck}
              className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Health Check
            </button>
          </div>

          {/* Assignment Summary */}
          {context && context.course.assignments.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Assignment Summary</h4>
              <div className="text-sm text-blue-800 space-y-1">
                {context.course.assignments.map((assignment, index) => (
                  <div key={assignment.id} className="flex justify-between">
                    <span>{assignment.title}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      assignment.has_submission 
                        ? assignment.grade !== null 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-yellow-200 text-yellow-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {assignment.has_submission 
                        ? assignment.grade !== null 
                          ? `Graded: ${assignment.grade}/${assignment.total_points}`
                          : 'Submitted'
                        : 'Not submitted'
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && !showDetailedStatus && (
        <div className="mt-2 flex items-center text-xs text-gray-500">
          <Clock className="w-3 h-3 mr-1" />
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for course headers or sidebars
 */
export const VoiceAgentStatusCompact: React.FC<{
  courseId: string
  courseName: string
}> = ({ courseId, courseName }) => {
  const { context, isUpdating, isHealthy, error } = useVoiceAgentForCourse(courseId)

  const getStatusIndicator = () => {
    if (isUpdating) return 'bg-blue-500 animate-pulse'
    if (error) return 'bg-red-500'
    if (context && isHealthy) return 'bg-green-500'
    if (isHealthy) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${getStatusIndicator()}`} />
      <span className="text-gray-600">Voice Agent</span>
      {error && (
        <span className="text-red-600 text-xs">Error</span>
      )}
      {isUpdating && (
        <span className="text-blue-600 text-xs">Updating...</span>
      )}
      {context && isHealthy && !isUpdating && (
        <span className="text-green-600 text-xs">Ready</span>
      )}
    </div>
  )
} 