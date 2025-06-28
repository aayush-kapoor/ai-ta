import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  content: string | null | undefined
  className?: string
  placeholder?: string
}

export function MarkdownViewer({ content, className = '', placeholder = 'No content provided.' }: MarkdownViewerProps) {
  if (!content || content.trim() === '') {
    return (
      <div className={`text-gray-500 italic ${className}`}>
        {placeholder}
      </div>
    )
  }

  return (
    <div className={`prose prose-gray max-w-none ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-6" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold text-gray-900 mb-2 mt-3" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-sm font-semibold text-gray-900 mb-1 mt-2" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-sm font-semibold text-gray-700 mb-1 mt-2" {...props} />
          ),
          
          // Customize paragraph styles
          p: ({ node, ...props }) => (
            <p className="text-gray-700 mb-4 leading-relaxed" {...props} />
          ),
          
          // Customize list styles
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-6 mb-4 text-gray-700" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-6 mb-4 text-gray-700" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="mb-1" {...props} />
          ),
          
          // Customize blockquote styles
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-blue-200 pl-4 py-2 mb-4 bg-blue-50 text-gray-700 italic" {...props} />
          ),
          
          // Customize code styles
          code: ({ node, inline, ...props }) => 
            inline ? (
              <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props} />
            ) : (
              <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
            ),
          
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg mb-4 overflow-x-auto" {...props} />
          ),
          
          // Customize table styles
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-50" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200" {...props} />
          ),
          
          // Customize link styles
          a: ({ node, ...props }) => (
            <a className="text-blue-600 hover:text-blue-800 underline" {...props} />
          ),
          
          // Customize horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-gray-300" {...props} />
          ),
          
          // Customize strong/emphasis
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-gray-700" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 