import React, { useEffect } from 'react'

interface ElevenLabsWidgetProps {
  agentId: string
  courseId?: string
  courseName?: string
}

export function ElevenLabsWidget({ agentId, courseId, courseName }: ElevenLabsWidgetProps) {
  useEffect(() => {
    // Load ElevenLabs script if not already loaded
    if (!document.querySelector('script[src*="convai-widget-embed"]')) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
      script.async = true
      script.type = 'text/javascript'
      document.head.appendChild(script)
    }
  }, [])

  return (
    <div className="elevenlabs-widget-container">
      <elevenlabs-convai agent-id={agentId}></elevenlabs-convai>
    </div>
  )
} 