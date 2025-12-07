'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type CredentialType = 'board' | 'license' | 'certification' | 'privilege'

type RenewalRequestFormProps = {
  credentialId?: string
  credentialName?: string
  credentialType?: CredentialType
  onSubmit?: (data: RenewalRequestData) => Promise<void>
  onCancel?: () => void
}

export type RenewalRequestData = {
  credentialId: string
  credentialType: CredentialType
  reason: string
  documents: File[]
  additionalInfo?: string
}

type UploadedFile = {
  file: File
  id: string
  progress: number
  status: 'uploading' | 'success' | 'error'
}

const REQUIRED_FIELDS_BY_TYPE: Record<CredentialType, string[]> = {
  board: ['reason', 'documents'],
  license: ['reason', 'documents'],
  certification: ['reason', 'documents'],
  privilege: ['reason', 'documents'],
}

export function RenewalRequestForm({
  credentialId = '',
  credentialName = '',
  credentialType = 'license',
  onSubmit,
  onCancel,
}: RenewalRequestFormProps) {
  const [reason, setReason] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      progress: 0,
      status: 'uploading',
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])

    // Simulate file upload progress
    newFiles.forEach((uploadedFile) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, progress, status: progress >= 100 ? 'success' : 'uploading' }
              : f,
          ),
        )
        if (progress >= 100) {
          clearInterval(interval)
        }
      }, 200)
    })
  }

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!reason.trim()) {
      newErrors.reason = 'Reason is required'
    }

    const requiredFields = REQUIRED_FIELDS_BY_TYPE[credentialType]
    if (requiredFields.includes('documents') && uploadedFiles.length === 0) {
      newErrors.documents = 'At least one document is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      const formData: RenewalRequestData = {
        credentialId,
        credentialType,
        reason,
        documents: uploadedFiles.map((f) => f.file),
        additionalInfo: additionalInfo || undefined,
      }

      if (onSubmit) {
        await onSubmit(formData)
      } else {
        // Default submission - call RenewalService
        const response = await fetch('/api/demo/lifecycle/renewals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialId,
            credentialType,
            reason,
            additionalInfo,
            // In real implementation, files would be uploaded separately
            documentCount: uploadedFiles.length,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to submit renewal request')
        }

        const result = await response.json()
        // Navigate to status page
        window.location.href = `/demo/lifecycle/renewals/${result.requestId}`
      }
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to submit renewal request',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const requiredFields = REQUIRED_FIELDS_BY_TYPE[credentialType]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Credential Renewal</CardTitle>
        <CardDescription>
          {credentialName && (
            <>
              Renewal request for <strong>{credentialName}</strong>
            </>
          )}
          {!credentialName && 'Submit a renewal request for your credential'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Credential Info */}
          {credentialName && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{credentialName}</div>
                  <Badge variant="outline" className="mt-1 text-xs capitalize">
                    {credentialType}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Renewal <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need to renew this credential..."
              className={cn(errors.reason && 'border-destructive')}
              rows={4}
            />
            {errors.reason && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.reason}
              </p>
            )}
          </div>

          {/* Document Upload */}
          <div className="space-y-2">
            <Label>
              Supporting Documents <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-3">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                  errors.documents
                    ? 'border-destructive bg-destructive/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, DOCX, JPG, PNG (max 10MB each)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select Files
                </Button>
              </div>

              {errors.documents && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.documents}
                </p>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((uploadedFile) => (
                    <div
                      key={uploadedFile.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                        {uploadedFile.status === 'uploading' && (
                          <Progress value={uploadedFile.progress} className="mt-1 h-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadedFile.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        {uploadedFile.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(uploadedFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-2">
            <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
            <Textarea
              id="additionalInfo"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Any additional information that might be helpful..."
              rows={3}
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Renewal Request'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

