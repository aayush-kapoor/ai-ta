import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, Users, FileText, TrendingUp, Plus } from 'lucide-react'
import { Course, Assignment, Submission } from '../../types'
import { mockAPI } from '../../services/mockAPI'

export function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [coursesData, assignmentsData, submissionsData] = await Promise.all([
          mockAPI.getCourses(),
          mockAPI.getAssignments(),
          mockAPI.getSubmissions()
        ])
        setCourses(coursesData)
        setAssignments(assignmentsData)
        setSubmissions(submissionsData)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
        toast.error('Failed to load dashboard data. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Total Courses',
      value: courses.length,
      icon: BookOpen,
      color: 'bg-pink-500',
      href: '/teacher/courses'
    },
    {
      name: 'Total Assignments',
      value: assignments.length,
      icon: FileText,
      color: 'bg-blue-500',
      href: '/teacher/courses'
    },
    {
      name: 'Pending Submissions',
      value: submissions.filter(s => !s.grade).length,
      icon: TrendingUp,
      color: 'bg-purple-500',
      href: '/teacher/courses'
    },
    {
      name: 'Total Students',
      value: 45, // Mock data
      icon: Users,
      color: 'bg-green-500',
      href: '/teacher/courses'
    }
  ]

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your courses and assignments.</p>
        </div>
        <Link
          to="/teacher/courses/new"
          className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 hover:shadow-md transition-shadow"
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
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Courses</h2>
            <Link
              to="/teacher/courses"
              className="text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {courses.slice(0, 3).map((course) => (
              <Link
                key={course.id}
                to={`/teacher/courses/${course.id}`}
                className="flex items-center justify-between p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{course.title}</h3>
                  <p className="text-sm text-gray-600">{course.course_code}</p>
                </div>
                <BookOpen className="w-5 h-5 text-pink-600" />
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Submissions</h2>
            <Link
              to="/teacher/courses"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {submissions.slice(0, 3).map((submission) => (
              <div
                key={submission.id}
                className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{submission.file_name}</h3>
                  <p className="text-sm text-gray-600">
                    Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {submission.grade ? (
                    <span className="text-green-600 font-medium">{submission.grade}%</span>
                  ) : (
                    <span className="text-yellow-600 font-medium">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}