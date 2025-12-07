'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, Download, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface VendorDocumentsUploadProps {
  vendorId: string
  onUploadComplete?: () => void
}

interface Document {
  id: string
  name: string
  type: string
  version: number
  uploadedAt: string
  uploadedBy: string
  size: number
  downloadUrl?: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

const ACCEPTED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function VendorDocumentsUpload({ vendorId, onUploadComplete }: VendorDocumentsUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing documents
  useEffect(() => {
    fetchDocuments()
  }, [vendorId])

  async function fetchDocuments() {
    try {
      const response = await fetch(`/api/demo/vendor/${vendorId}/documents`)
      if (response.ok) {
        const payload = await response.json()
        setDocuments(payload.documents || [])
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    }
  }

  function validateFile(file: File): string | null {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_FILE_TYPES.includes(extension)) {
      return `File type not accepted. Accepted types: ${ACCEPTED_FILE_TYPES.join(', ')}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
    }
    return null
  }

  function handleFiles(files: FileList | null) {
    if (!files) return

    const validFiles: UploadingFile[] = []
    Array.from(files).forEach((file) => {
      const error = validateFile(file)
      if (error) {
        alert(error)
        return
      }
      validFiles.push({
        file,
        progress: 0,
        status: 'uploading',
      })
    })

    if (validFiles.length > 0) {
      setUploadingFiles([...uploadingFiles, ...validFiles])
      validFiles.forEach((uploadingFile) => {
        uploadFile(uploadingFile.file)
      })
    }
  }

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vendorId', vendorId)
    formData.append('type', 'general')

    try {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.file === file ? { ...uf, progress } : uf
            )
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.file === file ? { ...uf, status: 'success', progress: 100 } : uf
            )
          )
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((uf) => uf.file !== file))
            fetchDocuments()
            onUploadComplete?.()
          }, 1000)
        } else {
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.file === file
                ? { ...uf, status: 'error', error: 'Upload failed' }
                : uf
            )
          )
        }
      })

      xhr.addEventListener('error', () => {
        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.file === file
              ? { ...uf, status: 'error', error: 'Network error' }
              : uf
          )
        )
      })

      xhr.open('POST', '/api/demo/vendor/documents/upload')
      xhr.send(formData)
    } catch (err) {
      setUploadingFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? { ...uf, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
            : uf
        )
      )
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const response = await fetch(`/api/demo/vendor/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete document')
      await fetchDocuments()
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDownload(documentId: string, downloadUrl?: string) {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank')
      return
    }

    try {
      const response = await fetch(`/api/demo/vendor/documents/${documentId}/download`)
      if (!response.ok) throw new Error('Failed to download document')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documents.find((d) => d.id === documentId)?.name || 'document'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert(`Failed to download: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Upload and manage vendor documents with versioning support
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Drag and drop files here or click to browse. Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop files here, or click to browse
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(',')}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Uploading Files */}
          {uploadingFiles.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium">Uploading Files</h3>
              {uploadingFiles.map((uploadingFile, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{uploadingFile.file.name}</span>
                          {uploadingFile.status === 'success' && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {uploadingFile.status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        {uploadingFile.status === 'error' && (
                          <span className="text-xs text-destructive">
                            {uploadingFile.error}
                          </span>
                        )}
                      </div>
                      {uploadingFile.status === 'uploading' && (
                        <Progress value={uploadingFile.progress} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Documents</CardTitle>
          <CardDescription>
            All uploaded documents for this vendor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((document) => (
                <Card key={document.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{document.name}</span>
                            {document.version > 1 && (
                              <Badge variant="outline">v{document.version}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Type: {document.type} • {formatFileSize(document.size)} • Uploaded{' '}
                            {new Date(document.uploadedAt).toLocaleDateString()} by{' '}
                            {document.uploadedBy}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document.id, document.downloadUrl)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(document.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No documents uploaded yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

