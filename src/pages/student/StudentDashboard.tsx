import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, FileText, Clock, Plus } from 'lucide-react'
import { Assignment, Submission, Enrollment } from '../../types'
import { enrollmentAPI, submissionAPI, assignmentAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export function StudentDashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return

      try {
        const [enrollmentsData, submissionsData, assignmentsData] = await Promise.all([
          enrollmentAPI.getByStudent(user.id),
          submissionAPI.getByStudent(user.id),
          assignmentAPI.getByStudentCourses(user.id)
        ])
        setEnrollments(enrollmentsData)
        setSubmissions(submissionsData)
        setAssignments(assignmentsData)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
        toast.error('Failed to load dashboard data. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  const upcomingAssignments = assignments
    .filter(assignment => {
      if (!assignment.due_date) return false
      const dueDate = new Date(assignment.due_date)
      const now = new Date()
      return dueDate > now
    })
    .sort((a, b) => {
      if (!a.due_date || !b.due_date) return 0
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
    .slice(0, 5)

  const recentSubmissions = submissions
    .filter(submission => submission.submitted_at)
    .sort((a, b) => {
      if (!a.submitted_at || !b.submitted_at) return 0
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })
    .slice(0, 3)

  const stats = [
    {
      name: 'Enrolled Courses',
      value: enrollments.length,
      icon: BookOpen,
      color: 'bg-pink-500'
    },
    {
      name: 'Upcoming Assignments',
      value: upcomingAssignments.length,
      icon: Clock,
      color: 'bg-blue-500'
    },
    {
      name: 'Total Submissions',
      value: submissions.length,
      icon: FileText,
      color: 'bg-purple-500'
    }
  ]

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your courses and assignments.</p>
        </div>
        <Link
          to="/student/courses"
          className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Browse Courses</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="bg-white rounded-xl shadow-sm border border-pink-100 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 h-fit">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Assignments</h2>
            <Link
              to="/student/courses"
              className="text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {upcomingAssignments.length > 0 ? (
              upcomingAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  to={`/student/courses/${assignment.course_id}/assignments/${assignment.id}`}
                  className="flex items-center justify-between p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors group"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 group-hover:text-pink-700">{assignment.title}</h3>
                    <p className="text-sm text-gray-600">
                      Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
                    </p>
                    <p className="text-xs text-gray-500">{assignment.course?.title}</p>
                  </div>
                  <Clock className="w-5 h-5 text-pink-600" />
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No upcoming assignments</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 h-fit">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Submissions</h2>
            {/* <Link
              to="/student/courses"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all
            </Link> */}
          </div>
          <div className="space-y-4">
            {recentSubmissions.length > 0 ? (
              recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {submission.original_filename || 'Unnamed file'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'Unknown date'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {submission.assignment?.course?.title || 'Unknown Course'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {submission.grade !== null && submission.grade !== undefined ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {submission.grade}/{submission.assignment?.total_points}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No submissions yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}