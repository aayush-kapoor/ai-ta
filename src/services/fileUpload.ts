import { supabase } from '../lib/supabase'

export interface UploadResult {
  path: string
  publicUrl: string
  size: number
}

export const fileUploadService = {
  /**
   * Upload a file to Supabase storage
   */
  async uploadAssignmentFile(
    file: File,
    studentId: string,
    assignmentId: string
  ): Promise<UploadResult> {
    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed')
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 10MB')
    }

    // Create unique file path: studentId/assignmentId/filename
    const timestamp = Date.now()
    const fileName = `${timestamp}_${file.name}`
    const filePath = `${studentId}/${assignmentId}/${fileName}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('assignment-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get public URL (even though bucket is private, we'll handle access via API)
    const { data: urlData } = supabase.storage
      .from('assignment-files')
      .getPublicUrl(data.path)

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
      size: file.size
    }
  },

  /**
   * Delete a file from Supabase storage
   */
  async deleteAssignmentFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('assignment-files')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  },

  /**
   * Get signed URL for downloading a file (for teachers to view submissions)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from('assignment-files')
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Signed URL error:', error)
      throw new Error(`Failed to get download URL: ${error.message}`)
    }

    return data.signedUrl
  },

  /**
   * Download file as blob (for viewing in browser)
   */
  async downloadFile(filePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from('assignment-files')
      .download(filePath)

    if (error) {
      console.error('Download error:', error)
      throw new Error(`Failed to download file: ${error.message}`)
    }

    return data
  }
} 