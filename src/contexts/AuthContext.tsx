import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Static users for demo purposes
const STATIC_USERS: User[] = [
  {
    id: 'teacher-1',
    email: 'teacher@university.edu',
    role: 'teacher',
    name: 'Dr. Sarah Johnson',
    created_at: new Date().toISOString()
  },
  {
    id: 'student-1',
    email: 'john.doe@student.edu',
    role: 'student',
    name: 'John Doe',
    created_at: new Date().toISOString()
  },
  {
    id: 'student-2',
    email: 'jane.smith@student.edu',
    role: 'student',
    name: 'Jane Smith',
    created_at: new Date().toISOString()
  },
  {
    id: 'student-3',
    email: 'mike.wilson@student.edu',
    role: 'student',
    name: 'Mike Wilson',
    created_at: new Date().toISOString()
  },
  {
    id: 'student-4',
    email: 'lisa.chen@student.edu',
    role: 'student',
    name: 'Lisa Chen',
    created_at: new Date().toISOString()
  }
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('lms_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple static authentication - in production, this would be handled by Supabase Auth
    const foundUser = STATIC_USERS.find(u => u.email === email)
    
    if (foundUser && password === 'password123') {
      setUser(foundUser)
      localStorage.setItem('lms_user', JSON.stringify(foundUser))
      return true
    }
    
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('lms_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}