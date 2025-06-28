import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Award, FileText, Clock } from 'lucide-react'
import { Course, Assignment, AssignmentStatus } from '../../types'
import { courseAPI, assignmentAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { MarkdownEditor } from '../../components/MarkdownEditor'

export function EditAssignment() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    total_points: 100,
    status: 'draft' as AssignmentStatus
  })

  useEffect(() => {
    const loadData = async () => {
      if (!courseId || !assignmentId) return

      try {
        const [courseData, assignmentData] = await Promise.all([
          courseAPI.getById(courseId),
          assignmentAPI.getById(assignmentId)
        ])

        setCourse(courseData)
        setAssignment(assignmentData)

        if (assignmentData) {
          setFormData({
            title: assignmentData.title,
            description: assignmentData.description || '',
            due_date: assignmentData.due_date ? assignmentData.due_date.slice(0, 16) : '', // Format for datetime-local
            total_points: assignmentData.total_points,
            status: assignmentData.status
          })
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load assignment data.')
        navigate('/teacher/courses')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [courseId, assignmentId, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !assignmentId || !user) return

    // Validation
    if (!formData.title.trim()) {
      toast.error('Assignment title is required')
      return
    }

    if (formData.total_points <= 0) {
      toast.error('Total points must be greater than 0')
      return
    }

    setSubmitting(true)
    try {
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        due_date: formData.due_date || undefined,
        total_points: formData.total_points,
        status: formData.status
      }

      await assignmentAPI.update(assignmentId, updateData)
      toast.success('Assignment updated successfully!')
      navigate(`/teacher/courses/${courseId}`)
    } catch (error) {
      console.error('Error updating assignment:', error)
      toast.error('Failed to update assignment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'total_points' ? parseInt(value) || 0 : value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!course || !assignment) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Assignment not found</h3>
        <p className="text-gray-600">Unable to load assignment data.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Edit Assignment</h1>
          <p className="text-gray-600 mt-1">
            {assignment.title} • {course.title}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter assignment title"
            />
          </div>

          {/* Description */}
          <MarkdownEditor
            value={formData.description}
            onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
            label="Assignment Description"
            placeholder="Provide assignment details, instructions, and requirements using Markdown...

## Instructions
Explain what students need to do...

## Requirements
- List specific requirements
- Include any constraints
- Mention deliverables

## Resources
- [Helpful Link](https://example.com)
- Additional materials needed"
            rows={8}
          />

          {/* Due Date and Points Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Due Date</span>
                </div>
              </label>
              <input
                type="datetime-local"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="total_points" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4" />
                  <span>Total Points *</span>
                </div>
              </label>
              <input
                type="number"
                id="total_points"
                name="total_points"
                required
                min="1"
                max="1000"
                value={formData.total_points}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="100"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Status</span>
              </div>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              <option value="draft">Draft - Not visible to students</option>
              <option value="published">Published - Students can see and submit</option>
              <option value="closed">Closed - No new submissions allowed</option>
            </select>
          </div>

          {/* Assignment Info */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900 mb-2">Assignment Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">Created:</span> {new Date(assignment.created_at).toLocaleDateString()}
              </div>
              <div>
                <span className="text-gray-500">Last Updated:</span> {new Date(assignment.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
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
        </form>
      </div>
    </div>
  )
} 