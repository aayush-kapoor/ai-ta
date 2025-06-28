import React, { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, X, Minimize2, AlertCircle, CheckCircle, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { chatAPI, chatThreadAPI } from '../services/api'
import { agentAPI } from '../services/agentAPI'
import { ChatMessage, ChatThread } from '../types'

export function ChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentStatus, setAgentStatus] = useState<'ready' | 'processing' | 'error'>('ready')
  const [showThreadList, setShowThreadList] = useState(true)
  const [deletingThread, setDeletingThread] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load threads when chat opens
  useEffect(() => {
    if (isOpen && user) {
      loadThreads()
      checkAgentHealth()
    }
  }, [isOpen, user])

  // Load messages when thread changes
  useEffect(() => {
    if (currentThread) {
      loadMessages(currentThread.id)
      setShowThreadList(false)
    }
  }, [currentThread])

  // Only show for teachers
  if (!user || user.role !== 'teacher') {
    return null
  }

  const loadThreads = async () => {
    try {
      const userThreads = await chatThreadAPI.getByUser(user!.id)
      setThreads(userThreads)
      
      // If no threads, start with thread list visible
      if (userThreads.length === 0) {
        setShowThreadList(true)
        setCurrentThread(null)
      } else if (!currentThread) {
        // Auto-select the most recent thread
        setCurrentThread(userThreads[0])
      }
    } catch (error) {
      console.error('Error loading threads:', error)
    }
  }

  const loadMessages = async (threadId: string) => {
    try {
      const threadMessages = await chatAPI.getByThread(threadId)
      setMessages(threadMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const checkAgentHealth = async () => {
    const isHealthy = await agentAPI.checkBackendHealth()
    setAgentStatus(isHealthy ? 'ready' : 'error')
  }

  const createNewThread = async () => {
    if (!user) return

    try {
      const newThread = await chatThreadAPI.create({
        user_id: user.id,
        title: 'New Chat'
      })
      
      setThreads(prev => [newThread, ...prev])
      setCurrentThread(newThread)
      setMessages([])
      setShowThreadList(false)
    } catch (error) {
      console.error('Error creating thread:', error)
    }
  }

  const deleteThread = async (threadId: string) => {
    if (!window.confirm('Are you sure you want to delete this chat thread? This action cannot be undone.')) {
      return
    }

    setDeletingThread(threadId)
    try {
      await chatThreadAPI.delete(threadId)
      setThreads(prev => prev.filter(t => t.id !== threadId))
      
      // If deleting current thread, go back to thread list or select another thread
      if (currentThread?.id === threadId) {
        const remainingThreads = threads.filter(t => t.id !== threadId)
        if (remainingThreads.length > 0) {
          setCurrentThread(remainingThreads[0])
        } else {
          setCurrentThread(null)
          setShowThreadList(true)
        }
      }
    } catch (error) {
      console.error('Error deleting thread:', error)
    } finally {
      setDeletingThread(null)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || loading || !user) return

    let threadToUse = currentThread

    // If no current thread, create one
    if (!threadToUse) {
      try {
        threadToUse = await chatThreadAPI.create({
          user_id: user.id,
          title: 'New Chat'
        })
        setCurrentThread(threadToUse)
        setThreads(prev => [threadToUse!, ...prev])
      } catch (error) {
        console.error('Error creating thread:', error)
        return
      }
    }

    setLoading(true)
    setAgentStatus('processing')
    
    // Reset error state when user tries again
    if (agentStatus === 'error') {
      console.log('🔄 User retrying after error, resetting status...')
    }
    
    try {
      const messageData = {
        thread_id: threadToUse!.id,
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

      // Send message to Mylo agent with thread context
      let agentResponse = await agentAPI.sendMessage(currentMessage, user.id, threadToUse!.id)
      
      // If the main endpoint failed, try the test endpoint as fallback for debugging
      if (!agentResponse.success && agentResponse.action_taken === "error") {
        console.log('🔄 Main endpoint failed, trying test endpoint as fallback...')
        agentResponse = await agentAPI.sendTestMessage(currentMessage, user.id, threadToUse!.id)
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

              // Auto-generate thread title if this is the first message
        if (messages.length === 0 && threadToUse!.title === 'New Chat') {
          try {
            const generatedTitle = await agentAPI.generateThreadTitle(currentMessage, agentResponse.response)
            
            const updatedThread = await chatThreadAPI.updateTitle(threadToUse!.id, generatedTitle)
            setCurrentThread(updatedThread)
            setThreads(prev => prev.map(t => t.id === threadToUse!.id ? updatedThread : t))
          } catch (error) {
            console.error('Error updating thread title:', error)
            // Fallback: use first few words if title generation fails
            try {
              const fallbackTitle = currentMessage.split(' ').slice(0, 3).join(' ')
              const updatedThread = await chatThreadAPI.updateTitle(threadToUse!.id, fallbackTitle)
              setCurrentThread(updatedThread)
              setThreads(prev => prev.map(t => t.id === threadToUse!.id ? updatedThread : t))
            } catch (fallbackError) {
              console.error('Error with fallback title update:', fallbackError)
            }
          }
        }

      // Update threads list to reflect new last message time
      await loadThreads()

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
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
              {/* Thread List Toggle */}
              <button
                onClick={() => setShowThreadList(!showThreadList)}
                className="hover:bg-white hover:bg-opacity-20 p-1 rounded"
                title={showThreadList ? 'Hide threads' : 'Show threads'}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
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
              {/* Thread List */}
              {showThreadList && (
                <div className="border-b border-gray-200 bg-gray-50 p-4 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Chat Threads</h4>
                    <button
                      onClick={createNewThread}
                      className="flex items-center space-x-1 text-xs bg-pink-500 text-white px-2 py-1 rounded hover:bg-pink-600 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>
                  
                  {threads.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs">No chat threads yet</p>
                      <button
                        onClick={createNewThread}
                        className="text-xs text-pink-600 hover:text-pink-700 mt-1"
                      >
                        Start your first conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {threads.map((thread) => (
                        <div
                          key={thread.id}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                            currentThread?.id === thread.id
                              ? 'bg-pink-100 border border-pink-200'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => setCurrentThread(thread)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {thread.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {thread.message_count} messages • {formatDate(thread.updated_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteThread(thread.id)
                            }}
                            disabled={deletingThread === thread.id}
                            className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!currentThread ? (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Hi! I'm Mylo, your AI teaching assistant.</p>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      <strong>Try asking me:</strong><br/>
                      • "Create assignment 'Quiz 1' for CS101"<br/>
                      • "How many students submitted homework 1?"<br/>
                      • "Help me understand your features"
                    </p>
                    <button
                      onClick={createNewThread}
                      className="mt-3 text-sm bg-pink-500 text-white px-3 py-1 rounded hover:bg-pink-600 transition-colors"
                    >
                      Start New Chat
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Start a conversation in this thread</p>
                    <p className="text-xs text-gray-400 mt-2">I'll remember our conversation context!</p>
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
              {currentThread && (
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
              )}
            </>
          )}
        </div>
      )}
    </>
  )
} 