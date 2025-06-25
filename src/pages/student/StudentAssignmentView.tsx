import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, FileText, Clock, CheckCircle, Upload } from 'lucide-react'
import { Assignment, Course } from '../../types'
import { assignmentAPI, courseAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

type TabType = 'details' | 'rubric' | 'submit'

export function StudentAssignmentView() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('details')

  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!assignmentId || !courseId || !user) return

      try {
        const [assignmentData, courseData] = await Promise.all([
          assignmentAPI.getById(assignmentId),
          courseAPI.getById(courseId)
        ])
        
        if (!assignmentData || assignmentData.status !== 'published') {
          toast.error('Assignment not found or not available.')
          navigate(`/student/courses/${courseId}`)
          return
        }

        setAssignment(assignmentData)
        setCourse(courseData)
      } catch (error) {
        console.error('Error loading assignment data:', error)
        toast.error('Failed to load assignment data. Please try again.')
        navigate(`/student/courses/${courseId}`)
      } finally {
        setLoading(false)
      }
    }

    loadAssignmentData()
  }, [assignmentId, courseId, user, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!assignment || !course) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Assignment not found</h2>
        <p className="text-gray-600 mb-4">The assignment you're looking for doesn't exist or is not available.</p>
        <Link
          to={`/student/courses/${courseId}`}
          className="text-pink-600 hover:text-pink-700 font-medium"
        >
          Back to Course
        </Link>
      </div>
    )
  }

  const dueDate = new Date(assignment.due_date)
  const now = new Date()
  const isOverdue = dueDate < now
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const tabs = [
    { id: 'details' as TabType, label: 'Assignment Details', icon: FileText },
    { id: 'rubric' as TabType, label: 'Rubric', icon: CheckCircle },
    { id: 'submit' as TabType, label: 'Submit Assignment', icon: Upload }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(`/student/courses/${courseId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
            <span>{course.course_code}</span>
            <span>•</span>
            <span>{course.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold text-gray-900">
                {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : 'bg-green-100'}`}>
              <Clock className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                {isOverdue ? 'Overdue' : daysUntilDue === 0 ? 'Due Today' : `${daysUntilDue} days left`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Points</p>
              <p className="font-semibold text-gray-900">{assignment.total_points} points</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submission</p>
              <p className="font-semibold text-gray-900">Not submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <div className="prose max-w-none text-gray-700">
                  <p className="whitespace-pre-wrap">{assignment.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Assignment Details</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Points:</span>
                      <span className="font-medium">{assignment.total_points}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due Date:</span>
                      <span className="font-medium">{dueDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-medium">{assignment.status}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Course:</span>
                      <span className="font-medium">{course.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Course Code:</span>
                      <span className="font-medium">{course.course_code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Instructor:</span>
                      <span className="font-medium">{course.teacher?.full_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rubric' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grading Rubric</h3>
              {assignment.rubric_markdown ? (
                <div className="prose max-w-none">
                  <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
                    {assignment.rubric_markdown}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No rubric has been provided for this assignment.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'submit' && (
            <div className="text-center py-12">
              <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Assignment</h3>
              <p className="text-gray-600 mb-6">
                Assignment submission functionality is coming soon.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-blue-800 text-sm">
                  <strong>Placeholder:</strong> This feature will allow you to upload files, 
                  add comments, and submit your assignment for grading.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 