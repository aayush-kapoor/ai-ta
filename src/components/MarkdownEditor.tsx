import React, { useState } from 'react'
import { Eye, Edit, HelpCircle } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  label?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter your content using Markdown...",
  rows = 8,
  label,
  className = '',
  required = false,
  disabled = false
}: MarkdownEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const markdownHelp = `
**Markdown Quick Reference:**

# Heading 1
## Heading 2
### Heading 3

**Bold text** or __Bold text__
*Italic text* or _Italic text_

- Bullet point 1
- Bullet point 2
  - Nested bullet point

1. Numbered list item 1
2. Numbered list item 2

[Link text](https://example.com)

\`Inline code\`

\`\`\`
Code block
\`\`\`

> Blockquote

| Table | Header |
|-------|--------|
| Cell  | Cell   |

---
Horizontal line
  `.trim()

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Markdown Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsPreviewMode(false)}
                className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                  !isPreviewMode 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                disabled={disabled}
              >
                <Edit className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewMode(true)}
                className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                  isPreviewMode 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                disabled={disabled}
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">Markdown Guide</h4>
              <pre className="text-xs text-blue-800 whitespace-pre-wrap font-mono leading-relaxed">
                {markdownHelp}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {isPreviewMode ? (
          <div className="min-h-[200px] p-4 bg-white">
            <MarkdownViewer 
              content={value} 
              placeholder="Nothing to preview. Switch to Edit mode to add content."
            />
          </div>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-4 py-3 border-0 focus:outline-none focus:ring-0 resize-y font-mono text-sm"
            disabled={disabled}
            required={required}
          />
        )}
      </div>

      {!isPreviewMode && (
        <div className="mt-2 text-xs text-gray-500">
          Supports Markdown formatting. Use the Preview tab to see how it will appear.
        </div>
      )}
    </div>
  )
} 