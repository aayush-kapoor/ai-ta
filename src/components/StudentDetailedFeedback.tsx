import React from 'react'
import { CheckCircle, AlertCircle, XCircle, Target, Lightbulb } from 'lucide-react'
import { GradingResult } from '../types'

interface StudentDetailedFeedbackProps {
  detailedFeedback: GradingResult['detailed_result']
  totalPoints: number
}

export function StudentDetailedFeedback({ detailedFeedback, totalPoints }: StudentDetailedFeedbackProps) {
  if (!detailedFeedback) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Target className="w-5 h-5 text-blue-600" />
        <h4 className="text-lg font-semibold text-blue-800">Your Detailed Feedback</h4>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Your Grade</p>
          <p className="text-2xl font-bold text-blue-800">
            {detailedFeedback.grade} / {totalPoints}
          </p>
          <p className="text-sm text-blue-600">
            ({detailedFeedback.percentage}%)
          </p>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Assessment Quality</p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-blue-100 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${detailedFeedback.confidence_level * 100}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-blue-800">
              {Math.round(detailedFeedback.confidence_level * 100)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Overall Feedback */}
      <div className="bg-white rounded-lg p-4 border border-blue-200 mb-4">
        <p className="text-sm text-blue-600 font-medium mb-2">Overall Assessment</p>
        <p className="text-gray-700 text-sm leading-relaxed">{detailedFeedback.feedback.overall}</p>
      </div>

      {/* Detailed Feedback Sections */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Strengths */}
        {detailedFeedback.feedback.strengths.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">What You Did Well</p>
            </div>
            <ul className="space-y-1">
              {detailedFeedback.feedback.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {detailedFeedback.feedback.areas_for_improvement.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-600 font-medium">Areas to Improve</p>
            </div>
            <ul className="space-y-1">
              {detailedFeedback.feedback.areas_for_improvement.map((area, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {area}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Missing Elements */}
      {detailedFeedback.feedback.missing_elements.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-red-200 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-600 font-medium">What Was Missing</p>
          </div>
          <ul className="space-y-1">
            {detailedFeedback.feedback.missing_elements.map((missing, index) => (
              <li key={index} className="text-sm text-gray-700 leading-relaxed">
                • {missing}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rubric Breakdown */}
      {detailedFeedback.rubric_breakdown.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-blue-200 mb-4">
          <p className="text-sm text-blue-600 font-medium mb-3">Grade Breakdown</p>
          <div className="space-y-3">
            {detailedFeedback.rubric_breakdown.map((item, index) => (
              <div key={index} className="border-l-4 border-blue-300 pl-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-800">{item.criteria}</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-800">
                      {item.points_earned}/{item.max_points}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-1">{item.justification}</p>
                <p className="text-xs text-gray-500">{item.quality_assessment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {detailedFeedback.recommendations.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center space-x-2 mb-2">
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            <p className="text-sm text-indigo-600 font-medium">How to Improve Next Time</p>
          </div>
          <ul className="space-y-1">
            {detailedFeedback.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-gray-700 leading-relaxed">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 