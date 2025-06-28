import React, { useState, useEffect } from 'react'
import { Save, Star, MessageSquare } from 'lucide-react'
import { Submission } from '../types'

interface GradingPanelProps {
  submission: Submission
  maxPoints: number
  onGradeSubmit: (grade: number, feedback: string) => Promise<void>
  isSubmitting?: boolean
  autoGradeResult?: {
    grade: number
    feedback: string
  } | null
}

export function GradingPanel({ 
  submission, 
  maxPoints, 
  onGradeSubmit, 
  isSubmitting = false,
  autoGradeResult = null
}: GradingPanelProps) {
  const [grade, setGrade] = useState<string>(submission.grade?.toString() || '')
  const [feedback, setFeedback] = useState(submission.feedback || '')
  const [hasChanges, setHasChanges] = useState(false)

  // Update grade and feedback when auto-grade result is available
  useEffect(() => {
    if (autoGradeResult) {
      setGrade(autoGradeResult.grade.toString())
      setFeedback(autoGradeResult.feedback)
      setHasChanges(true)
    }
  }, [autoGradeResult])

  const handleGradeChange = (value: string) => {
    setGrade(value)
    setHasChanges(true)
  }

  const handleFeedbackChange = (value: string) => {
    setFeedback(value)
    setHasChanges(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const gradeValue = parseFloat(grade)
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > maxPoints) {
      alert(`Grade must be between 0 and ${maxPoints}`)
      return
    }

    try {
      await onGradeSubmit(gradeValue, feedback)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to submit grade:', error)
    }
  }

  const getGradeColor = (currentGrade: number, max: number) => {
    const percentage = (currentGrade / max) * 100
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    if (percentage >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const currentGradeValue = parseFloat(grade)
  const isValidGrade = !isNaN(currentGradeValue) && currentGradeValue >= 0 && currentGradeValue <= maxPoints

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-900">Grade Submission</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grade Input */}
        <div>
          <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
            Grade (out of {maxPoints} points)
          </label>
          <div className="relative">
            <input
              type="number"
              id="grade"
              min="0"
              max={maxPoints}
              step="0.5"
              value={grade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
              placeholder={`Enter grade (0-${maxPoints})`}
              disabled={isSubmitting}
            />
            {isValidGrade && (
              <div className="absolute right-3 top-2">
                <span className={`text-sm font-medium ${getGradeColor(currentGradeValue, maxPoints)}`}>
                  {Math.round((currentGradeValue / maxPoints) * 100)}%
                </span>
              </div>
            )}
          </div>
          {grade && !isValidGrade && (
            <p className="mt-1 text-sm text-red-600">
              Grade must be between 0 and {maxPoints}
            </p>
          )}
        </div>

        {/* Quick Grade Buttons */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Quick grades:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'A (90%)', value: Math.round(maxPoints * 0.9) },
              { label: 'B (80%)', value: Math.round(maxPoints * 0.8) },
              { label: 'C (70%)', value: Math.round(maxPoints * 0.7) },
              { label: 'D (60%)', value: Math.round(maxPoints * 0.6) },
              { label: 'Full Points', value: maxPoints },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleGradeChange(option.value.toString())}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                {option.label} ({option.value}pts)
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div>
          <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Feedback (optional)</span>
            </div>
          </label>
          <textarea
            id="feedback"
            rows={4}
            value={feedback}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
            placeholder="Provide feedback to help the student improve..."
            disabled={isSubmitting}
          />
        </div>

        {/* Current Grade Display */}
        {submission.grade !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800">Current Grade:</p>
                <p className={`text-lg font-semibold ${getGradeColor(submission.grade, maxPoints)}`}>
                  {submission.grade} / {maxPoints} points ({Math.round((submission.grade / maxPoints) * 100)}%)
                </p>
              </div>
              {submission.graded_at && (
                <div className="text-right">
                  <p className="text-xs text-blue-600">Graded on:</p>
                  <p className="text-sm text-blue-800">
                    {new Date(submission.graded_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            {submission.feedback && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm text-blue-800 font-medium">Previous Feedback:</p>
                <p className="text-sm text-blue-700 mt-1">{submission.feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="text-orange-600">
                {autoGradeResult ? 'Auto-grade ready for review' : 'You have unsaved changes'}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isValidGrade || !hasChanges}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              autoGradeResult 
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600' 
                : 'bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600'
            } text-white`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {autoGradeResult 
                    ? 'Submit Reviewed Grade' 
                    : submission.grade !== null ? 'Update Grade' : 'Submit Grade'
                  }
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
} 