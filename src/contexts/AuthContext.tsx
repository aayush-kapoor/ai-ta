import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, AuthError } from '@supabase/supabase-js'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { User as AppUser } from '../types'

interface AuthStore {
  user: AppUser | null
  session: Session | null
  isAuthenticated: boolean
  setUser: (user: AppUser | null) => void
  setSession: (session: Session | null) => void
  clearAuth: () => void
}

// Zustand store with persistence
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => set({ session }),
      clearAuth: () => set({ user: null, session: null, isAuthenticated: false }),
    }),
    {
      name: 'ai-ta-auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  logout: () => Promise<void>
  signUp: (email: string, password: string, userData: { full_name: string; role: 'teacher' | 'student' }) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const { user, session, setUser, setSession, clearAuth } = useAuthStore()

  const fetchUserProfile = async (userId: string): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      return null
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      if (data.session && data.user) {
        setSession(data.session)
        
        // Fetch user profile
        const userProfile = await fetchUserProfile(data.user.id)
        if (userProfile) {
          setUser(userProfile)
        }
      }

      return { error: null }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clearAuth()
  }

  const signUp = async (email: string, password: string, userData: { full_name: string; role: 'teacher' | 'student' }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { error }
  }

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we have a stored user and it's valid
        if (user && user.id) {
          setLoading(false)
          return
        }

        // Get current session from Supabase
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setSession(session)
          
          // Fetch fresh user profile
          const userProfile = await fetchUserProfile(session.user.id)
          if (userProfile) {
            setUser(userProfile)
          } else {
            clearAuth()
          }
        } else {
          clearAuth()
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        clearAuth()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, []) // Empty dependency array - only run once on mount

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    logout: signOut,
    signUp,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}