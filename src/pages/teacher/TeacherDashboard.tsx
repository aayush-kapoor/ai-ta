import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, FileText, TrendingUp, Plus } from 'lucide-react'
import { Course, Assignment, Submission } from '../../types'
import { courseAPI, assignmentAPI, submissionAPI } from '../../services/api'

export function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load courses data - we can get this directly
        const coursesData = await courseAPI.getAll()
        setCourses(coursesData)
        
        // For assignments and submissions, we need to aggregate from all courses
        const allAssignments: Assignment[] = []
        const allSubmissions: Submission[] = []
        
        for (const course of coursesData) {
          try {
            const courseAssignments = await assignmentAPI.getByCourse(course.id)
            allAssignments.push(...courseAssignments)
            
            // Get submissions for each assignment
            for (const assignment of courseAssignments) {
              try {
                const assignmentSubmissions = await submissionAPI.getByAssignment(assignment.id)
                // Add course info to each submission since the API doesn't include it
                const submissionsWithCourse = assignmentSubmissions.map(submission => ({
                  ...submission,
                  assignment: submission.assignment ? {
                    ...submission.assignment,
                    course: assignment.course
                  } : undefined
                }))
                allSubmissions.push(...submissionsWithCourse as Submission[])
                

              } catch (submissionError) {
                // Individual assignment submission fetch failed - continue with others
                console.warn(`Failed to load submissions for assignment ${assignment.id}:`, submissionError)
              }
            }
          } catch (assignmentError) {
            // Individual course assignment fetch failed - continue with others
            console.warn(`Failed to load assignments for course ${course.id}:`, assignmentError)
          }
        }
        
        setAssignments(allAssignments)
        setSubmissions(allSubmissions)
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
      href: ''
    },
    {
      name: 'Submissions to be graded',
      value: submissions.filter(s => s.grade === null || s.grade === undefined).length,
      icon: TrendingUp,
      color: 'bg-purple-500',
      href: ''
    },
    
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          const content = (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} rounded-lg p-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          )

          // If href is empty or not provided, render as div, otherwise as Link
          if (!stat.href || stat.href.trim() === '') {
            return (
              <div
                key={stat.name}
                className="bg-white rounded-xl shadow-sm border border-pink-100 p-6"
              >
                {content}
              </div>
            )
          }

          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 hover:shadow-md transition-shadow"
            >
              {content}
            </Link>
          )
        })}
      </div>

            <div className="space-y-8 lg:space-y-0">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
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
                    <p className="text-sm text-gray-600">{course.description || 'No description'}</p>
                  </div>
                  <BookOpen className="w-5 h-5 text-pink-600" />
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Submissions</h2>
              {/* <Link
                to="/teacher/courses"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all
              </Link> */}
            </div>
            <div className="space-y-4">
              {submissions.slice(0, 3).map((submission) => {
                const studentName = submission.student?.full_name || 'Unknown Student'
                
                return (
                  <Link
                    key={submission.id}
                    to={`/teacher/courses/${submission.assignment?.course_id}/assignments/${submission.assignment_id}/submissions/${submission.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-blue-50 border-blue-200 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900">{submission.original_filename || 'Unnamed file'}</h3>
                        {/* <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full">
                          {courseName}
                        </span> */}
                      </div>
                      <p className="text-sm text-gray-600">
                        Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'Unknown date'} by <span className="font-medium">{studentName}</span>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {submission.grade !== null && submission.grade !== undefined ? (
                          <span className="text-green-600 font-medium bg-white px-2 py-1 rounded-full text-sm">
                            Graded
                          </span>
                      ) : (
                        <span className="text-yellow-600 font-medium bg-white px-2 py-1 rounded-full text-sm">
                          Pending
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}