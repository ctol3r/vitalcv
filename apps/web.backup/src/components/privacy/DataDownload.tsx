'use client'

import { useState } from 'react'
import { Download, FileText, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type DownloadFormat = 'json' | 'csv' | 'pdf' | 'xml'
type DownloadScope = 'all' | 'credentials' | 'logs' | 'contracts' | 'shares'

interface DownloadRequest {
  formats: DownloadFormat[]
  scope: DownloadScope
  includeMetadata: boolean
  includeAuditTrail: boolean
}

interface DownloadStatus {
  id: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  progress: number
  estimatedTime?: string
  downloadUrl?: string
  expiresAt?: string
}

export default function DataDownload() {
  const [request, setRequest] = useState<DownloadRequest>({
    formats: ['json'],
    scope: 'all',
    includeMetadata: true,
    includeAuditTrail: false,
  })
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const formats: { value: DownloadFormat; label: string; description: string }[] = [
    { value: 'json', label: 'JSON', description: 'Machine-readable format' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet compatible' },
    { value: 'pdf', label: 'PDF', description: 'Human-readable report' },
    { value: 'xml', label: 'XML', description: 'Structured data format' },
  ]

  const scopes: { value: DownloadScope; label: string; description: string }[] = [
    { value: 'all', label: 'All Data', description: 'Complete vault export' },
    { value: 'credentials', label: 'Credentials Only', description: 'Verifiable credentials' },
    { value: 'logs', label: 'Audit Logs', description: 'Activity history' },
    { value: 'contracts', label: 'Contracts', description: 'Signed agreements' },
    { value: 'shares', label: 'Data Shares', description: 'Sharing history' },
  ]

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/demo/privacy/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (res.ok) {
        const data = await res.json()
        setDownloadStatus(data.status)

        // Simulate progress updates
        if (data.status.status === 'processing') {
          simulateProgress(data.status.id)
        }
      } else {
        setDownloadStatus({
          id: 'error',
          status: 'failed',
          progress: 0,
        })
      }
    } catch (error) {
      setDownloadStatus({
        id: 'error',
        status: 'failed',
        progress: 0,
      })
    } finally {
      setSubmitting(false)
    }
  }

  function simulateProgress(downloadId: string) {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setDownloadStatus((prev) => {
        if (!prev || prev.id !== downloadId) {
          clearInterval(interval)
          return prev
        }

        if (progress >= 100) {
          clearInterval(interval)
          return {
            ...prev,
            status: 'ready',
            progress: 100,
            downloadUrl: `/api/demo/privacy/download/${downloadId}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }
        }

        return {
          ...prev,
          progress,
          estimatedTime: `${Math.ceil((100 - progress) / 10)} minutes`,
        }
      })
    }, 2000)
  }

  function toggleFormat(format: DownloadFormat) {
    setRequest((prev) => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter((f) => f !== format)
        : [...prev.formats, format],
    }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Request Data Download
          </CardTitle>
          <CardDescription>
            Choose formats and scope for your data export. You'll receive an email when it's ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Select Formats</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {formats.map((format) => (
                <div
                  key={format.value}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => toggleFormat(format.value)}
                >
                  <Checkbox
                    checked={request.formats.includes(format.value)}
                    onCheckedChange={() => toggleFormat(format.value)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{format.label}</div>
                    <div className="text-sm text-muted-foreground">{format.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-3">
            <Label>Data Scope</Label>
            <Select
              value={request.scope}
              onValueChange={(value) => setRequest((prev) => ({ ...prev, scope: value as DownloadScope }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    <div>
                      <div className="font-medium">{scope.label}</div>
                      <div className="text-xs text-muted-foreground">{scope.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-metadata"
                checked={request.includeMetadata}
                onCheckedChange={(checked) =>
                  setRequest((prev) => ({ ...prev, includeMetadata: checked as boolean }))
                }
              />
              <Label htmlFor="include-metadata" className="cursor-pointer">
                Include metadata and timestamps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-audit"
                checked={request.includeAuditTrail}
                onCheckedChange={(checked) =>
                  setRequest((prev) => ({ ...prev, includeAuditTrail: checked as boolean }))
                }
              />
              <Label htmlFor="include-audit" className="cursor-pointer">
                Include audit trail
              </Label>
            </div>
          </div>

          {/* Submit Button */}
          <Button onClick={handleSubmit} disabled={submitting || request.formats.length === 0} className="w-full">
            {submitting ? 'Submitting...' : 'Request Download'}
          </Button>
        </CardContent>
      </Card>

      {/* Download Status */}
      {downloadStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Download Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {downloadStatus.status === 'processing' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing your request...</span>
                    <span>{downloadStatus.progress}%</span>
                  </div>
                  <Progress value={downloadStatus.progress} />
                  {downloadStatus.estimatedTime && (
                    <p className="text-xs text-muted-foreground">
                      Estimated time remaining: {downloadStatus.estimatedTime}
                    </p>
                  )}
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll receive an email notification when your download is ready.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {downloadStatus.status === 'ready' && downloadStatus.downloadUrl && (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Your download is ready!</span>
                </div>
                <div className="space-y-2">
                  <Button asChild className="w-full">
                    <a href={downloadStatus.downloadUrl} download>
                      <Download className="w-4 h-4 mr-2" />
                      Download Now
                    </a>
                  </Button>
                  {downloadStatus.expiresAt && (
                    <p className="text-xs text-muted-foreground text-center">
                      Download link expires: {new Date(downloadStatus.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    A download link has also been sent to your email address.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {downloadStatus.status === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to process your download request. Please try again or contact support.
                </AlertDescription>
              </Alert>
            )}

            {downloadStatus.status === 'pending' && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Your request has been queued and will be processed shortly.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

