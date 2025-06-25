import React, { useState, useCallback } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  selectedFile?: File | null
  isUploading?: boolean
  error?: string | null
  disabled?: boolean
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  isUploading = false,
  error = null,
  disabled = false
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      if (file.type === 'application/pdf') {
        onFileSelect(file)
      } else {
        // Could set an error state here if needed
        alert('Please select a PDF file')
      }
    }
  }, [disabled, onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === 'application/pdf') {
        onFileSelect(file)
      } else {
        alert('Please select a PDF file')
      }
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [onFileSelect])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (selectedFile) {
    return (
      <div className="border-2 border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          
          {!disabled && (
            <button
              onClick={onFileRemove}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isUploading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
        
        {isUploading && (
          <div className="mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 text-sm">Uploading file...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-pink-400 bg-pink-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
          disabled={disabled}
        />
        
        <div className="space-y-4">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
            disabled ? 'bg-gray-100' : 'bg-pink-100'
          }`}>
            <Upload className={`w-6 h-6 ${disabled ? 'text-gray-400' : 'text-pink-600'}`} />
          </div>
          
          <div>
            <p className={`text-lg font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
              Drop your PDF file here
            </p>
            <p className={`text-sm mt-1 ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
              or{' '}
              <label
                htmlFor="file-input"
                className={`font-medium ${
                  disabled 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-pink-600 hover:text-pink-700 cursor-pointer'
                }`}
              >
                browse files
              </label>
            </p>
          </div>
          
          <div className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>PDF files only, up to 10MB</p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}