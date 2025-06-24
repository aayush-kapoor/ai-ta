import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import Login from './components/Login'
import { TeacherDashboard } from './pages/teacher/TeacherDashboard'
import { CourseList } from './pages/teacher/CourseList'
import NewCourse from './pages/teacher/NewCourse'
import { StudentDashboard } from './pages/student/StudentDashboard'
import { StudentCourses } from './pages/student/StudentCourses'

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