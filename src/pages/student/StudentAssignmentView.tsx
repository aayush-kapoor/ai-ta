import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, FileText, Clock, CheckCircle, Upload } from 'lucide-react'
import { Assignment, Course, Submission } from '../../types'
import { assignmentAPI, courseAPI, submissionAPI } from '../../services/api'
import { fileUploadService } from '../../services/fileUpload'
import { FileUpload } from '../../components/FileUpload'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { StudentDetailedFeedback } from '../../components/StudentDetailedFeedback'
import { useAuth } from '../../contexts/AuthContext'
import { ElevenLabsWidget } from '../../components/ElevenLabsWidget'
import { API_CONFIG } from '../../config/api'

type TabType = 'details' | 'rubric' | 'submit'

export function StudentAssignmentView() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{
    path: string
    size: number
    name: string
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Check if this is CS500 course for voice agent widget
  const isCS500 = courseId === API_CONFIG.CS500_COURSE_ID

  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!assignmentId || !courseId || !user) return

      try {
        const [assignmentData, courseData, submissionData] = await Promise.all([
          assignmentAPI.getById(assignmentId),
          courseAPI.getById(courseId),
          submissionAPI.getByStudentAndAssignment(user.id, assignmentId)
        ])
        
        if (!assignmentData || assignmentData.status !== 'published') {
          toast.error('Assignment not found or not available.')
          navigate(`/student/courses/${courseId}`)
          return
        }

        setAssignment(assignmentData)
        setCourse(courseData)
        setSubmission(submissionData)
        
        // Clear uploaded file state if there's already a submission
        if (submissionData) {
          setUploadedFile(null)
          setSelectedFile(null)
        }
      } catch (error) {
        console.error('Error loading assignment data:', error)
        toast.error('Failed to load assignment data. Please try again.')
        navigate(`/student/courses/${courseId}`)
      } finally {
        setLoading(false)
      }
    }

    loadAssignmentData()
  }, [assignmentId, courseId, user, navigate])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setUploadError(null)
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setUploadedFile(null)
    setUploadError(null)
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !assignment || !user) return

    setIsUploading(true)
    setUploadError(null)

    try {
      // Upload file to storage only
      const uploadResult = await fileUploadService.uploadAssignmentFile(
        selectedFile,
        user.id,
        assignment.id
      )

      setUploadedFile({
        path: uploadResult.path,
        size: uploadResult.size,
        name: selectedFile.name
      })

      setSelectedFile(null)
      toast.success('File uploaded successfully! Click "Submit Assignment" to finalize your submission.')
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmitAssignment = async () => {
    if (!uploadedFile || !assignment || !user) return

    setIsSubmitting(true)

    try {
      // Create or update submission record with already uploaded file
      const submissionData = {
        assignment_id: assignment.id,
        student_id: user.id,
        file_path: uploadedFile.path,
        file_size: uploadedFile.size,
        original_filename: uploadedFile.name,
        status: 'submitted' as const,
        submitted_at: new Date().toISOString()
      }

      let newSubmission: Submission
      if (submission) {
        // Update existing submission
        newSubmission = await submissionAPI.update(submission.id, submissionData)
      } else {
        // Create new submission
        newSubmission = await submissionAPI.create(submissionData)
      }

      setSubmission(newSubmission)
      setUploadedFile(null)
      toast.success('Assignment submitted successfully!')
    } catch (error) {
      console.error('Submission error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit assignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!assignment || !course) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Assignment not found</h2>
        <p className="text-gray-600 mb-4">The assignment you're looking for doesn't exist or is not available.</p>
        <Link
          to={`/student/courses/${courseId}`}
          className="text-pink-600 hover:text-pink-700 font-medium"
        >
          Back to Course
        </Link>
      </div>
    )
  }

  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null
  const now = new Date()
  const isOverdue = dueDate ? dueDate < now : false
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  const tabs = [
    { id: 'details' as TabType, label: 'Assignment Details', icon: FileText },
    { id: 'rubric' as TabType, label: 'Rubric', icon: CheckCircle },
    { id: 'submit' as TabType, label: 'Submit Assignment', icon: Upload }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(`/student/courses/${courseId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
            <span>{course.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
        </div>
      </div>

      {/* Assignment Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold text-gray-900">
                {dueDate ? `${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No due date set'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : 'bg-green-100'}`}>
              <Clock className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                {isOverdue ? 'Overdue' : daysUntilDue === 0 ? 'Due Today' : `${daysUntilDue} days left`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Points</p>
              <p className="font-semibold text-gray-900">{assignment.total_points} points</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${submission ? 'bg-green-100' : 'bg-gray-100'}`}>
              <CheckCircle className={`w-5 h-5 ${submission ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submission</p>
              <p className={`font-semibold ${submission ? 'text-green-600' : 'text-gray-900'}`}>
                {submission ? 'Submitted' : 'Not submitted'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <MarkdownViewer 
                  content={assignment.description}
                  placeholder="No description provided for this assignment."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Assignment Details</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Points:</span>
                      <span className="font-medium">{assignment.total_points}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due Date:</span>
                      <span className="font-medium">{dueDate ? dueDate.toLocaleDateString() : 'No due date'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-medium">{assignment.status}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Course:</span>
                      <span className="font-medium">{course.title}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Instructor:</span>
                      <span className="font-medium">{course.teacher?.full_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rubric' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grading Rubric</h3>
              <MarkdownViewer 
                content={assignment.rubric_markdown}
                placeholder="No rubric has been provided for this assignment."
              />
            </div>
          )}

          {activeTab === 'submit' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Assignment</h3>
                
                {submission ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <div>
                          <h4 className="font-medium text-green-900">Assignment Submitted</h4>
                          <p className="text-green-700 text-sm">
                            Submitted on {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                      </div>
                      
                      {submission.original_filename && (
                        <div className="bg-white rounded-lg border border-green-200 p-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-gray-600" />
                            <div>
                              <p className="font-medium text-gray-900">{submission.original_filename}</p>
                              <p className="text-sm text-gray-600">
                                {submission.file_size ? `${(submission.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-green-700 text-sm">
                          You can resubmit by uploading a new file below. This will replace your current submission.
                        </p>
                      </div>
                    </div>

                    {/* Grade Display */}
                    {submission.grade !== null ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <CheckCircle className="w-6 h-6 text-blue-600" />
                          <div>
                            <h4 className="font-medium text-blue-900">Grade Received</h4>
                            <p className="text-blue-700 text-sm">
                              {submission.graded_at ? `Graded on ${new Date(submission.graded_at).toLocaleDateString()}` : 'Recently graded'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-blue-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-semibold text-gray-900">Your Grade:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {submission.grade} / {assignment.total_points}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Percentage:</span>
                            <span className={`text-lg font-semibold ${
                              (submission.grade / assignment.total_points) >= 0.9 ? 'text-green-600' :
                              (submission.grade / assignment.total_points) >= 0.8 ? 'text-blue-600' :
                              (submission.grade / assignment.total_points) >= 0.7 ? 'text-yellow-600' :
                              (submission.grade / assignment.total_points) >= 0.6 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {Math.round((submission.grade / assignment.total_points) * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Feedback Display - Detailed or Basic */}
                        {submission.show_detailed_feedback && submission.detailed_feedback_json ? (
                          <div className="mt-4">
                            <StudentDetailedFeedback 
                              detailedFeedback={submission.detailed_feedback_json}
                              totalPoints={assignment.total_points}
                            />
                          </div>
                        ) : submission.feedback && (
                          <div className="mt-4 bg-white rounded-lg border border-blue-200 p-4">
                            <h5 className="font-medium text-gray-900 mb-2">Instructor Feedback:</h5>
                            <p className="text-gray-700 whitespace-pre-wrap">{submission.feedback}</p>
                          </div>
                        )}
                      </div>
                    ) : submission.status === 'submitted' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-5 h-5 text-yellow-600" />
                          <p className="text-yellow-800 font-medium">Awaiting Grade</p>
                        </div>
                        <p className="text-yellow-700 text-sm mt-1">
                          Your instructor will review and grade your submission soon.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800 text-sm">
                      <strong>Instructions:</strong> Upload your assignment as a PDF file. 
                      Make sure your file is complete before submitting.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  selectedFile={selectedFile}
                  isUploading={isUploading}
                  error={uploadError}
                  disabled={isUploading || isSubmitting}
                />

                {/* Step 1: Upload File */}
                {selectedFile && !uploadedFile && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Ready to upload: <span className="font-medium">{selectedFile.name}</span>
                    </div>
                    <button
                      onClick={handleFileUpload}
                      disabled={isUploading}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload File</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Step 2: File Uploaded - Ready to Submit */}
                {uploadedFile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">File Uploaded Successfully</p>
                        <p className="text-sm text-green-700">{uploadedFile.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-green-200">
                      <div className="text-sm text-green-700">
                        File size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setUploadedFile(null)}
                          disabled={isSubmitting}
                          className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          Upload Different File
                        </button>
                        <button
                          onClick={handleSubmitAssignment}
                          disabled={isSubmitting}
                          className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-6 py-2 rounded-lg hover:from-pink-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>{submission ? 'Resubmit' : 'Submit'} Assignment</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ElevenLabs Voice Agent Widget - Only for CS500 */}
      {isCS500 && user?.role === 'student' && (
        <div className="fixed bottom-4 right-4 z-50">
          <ElevenLabsWidget 
            agentId={API_CONFIG.ELEVENLABS_AGENT_ID}
            courseId={courseId}
            courseName={course?.title}
          />
        </div>
      )}
    </div>
  )
} 