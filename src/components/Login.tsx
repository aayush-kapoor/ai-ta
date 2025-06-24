import React, { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { BookOpen, Lock, Mail, AlertCircle } from 'lucide-react'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const success = await login(email, password)
      if (!success) {
        const errorMessage = 'Invalid email or password'
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        toast.success('Successfully logged in!')
      }
    } catch (err) {
      const errorMessage = 'An error occurred during login'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const demoAccounts = [
    { email: 'teacher@university.edu', role: 'Teacher', name: 'Dr. Sarah Johnson' },
    { email: 'john.doe@student.edu', role: 'Student', name: 'John Doe' },
    { email: 'jane.smith@student.edu', role: 'Student', name: 'Jane Smith' },
    { email: 'mike.wilson@student.edu', role: 'Student', name: 'Mike Wilson' },
    { email: 'lisa.chen@student.edu', role: 'Student', name: 'Lisa Chen' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-blue-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold bg-gradient-to-r from-pink-600 to-blue-600 bg-clip-text text-transparent">
            AI Teaching Assistant
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 border border-pink-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Demo Accounts</h3>
            <div className="space-y-2">
              {demoAccounts.map((account, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('password123')
                  }}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{account.name}</div>
                      <div className="text-xs text-gray-500">{account.email}</div>
                    </div>
                    <div className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">
                      {account.role}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500 text-center">
              All accounts use password: <code className="bg-gray-200 px-1 rounded">password123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}