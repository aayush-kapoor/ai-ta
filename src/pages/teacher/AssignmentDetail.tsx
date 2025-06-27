import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  FileText, 
  ClipboardList, 
  Users, 
  Calendar,
  Award,
  Clock,
  Edit,
  Save,
  X
} from 'lucide-react'
import { Assignment, Course, Submission } from '../../types'
import { assignmentAPI, courseAPI, submissionAPI } from '../../services/api'

type TabType = 'info' | 'rubric' | 'submissions'

export function AssignmentDetail() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const navigate = useNavigate()
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  
  // Rubric editing state
  const [isEditingRubric, setIsEditingRubric] = useState(false)
  const [rubricContent, setRubricContent] = useState('')
  const [savingRubric, setSavingRubric] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!courseId || !assignmentId) return

      try {
        const [courseData, assignmentData, submissionsData] = await Promise.all([
          courseAPI.getById(courseId),
          assignmentAPI.getById(assignmentId),
          submissionAPI.getByAssignment(assignmentId)
        ])

        setCourse(courseData)
        setAssignment(assignmentData)
        setSubmissions(submissionsData)
        
        if (assignmentData?.rubric_markdown) {
          setRubricContent(assignmentData.rubric_markdown)
        }
      } catch (error) {
        console.error('Error loading assignment data:', error)
        toast.error('Failed to load assignment data.')
        navigate(`/teacher/courses/${courseId}`)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [courseId, assignmentId, navigate])

  const handleSaveRubric = async () => {
    if (!assignmentId) return

    setSavingRubric(true)
    try {
      const updatedAssignment = await assignmentAPI.updateRubric(assignmentId, rubricContent)
      setAssignment(updatedAssignment)
      setIsEditingRubric(false)
      toast.success('Rubric saved successfully!')
    } catch (error) {
      console.error('Error saving rubric:', error)
      toast.error('Failed to save rubric. Please try again.')
    } finally {
      setSavingRubric(false)
    }
  }

  const handleCancelEdit = () => {
    setRubricContent(assignment?.rubric_markdown || '')
    setIsEditingRubric(false)
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

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'graded': return 'bg-green-100 text-green-700'
      case 'submitted': return 'bg-blue-100 text-blue-700'
      case 'draft': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const tabs = [
    { id: 'info', label: 'Assignment Info', icon: FileText },
    { id: 'rubric', label: 'Rubric', icon: ClipboardList },
    { id: 'submissions', label: 'Submissions', icon: Users, count: submissions.length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!assignment || !course) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Assignment not found</h3>
        <p className="text-gray-600">Unable to load assignment data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/teacher/courses/${courseId}`)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Course</span>
          </button>
        </div>
        <Link
          to={`/teacher/courses/${courseId}/assignments/${assignmentId}/edit`}
          className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Edit className="w-4 h-4" />
          <span>Edit Assignment</span>
        </Link>
      </div>

      {/* Assignment Header */}
      <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                {assignment.status}
              </span>
            </div>
            <p className="text-gray-600">{course.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Due Date</p>
              <p className="font-medium text-gray-900">{formatDate(assignment.due_date)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Total Points</p>
              <p className="font-medium text-gray-900">{assignment.total_points}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Submissions</p>
              <p className="font-medium text-gray-900">{submissions.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium text-gray-900">{new Date(assignment.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-pink-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      isActive ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Assignment Description</h3>
                {assignment.description ? (
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No description provided.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rubric' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Grading Rubric</h3>
                {!isEditingRubric && (
                  <button
                    onClick={() => setIsEditingRubric(true)}
                    className="flex items-center space-x-2 px-3 py-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Rubric</span>
                  </button>
                )}
              </div>

              {isEditingRubric ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rubric (Markdown Format)
                    </label>
                    <textarea
                      value={rubricContent}
                      onChange={(e) => setRubricContent(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono text-sm"
                      placeholder="## Grading Criteria

### Code Quality (30 points)
- Clean, readable code structure
- Proper variable naming
- Appropriate comments

### Functionality (50 points)
- Program runs without errors
- Meets all requirements
- Handles edge cases

### Documentation (20 points)
- Clear README file
- Inline code comments
- Usage instructions"
                    />
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSaveRubric}
                      disabled={savingRubric}
                      className="flex items-center space-x-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingRubric ? 'Saving...' : 'Save Rubric'}</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {assignment.rubric_markdown ? (
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 p-4 rounded-lg">
                        {assignment.rubric_markdown}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No rubric defined</h4>
                      <p className="text-gray-600 mb-4">Create a grading rubric to help students understand expectations.</p>
                      <button
                        onClick={() => setIsEditingRubric(true)}
                        className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                      >
                        Create Rubric
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Student Submissions</h3>
              
              {submissions.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h4>
                  <p className="text-gray-600">Students haven't submitted their work for this assignment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-pink-200 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/teacher/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 group-hover:text-pink-600 transition-colors">
                              {submission.student?.full_name || 'Unknown Student'}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubmissionStatusColor(submission.status)}`}>
                              {submission.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{submission.student?.email}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            {submission.submitted_at && (
                              <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
                            )}
                            {submission.grade !== null && (
                              <span>Grade: {submission.grade}/{assignment.total_points}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {submission.file_url && (
                            <a
                              href={submission.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View File
                            </a>
                          )}
                          <Link
                            to={`/teacher/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}`}
                            className="px-3 py-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {submission.grade !== null ? 'View Grade' : 'Grade'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 