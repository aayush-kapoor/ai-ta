import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, Users, Plus } from 'lucide-react'
import { Course, Enrollment } from '../../types'
import { courseAPI, enrollmentAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export function StudentCourses() {
  const { user } = useAuth()
  const [enrolledCourses, setEnrolledCourses] = useState<Enrollment[]>([])
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)

  useEffect(() => {
    const loadCourses = async () => {
      if (!user) return

      try {
        const [enrolled, available] = await Promise.all([
          enrollmentAPI.getByStudent(user.id),
          courseAPI.getAll()
        ])
        
        setEnrolledCourses(enrolled)
        
        // Filter out courses the student is already enrolled in
        const enrolledCourseIds = enrolled.map(e => e.course_id)
        const filteredAvailable = available.filter(course => !enrolledCourseIds.includes(course.id))
        setAvailableCourses(filteredAvailable)
        
        // Get student counts for all courses
        const counts: Record<string, number> = {}
        await Promise.all(available.map(async (course) => {
          try {
            const enrollments = await enrollmentAPI.getByCourse(course.id)
            counts[course.id] = enrollments.length
          } catch (error) {
            console.error(`Error getting count for course ${course.id}:`, error)
            counts[course.id] = 0
          }
        }))
        setCourseCounts(counts)
        
      } catch (error) {
        console.error('Error loading courses:', error)
        toast.error('Failed to load courses. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [user])

  const handleEnroll = async (courseId: string) => {
    if (!user) return

    setEnrolling(courseId)
    try {
      await enrollmentAPI.enroll(courseId, user.id)
      
      // Refresh courses
      const [enrolled, available] = await Promise.all([
        enrollmentAPI.getByStudent(user.id),
        courseAPI.getAll()
      ])
      setEnrolledCourses(enrolled)
      
      // Filter out courses the student is already enrolled in
      const enrolledCourseIds = enrolled.map(e => e.course_id)
      const filteredAvailable = available.filter(course => !enrolledCourseIds.includes(course.id))
      setAvailableCourses(filteredAvailable)
      
      // Update student count for the enrolled course
      const enrollments = await enrollmentAPI.getByCourse(courseId)
      setCourseCounts(prev => ({
        ...prev,
        [courseId]: enrollments.length
      }))
      
      toast.success('Successfully enrolled in course!')
    } catch (error) {
      console.error('Error enrolling in course:', error)
      toast.error('Failed to enroll in course. Please try again.')
    } finally {
      setEnrolling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
        <p className="text-gray-600 mt-2">View your enrolled courses and discover new ones</p>
      </div>

      {/* Enrolled Courses */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Enrolled Courses</h2>
        
        {enrolledCourses.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-pink-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No enrolled courses</h3>
            <p className="text-gray-600">Browse available courses below to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCourses.map((enrollment) => (
              <Link
                key={enrollment.id}
                to={`/student/courses/${enrollment.course_id}`}
                className="bg-white rounded-xl shadow-sm border border-pink-100 p-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">
                      {enrollment.course?.title}
                    </h3>
                    <p className="text-sm text-gray-600 font-medium">{enrollment.course?.description}</p>
                  </div>
                  <BookOpen className="w-6 h-6 text-pink-500" />
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{enrollment.course?.description}</p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{courseCounts[enrollment.course_id] || 0} students</span>
                  </div>
                  <span className="text-pink-600 font-medium">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Available Courses */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Available Courses</h2>
        
        {availableCourses.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-blue-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No available courses</h3>
            <p className="text-gray-600">You're enrolled in all available courses!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-xl shadow-sm border border-blue-100 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                    <p className="text-sm text-gray-600 font-medium">{course.teacher?.full_name}</p>
                  </div>
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>{courseCounts[course.id] || 0} students</span>
                  </div>
                  
                  <button
                    onClick={() => handleEnroll(course.id)}
                    disabled={enrolling === course.id}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{enrolling === course.id ? 'Enrolling...' : 'Enroll'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}