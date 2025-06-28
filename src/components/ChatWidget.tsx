import React, { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, X, Minimize2, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { chatAPI } from '../services/api'
import { agentAPI } from '../services/agentAPI'
import { ChatMessage } from '../types'

export function ChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentStatus, setAgentStatus] = useState<'ready' | 'processing' | 'error'>('ready')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load existing messages when chat opens
  useEffect(() => {
    if (isOpen && user) {
      loadMessages()
      checkAgentHealth()
    }
  }, [isOpen, user])

  // Only show for teachers
  if (!user || user.role !== 'teacher') {
    return null
  }

  const loadMessages = async () => {
    try {
      const userMessages = await chatAPI.getByUser(user!.id)
      setMessages(userMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const checkAgentHealth = async () => {
    const isHealthy = await agentAPI.checkBackendHealth()
    setAgentStatus(isHealthy ? 'ready' : 'error')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || loading || !user) return

    setLoading(true)
    setAgentStatus('processing')
    
    // Reset error state when user tries again
    if (agentStatus === 'error') {
      console.log('🔄 User retrying after error, resetting status...')
    }
    
    try {
      const messageData = {
        user_id: user.id,
        message: newMessage.trim()
      }

      // Create message without response first (for immediate UI feedback)
      const savedMessage = await chatAPI.create({
        ...messageData,
        response: "" // No response initially
      })
      
      // Add user message immediately to UI
      setMessages(prev => [...prev, savedMessage])
      const currentMessage = newMessage.trim()
      setNewMessage('')

      // Send message to Mylo agent
      let agentResponse = await agentAPI.sendMessage(currentMessage, user.id)
      
      // If the main endpoint failed, try the test endpoint as fallback for debugging
      if (!agentResponse.success && agentResponse.action_taken === "error") {
        console.log('🔄 Main endpoint failed, trying test endpoint as fallback...')
        agentResponse = await agentAPI.sendTestMessage(currentMessage, user.id)
      }
      
      // Update the status based on agent response
      setAgentStatus(agentResponse.success ? 'ready' : 'error')

      // Update the database with the agent's response
      const updatedMessage = await chatAPI.updateResponse(
        savedMessage.id, 
        agentResponse.response
      )
      
      // Update UI with the agent's response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === savedMessage.id ? updatedMessage : msg
        )
      )

      // If the agent performed an action, show additional feedback
      if (agentResponse.success && agentResponse.action_taken && agentResponse.action_taken !== 'error') {
        console.log(`✅ Agent successfully executed: ${agentResponse.action_taken}`)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      setAgentStatus('error')
      
      // Try to update the message with an error response
      try {
        const errorMessage = "I encountered an error processing your request. Please try again."
        await chatAPI.updateResponse(messages[messages.length - 1]?.id || '', errorMessage)
        
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 
              ? { ...msg, response: errorMessage } 
              : msg
          )
        )
      } catch (updateError) {
        console.error('Error updating error message:', updateError)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getStatusIcon = () => {
    switch (agentStatus) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (agentStatus) {
      case 'ready':
        return 'Mylo AI - Ready'
      case 'processing':
        return 'Mylo AI - Processing...'
      case 'error':
        return 'Mylo AI - Try Again'
    }
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group"
          >
            <MessageCircle className="w-6 h-6" />
            <div className="absolute -top-10 right-0 bg-gray-800 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              Mylo AI Assistant
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <h3 className="font-semibold">{getStatusText()}</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white hover:bg-opacity-20 p-1 rounded"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white hover:bg-opacity-20 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Hi! I'm Mylo, your AI teaching assistant.</p>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      <strong>Try asking me:</strong><br/>
                      • "Hello, what can you do?"<br/>
                      • "Create assignment 'Quiz 1' for CS101"<br/>
                      • "How many students submitted homework 1?"<br/>
                      • "Help me understand your features"
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="space-y-3">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-lg max-w-xs">
                          <p className="text-sm">{message.message}</p>
                          <p className="text-xs opacity-75 mt-1">{formatTime(message.created_at)}</p>
                        </div>
                      </div>

                      {/* AI Response */}
                      {message.response && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg max-w-xs">
                            <p className="text-sm">{message.response}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatTime(message.updated_at || message.created_at)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={agentStatus === 'error' ? 'Try again...' : 'Type your message...'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !newMessage.trim()}
                    className="bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 disabled:from-gray-300 disabled:to-gray-300 text-white p-2 rounded-lg transition-all duration-200"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {agentStatus === 'error' && (
                  <p className="text-xs text-orange-500 mt-1">
                    Last message had an issue, but you can still try again.
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
} 