'use client'

import { useState } from 'react'
import { Download, FileText, Calendar, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ReportType = 'general' | 'gdpr' | 'hipaa' | 'ccpa' | 'soc2'

type ReportStatus = 'idle' | 'generating' | 'ready' | 'error'

type Report = {
  id: string
  type: ReportType
  description: string
  dateRange: { from: string; to: string }
  size?: string
  status: ReportStatus
  generatedAt?: string
  downloadUrl?: string
  error?: string
}

type ComplianceReportDownloadProps = {
  onGenerate?: (reportType: ReportType, dateFrom: string, dateTo: string) => Promise<string>
}

export function ComplianceReportDownload({ onGenerate }: ComplianceReportDownloadProps) {
  const [selectedType, setSelectedType] = useState<ReportType>('general')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reports, setReports] = useState<Report[]>([])
  const [generating, setGenerating] = useState(false)

  const reportTypes: { type: ReportType; label: string; description: string }[] = [
    {
      type: 'general',
      label: 'General Compliance Report',
      description: 'Comprehensive overview of all compliance obligations and status',
    },
    {
      type: 'gdpr',
      label: 'GDPR Compliance Report',
      description: 'GDPR-specific compliance status, data processing activities, and privacy measures',
    },
    {
      type: 'hipaa',
      label: 'HIPAA Compliance Report',
      description: 'HIPAA Privacy and Security Rule compliance assessment and evidence',
    },
    {
      type: 'ccpa',
      label: 'CCPA Compliance Report',
      description: 'California Consumer Privacy Act compliance status and consumer rights handling',
    },
    {
      type: 'soc2',
      label: 'SOC 2 Type II Report',
      description: 'SOC 2 Type II audit report with control evidence and testing results',
    },
  ]

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      alert('Please select both start and end dates')
      return
    }

    setGenerating(true)

    const reportId = `report-${Date.now()}`
    const newReport: Report = {
      id: reportId,
      type: selectedType,
      description: reportTypes.find((r) => r.type === selectedType)?.description || '',
      dateRange: { from: dateFrom, to: dateTo },
      status: 'generating',
    }

    setReports((prev) => [newReport, ...prev])

    try {
      // In a real app, this would call the backend API
      const downloadUrl = onGenerate
        ? await onGenerate(selectedType, dateFrom, dateTo)
        : await simulateReportGeneration(selectedType, dateFrom, dateTo)

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'ready',
                downloadUrl,
                size: formatFileSize(Math.floor(Math.random() * 5000000) + 1000000), // 1-5 MB
                generatedAt: new Date().toISOString(),
              }
            : r,
        ),
      )
    } catch (error) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to generate report',
              }
            : r,
        ),
      )
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (report: Report) => {
    if (report.downloadUrl) {
      // In a real app, this would trigger the download
      window.open(report.downloadUrl, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            Generate Compliance Report
          </CardTitle>
          <CardDescription>
            Generate and download compliance reports for specified date ranges. Reports are generated in the background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <div className="grid gap-3 md:grid-cols-2">
              {reportTypes.map((reportType) => (
                <button
                  key={reportType.type}
                  onClick={() => setSelectedType(reportType.type)}
                  className={cn(
                    'text-left rounded-md border p-4 transition-colors',
                    selectedType === reportType.type
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{reportType.label}</span>
                    {selectedType === reportType.type && (
                      <Badge variant="outline" className="border-primary">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{reportType.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Start Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                End Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button onClick={handleGenerate} disabled={generating || !dateFrom || !dateTo} className="w-full">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Reports</CardTitle>
            <CardDescription>Your recently generated compliance reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {reportTypes.find((r) => r.type === report.type)?.label}
                        </h4>
                        <Badge variant="outline">{report.type.toUpperCase()}</Badge>
                        {report.status === 'generating' && (
                          <Badge variant="outline" className="border-amber-300 text-amber-900">
                            Generating...
                          </Badge>
                        )}
                        {report.status === 'ready' && (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-900">
                            Ready
                          </Badge>
                        )}
                        {report.status === 'error' && (
                          <Badge variant="outline" className="border-rose-300 text-rose-900">
                            Error
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          {new Date(report.dateRange.from).toLocaleDateString()} -{' '}
                          {new Date(report.dateRange.to).toLocaleDateString()}
                        </p>
                        {report.size && <p>Size: {report.size}</p>}
                        {report.generatedAt && (
                          <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
                        )}
                        {report.error && (
                          <p className="text-rose-600 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            {report.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'generating' && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                    )}
                    {report.status === 'ready' && (
                      <Button variant="outline" size="sm" onClick={() => handleDownload(report)}>
                        <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                        Download
                      </Button>
                    )}
                    {report.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Retry logic would go here
                          console.log('Retry report generation')
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

async function simulateReportGeneration(
  type: ReportType,
  dateFrom: string,
  dateTo: string,
): Promise<string> {
  // Simulate background generation
  await new Promise((resolve) => setTimeout(resolve, 3000))
  return `/api/compliance/reports/${type}-${Date.now()}.pdf`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

