import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Upload, File, X, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  selectedFile: File | null
  accept?: string
  maxSize?: number
  disabled?: boolean
}

export function FileUpload({ 
  onFileSelect, 
  onFileRemove, 
  selectedFile, 
  accept = '.pdf,.doc,.docx,.txt,.py,.java,.cpp,.js,.html,.css',
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false
}: FileUploadProps) {
  const [error, setError] = useState<string>('')

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError('')
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      let errorMessage = 'File upload failed'
      
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        errorMessage = `File size must be less than ${maxSize / (1024 * 1024)}MB`
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        errorMessage = 'File type not supported'
      }
      
      setError(errorMessage)
      toast.error(errorMessage)
      return
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
      toast.success('File selected successfully!')
    }
  }, [onFileSelect, maxSize])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, ext) => {
      acc[ext.trim()] = []
      return acc
    }, {} as Record<string, string[]>),
    maxSize,
    multiple: false,
    disabled
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileRemove = () => {
    onFileRemove()
    toast.success('File removed successfully!')
  }

  return (
    <div className="space-y-4">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-pink-500 bg-pink-50'
              : disabled
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${
            disabled ? 'text-gray-400' : 'text-gray-500'
          }`} />
          
          {isDragActive ? (
            <p className="text-pink-600 font-medium">Drop the file here...</p>
          ) : (
            <div className="space-y-2">
              <p className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                {disabled ? 'File upload disabled' : 'Drag & drop your file here, or click to browse'}
              </p>
              <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                Supported formats: {accept.replace(/\./g, '').toUpperCase()}
              </p>
              <p className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-400'}`}>
                Maximum file size: {formatFileSize(maxSize)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-green-900">{selectedFile.name}</p>
                <p className="text-sm text-green-700">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            {!disabled && (
              <button
                onClick={handleFileRemove}
                className="text-red-600 hover:text-red-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
    </div>
  )
}