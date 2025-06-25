import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, User, Calendar, Clock, CheckCircle, FileText } from 'lucide-react'
import { Submission, Assignment, Course } from '../../types'
import { submissionAPI, assignmentAPI, courseAPI } from '../../services/api'
import { PDFViewer } from '../../components/PDFViewer'
import { GradingPanel } from '../../components/GradingPanel'
import { useAuth } from '../../contexts/AuthContext'

export function SubmissionDetail() {
  const { courseId, assignmentId, submissionId } = useParams<{
    courseId: string
    assignmentId: string
    submissionId: string
  }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)

  useEffect(() => {
    const loadSubmissionData = async () => {
      if (!submissionId || !assignmentId || !courseId || !user) return

      try {
        const [submissionData, assignmentData, courseData] = await Promise.all([
          submissionAPI.getById(submissionId),
          assignmentAPI.getById(assignmentId),
          courseAPI.getById(courseId)
        ])

        // Verify teacher has access to this course
        if (courseData?.teacher_id !== user.id) {
          toast.error('You do not have access to this course.')
          navigate('/teacher/courses')
          return
        }

        setSubmission(submissionData)
        setAssignment(assignmentData)
        setCourse(courseData)
      } catch (error) {
        console.error('Error loading submission data:', error)
        toast.error('Failed to load submission data. Please try again.')
        navigate(`/teacher/courses/${courseId}/assignments/${assignmentId}`)
      } finally {
        setLoading(false)
      }
    }

    loadSubmissionData()
  }, [submissionId, assignmentId, courseId, user, navigate])

  const handleGradeSubmission = async (grade: number, feedback: string) => {
    if (!submission) return

    setGrading(true)
    try {
      const updatedSubmission = await submissionAPI.grade(submission.id, {
        grade,
        feedback
      })
      setSubmission(updatedSubmission)
      toast.success('Grade submitted successfully!')
    } catch (error) {
      console.error('Error grading submission:', error)
      toast.error('Failed to submit grade. Please try again.')
      throw error
    } finally {
      setGrading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!submission || !assignment || !course) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Submission not found</h2>
        <p className="text-gray-600 mb-4">The submission you're looking for doesn't exist or you don't have access to it.</p>
        <Link
          to={`/teacher/courses/${courseId}/assignments/${assignmentId}`}
          className="text-pink-600 hover:text-pink-700 font-medium"
        >
          Back to Assignment
        </Link>
      </div>
    )
  }

  const submissionDate = submission.submitted_at ? new Date(submission.submitted_at) : null
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null
  const isLate = submissionDate && dueDate && submissionDate > dueDate

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(`/teacher/courses/${courseId}/assignments/${assignmentId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
            <span>{course.course_code}</span>
            <span>•</span>
            <span>{assignment.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {submission.student?.full_name}'s Submission
          </h1>
        </div>
      </div>

      {/* Submission Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Student</p>
              <p className="font-semibold text-gray-900">{submission.student?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="font-semibold text-gray-900">
                {submissionDate ? submissionDate.toLocaleDateString() : 'Not submitted'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isLate ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Clock className={`w-5 h-5 ${isLate ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className={`font-semibold ${isLate ? 'text-red-600' : 'text-gray-900'}`}>
                {isLate ? 'Late Submission' : 'On Time'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${submission.grade !== null ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <CheckCircle className={`w-5 h-5 ${submission.grade !== null ? 'text-purple-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Grade</p>
              <p className="font-semibold text-gray-900">
                {submission.grade !== null ? `${submission.grade}/${assignment.total_points}` : 'Not graded'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* PDF Viewer */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Submission File</h3>
            </div>

            {submission.file_path && submission.original_filename ? (
              <PDFViewer
                filePath={submission.file_path}
                fileName={submission.original_filename}
                onError={(error) => toast.error(`PDF Error: ${error}`)}
              />
            ) : submission.file_url ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    This submission uses the legacy file storage system.
                  </p>
                </div>
                <a
                  href={submission.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Submission File</span>
                </a>
              </div>
            ) : submission.content ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Text Submission:</h4>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700">{submission.content}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No submission file found</p>
              </div>
            )}
          </div>
        </div>

        {/* Grading Panel */}
        <div className="xl:col-span-1">
          <GradingPanel
            submission={submission}
            maxPoints={assignment.total_points}
            onGradeSubmit={handleGradeSubmission}
            isSubmitting={grading}
          />
        </div>
      </div>
    </div>
  )
} 