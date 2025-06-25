import React, { useState, useEffect } from 'react'
import { FileText, Download, AlertCircle, Loader } from 'lucide-react'
import { fileUploadService } from '../services/fileUpload'

interface PDFViewerProps {
  filePath: string
  fileName: string
  onError?: (error: string) => void
}

export function PDFViewer({ filePath, fileName, onError }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPDF = async () => {
      if (!filePath) return

      try {
        setLoading(true)
        setError(null)

        // Get signed URL for viewing the PDF
        const signedUrl = await fileUploadService.getSignedUrl(filePath, 72000) // 20 hour expiry
        setPdfUrl(signedUrl)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF'
        setError(errorMessage)
        onError?.(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadPDF()
  }, [filePath, onError])

  const handleDownload = async () => {
    if (!filePath) return

    try {
      const blob = await fileUploadService.downloadFile(filePath)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName || 'submission.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      setError('Failed to download file')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error || !pdfUrl) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg border-2 border-dashed border-red-300">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 font-medium">Failed to load PDF</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={handleDownload}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm underline"
          >
            Try downloading instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* PDF Controls */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">{fileName}</span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>

      {/* PDF Embed */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
          className="w-full h-[800px]"
          title={`PDF Viewer - ${fileName}`}
          onError={() => setError('Failed to display PDF in browser')}
        />
      </div>

      {/* Fallback message */}
      <div className="text-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
        <p>
          If the PDF doesn't display properly, try{' '}
          <button onClick={handleDownload} className="text-blue-600 hover:text-blue-700 underline">
            downloading it
          </button>{' '}
          to view in your default PDF reader.
        </p>
      </div>
    </div>
  )
} 