import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, Plus, Users, FileText } from 'lucide-react'
import { Course } from '../../types'
import { mockAPI } from '../../services/mockAPI'

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const coursesData = await mockAPI.getCourses()
        setCourses(coursesData)
      } catch (error) {
        console.error('Error loading courses:', error)
        toast.error('Failed to load courses. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-600 mt-2">Manage your courses and assignments</p>
        </div>
        <Link
          to="/teacher/courses/new"
          className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first course</p>
          <Link
            to="/teacher/courses/new"
            className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200"
          >
            Create Course
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/teacher/courses/${course.id}`}
              className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-600 font-medium">{course.course_code}</p>
                </div>
                <BookOpen className="w-6 h-6 text-pink-500" />
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>45 students</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>12 assignments</span>
                  </div>
                </div>
                <span className="text-pink-600 font-medium">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}