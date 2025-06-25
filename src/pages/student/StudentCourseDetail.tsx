import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Clock, CheckCircle, Calendar, User } from 'lucide-react'
import { Course, Assignment } from '../../types'
import { courseAPI, assignmentAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export function StudentCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId || !user) return

      try {
        const [courseData, assignmentsData] = await Promise.all([
          courseAPI.getById(courseId),
          assignmentAPI.getByCourse(courseId)
        ])
        
        setCourse(courseData)
        // Only show published assignments for students
        setAssignments(assignmentsData.filter(a => a.status === 'published'))
      } catch (error) {
        console.error('Error loading course data:', error)
        toast.error('Failed to load course data. Please try again.')
        navigate('/student/courses')
      } finally {
        setLoading(false)
      }
    }

    loadCourseData()
  }, [courseId, user, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Course not found</h2>
        <p className="text-gray-600 mb-4">The course you're looking for doesn't exist or you don't have access to it.</p>
        <Link
          to="/student/courses"
          className="text-pink-600 hover:text-pink-700 font-medium"
        >
          Back to Courses
        </Link>
      </div>
    )
  }

  const upcomingAssignments = assignments.filter(a => new Date(a.due_date) > new Date())
  const pastAssignments = assignments.filter(a => new Date(a.due_date) <= new Date())

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/student/courses')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
          <div className="flex items-center space-x-4 mt-2 text-gray-600">
            <span className="font-medium">{course.course_code}</span>
            <div className="flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>{course.teacher?.full_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Course Description */}
      <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Description</h2>
        <p className="text-gray-700 leading-relaxed">{course.description}</p>
      </div>

      {/* Assignments Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Assignments</h2>
          <div className="text-sm text-gray-600">
            {assignments.length} total assignments
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
            <p className="text-gray-600">Your instructor hasn't posted any assignments for this course.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Assignments */}
            {upcomingAssignments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span>Upcoming Assignments</span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                    {upcomingAssignments.length}
                  </span>
                </h3>
                <div className="grid gap-4">
                  {upcomingAssignments.map((assignment) => (
                    <Link
                      key={assignment.id}
                      to={`/student/courses/${courseId}/assignments/${assignment.id}`}
                      className="bg-white rounded-lg shadow-sm border border-orange-100 p-6 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                            {assignment.title}
                          </h4>
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{assignment.description}</p>
                          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                            </div>
                            <span>{assignment.total_points} points</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Upcoming
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Past Assignments */}
            {pastAssignments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-gray-500" />
                  <span>Past Assignments</span>
                  <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                    {pastAssignments.length}
                  </span>
                </h3>
                <div className="grid gap-4">
                  {pastAssignments.map((assignment) => (
                    <Link
                      key={assignment.id}
                      to={`/student/courses/${courseId}/assignments/${assignment.id}`}
                      className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow group opacity-75"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                            {assignment.title}
                          </h4>
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{assignment.description}</p>
                          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                            </div>
                            <span>{assignment.total_points} points</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Past Due
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 