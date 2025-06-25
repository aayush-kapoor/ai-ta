import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  BookOpen, 
  Plus, 
  FileText, 
  Users, 
  Calendar, 
  Edit,
  Trash2,
  Clock,
  Award
} from 'lucide-react'
import { Course, Assignment, Enrollment } from '../../types'
import { courseAPI, assignmentAPI, enrollmentAPI } from '../../services/api'

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingAssignment, setDeletingAssignment] = useState<string | null>(null)

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId) return

      try {
        const [courseData, assignmentsData, enrollmentsData] = await Promise.all([
          courseAPI.getById(courseId),
          assignmentAPI.getByCourse(courseId),
          enrollmentAPI.getByCourse(courseId)
        ])

        setCourse(courseData)
        setAssignments(assignmentsData)
        setEnrollments(enrollmentsData)
      } catch (error) {
        console.error('Error loading course data:', error)
        toast.error('Failed to load course data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadCourseData()
  }, [courseId])

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      return
    }

    setDeletingAssignment(assignmentId)
    try {
      await assignmentAPI.delete(assignmentId)
      setAssignments(assignments.filter(a => a.id !== assignmentId))
      toast.success('Assignment deleted successfully')
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast.error('Failed to delete assignment. Please try again.')
    } finally {
      setDeletingAssignment(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700'
      case 'draft': return 'bg-yellow-100 text-yellow-700'
      case 'closed': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Course not found</h3>
        <p className="text-gray-600 mb-4">The course you're looking for doesn't exist or you don't have access to it.</p>
        <Link
          to="/teacher/courses"
          className="text-pink-600 hover:text-pink-700 font-medium"
        >
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
                <p className="text-sm text-gray-500">
                  Created {new Date(course.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {course.description && (
              <p className="text-gray-600 mt-3">{course.description}</p>
            )}
          </div>
          <Link
            to={`/teacher/courses/${courseId}/edit`}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm">Edit Course</span>
          </Link>
        </div>

        {/* Course Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Students Enrolled</p>
              <p className="font-semibold text-gray-900">{enrollments.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Assignments</p>
              <p className="font-semibold text-gray-900">{assignments.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Award className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Total Points</p>
              <p className="font-semibold text-gray-900">
                {assignments.reduce((total, assignment) => total + assignment.total_points, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments Section */}
      <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Assignments</h2>
          <Link
            to={`/teacher/courses/${courseId}/assignments/new`}
            className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Assignment</span>
          </Link>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
            <p className="text-gray-600 mb-4">Create your first assignment to get started.</p>
            <Link
              to={`/teacher/courses/${courseId}/assignments/new`}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>Create Assignment</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-pink-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link
                        to={`/teacher/courses/${courseId}/assignments/${assignment.id}`}
                        className="text-lg font-medium text-gray-900 hover:text-pink-600 transition-colors"
                      >
                        {assignment.title}
                      </Link>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>
                    {assignment.description && (
                      <p className="text-gray-600 mb-3">{assignment.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {formatDate(assignment.due_date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Award className="w-4 h-4" />
                        <span>{assignment.total_points} points</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Created {new Date(assignment.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      to={`/teacher/courses/${courseId}/assignments/${assignment.id}`}
                      className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">View</span>
                    </Link>
                    <Link
                      to={`/teacher/courses/${courseId}/assignments/${assignment.id}/edit`}
                      className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="text-sm">Edit</span>
                    </Link>
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      disabled={deletingAssignment === assignment.id}
                      className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">
                        {deletingAssignment === assignment.id ? 'Deleting...' : 'Delete'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 