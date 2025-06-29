/**
 * API Configuration for AI Teaching Assistant
 * Centralized configuration for all API endpoints
 */

// Backend API URL - can be overridden by environment variable
export const API_CONFIG = {
  BACKEND_URL: import.meta.env.VITE_API_URL || 'https://mylo-api.onrender.com',
  
  // Course and Agent Configuration
  CS500_COURSE_ID: import.meta.env.VITE_CS500_COURSE_ID,
  ELEVENLABS_AGENT_ID: import.meta.env.VITE_ELEVENLABS_AGENT_ID,
  
  // Endpoints
  ENDPOINTS: {
    AGENT_PROCESS: '/api/agent/process',
    AGENT_TEST: '/api/agent/test',
    DEBUG_CONFIG: '/debug/config',
    DEBUG_TEST_USER: '/debug/test-user'
  }
} as const

// Helper function to build full URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BACKEND_URL}${endpoint}`
} 