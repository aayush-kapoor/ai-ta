import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User as AppUser } from '../types'

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
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Cache to prevent repeated profile fetches
  const userProfileCache = useRef<{ [userId: string]: AppUser }>({})
  const fetchingUserRef = useRef<string | null>(null)

  const fetchUserProfile = async (userId: string) => {
    // Check if we already have this user cached
    if (userProfileCache.current[userId]) {
      console.log('Using cached user profile for:', userId)
      setUser(userProfileCache.current[userId])
      setLoading(false)
      return
    }

    // Check if we're already fetching this user
    if (fetchingUserRef.current === userId) {
      console.log('Already fetching profile for user:', userId)
      return
    }

    fetchingUserRef.current = userId

    try {
      console.log('Fetching user profile for:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        // If query fails, create a basic user object from auth user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const basicUser: AppUser = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.email?.split('@')[0] || 'User',
            role: 'teacher', // Default to teacher for now
            created_at: authUser.created_at,
            updated_at: authUser.updated_at || authUser.created_at
          }
          // Cache the user
          userProfileCache.current[userId] = basicUser
          setUser(basicUser)
        } else {
          setUser(null)
        }
      } else {
        console.log('User profile found:', data)
        // Cache the user profile
        userProfileCache.current[userId] = data
        setUser(data)
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      setUser(null)
    } finally {
      setLoading(false)
      fetchingUserRef.current = null
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        setSession(session)
        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes - ONLY for actual sign-in/sign-out, not token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('Auth state change event:', event)
      
      // Only handle explicit sign-in and sign-out events
      if (event === 'SIGNED_IN' && session?.user) {
        setSession(session)
        // Only fetch profile if we don't already have it cached
        if (!userProfileCache.current[session.user.id]) {
          await fetchUserProfile(session.user.id)
        } else {
          console.log('Using cached profile for signed in user')
          setUser(userProfileCache.current[session.user.id])
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
        // Clear the cache on sign out
        userProfileCache.current = {}
        fetchingUserRef.current = null
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Remove dependencies to prevent infinite loops

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    // Clear the cache on sign out
    userProfileCache.current = {}
    fetchingUserRef.current = null
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