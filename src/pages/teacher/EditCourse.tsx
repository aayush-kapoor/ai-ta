import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, Trash2 } from 'lucide-react'
import { Course } from '../../types'
import { courseAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export function EditCourse() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) return

      try {
        const courseData = await courseAPI.getById(courseId)
        setCourse(courseData)

        if (courseData) {
          setFormData({
            title: courseData.title,
            description: courseData.description || ''
          })
        }
      } catch (error) {
        console.error('Error loading course:', error)
        toast.error('Failed to load course data.')
        navigate('/teacher/courses')
      } finally {
        setLoading(false)
      }
    }

    loadCourse()
  }, [courseId, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !user) return

    // Validation
    if (!formData.title.trim()) {
      toast.error('Course title is required')
      return
    }

    setSubmitting(true)
    try {
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined
      }

      await courseAPI.update(courseId, updateData)
      toast.success('Course updated successfully!')
      navigate(`/teacher/courses/${courseId}`)
    } catch (error) {
      console.error('Error updating course:', error)
      toast.error('Failed to update course. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!courseId) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this course? This action will also delete all assignments and submissions associated with this course. This cannot be undone.'
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      await courseAPI.delete(courseId)
      toast.success('Course deleted successfully')
      navigate('/teacher/courses')
    } catch (error) {
      console.error('Error deleting course:', error)
      toast.error('Failed to delete course. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
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
        <p className="text-gray-600">Unable to load course data.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(`/teacher/courses/${courseId}`)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Course</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Course</h1>
          <p className="text-gray-600 mt-1">
            {course.title}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Course Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter course title"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter course description (optional)"
            />
          </div>

          {/* Course Information */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <span className="text-gray-500">Created:</span> {new Date(course.created_at).toLocaleDateString()}
              </div>
              {course.updated_at && (
                <div>
                  <span className="text-gray-500">Last Updated:</span> {new Date(course.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleting ? 'Deleting...' : 'Delete Course'}</span>
            </button>

            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/teacher/courses/${courseId}`)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-blue-500 text-white rounded-lg hover:from-pink-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 