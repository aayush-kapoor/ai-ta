import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import Login from './components/Login'
import { TeacherDashboard } from './pages/teacher/TeacherDashboard'
import { CourseList } from './pages/teacher/CourseList'
import { CourseDetail } from './pages/teacher/CourseDetail'
import { NewAssignment } from './pages/teacher/NewAssignment'
import { EditAssignment } from './pages/teacher/EditAssignment'
import { AssignmentDetail } from './pages/teacher/AssignmentDetail'
import { SubmissionDetail } from './pages/teacher/SubmissionDetail'
import NewCourse from './pages/teacher/NewCourse'
import { EditCourse } from './pages/teacher/EditCourse'
import { StudentDashboard } from './pages/student/StudentDashboard'
import { StudentCourses } from './pages/student/StudentCourses'
import { StudentCourseDetail } from './pages/student/StudentCourseDetail'
import { StudentAssignmentView } from './pages/student/StudentAssignmentView'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'teacher' | 'student' }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace /> : <Login />} />
      
      {/* Teacher Routes */}
      <Route path="/teacher/dashboard" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <TeacherDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/teacher/courses" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <CourseList />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/teacher/courses/new" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <NewCourse />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <CourseDetail />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId/edit" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <EditCourse />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId/assignments/:assignmentId" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <AssignmentDetail />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId/assignments/new" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <NewAssignment />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId/assignments/:assignmentId/edit" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <EditAssignment />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher/courses/:courseId/assignments/:assignmentId/submissions/:submissionId" element={
        <ProtectedRoute role="teacher">
          <Layout>
            <SubmissionDetail />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Student Routes */}
      <Route path="/student/dashboard" element={
        <ProtectedRoute role="student">
          <Layout>
            <StudentDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/student/courses" element={
        <ProtectedRoute role="student">
          <Layout>
            <StudentCourses />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/student/courses/:courseId" element={
        <ProtectedRoute role="student">
          <Layout>
            <StudentCourseDetail />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/student/courses/:courseId/assignments/:assignmentId" element={
        <ProtectedRoute role="student">
          <Layout>
            <StudentAssignmentView />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #f3f4f6',
              color: '#374151',
            },
          }}
        />
      </Router>
    </AuthProvider>
  )
}

export default App