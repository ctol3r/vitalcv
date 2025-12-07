'use client'

import { useState } from 'react'
import {
  ShieldAlert,
  Download,
  FileText,
  Search,
  Calendar,
  Lock,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ReportRequest = {
  id: string
  type: string
  dateRange: { from: string; to: string }
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'READY'
  requestedAt: string
  downloadUrl?: string
}

type AuditLogSegment = {
  id: string
  entity: string
  dateRange: { from: string; to: string }
  eventCount: number
  downloadUrl: string
}

type EvidenceItem = {
  id: string
  title: string
  type: string
  obligation: string
  uploadedAt: string
  downloadUrl: string
}

export default function RegulatorPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [search, setSearch] = useState('')

  const reportRequests = useState<ReportRequest[]>([
    {
      id: 'req-001',
      type: 'GDPR Compliance Report',
      dateRange: { from: '2025-01-01', to: '2025-10-31' },
      status: 'READY',
      requestedAt: '2025-11-01T00:00:00Z',
      downloadUrl: '/api/regulator/reports/req-001.pdf',
    },
    {
      id: 'req-002',
      type: 'HIPAA Audit Report',
      dateRange: { from: '2025-06-01', to: '2025-11-30' },
      status: 'APPROVED',
      requestedAt: '2025-11-10T00:00:00Z',
    },
  ])[0]

  const auditLogSegments = useState<AuditLogSegment[]>([
    {
      id: 'segment-001',
      entity: 'user-123',
      dateRange: { from: '2025-10-01', to: '2025-10-31' },
      eventCount: 45,
      downloadUrl: '/api/regulator/audit-logs/segment-001.json',
    },
    {
      id: 'segment-002',
      entity: 'org-456',
      dateRange: { from: '2025-09-01', to: '2025-09-30' },
      eventCount: 128,
      downloadUrl: '/api/regulator/audit-logs/segment-002.json',
    },
  ])[0]

  const evidenceItems = useState<EvidenceItem[]>([
    {
      id: 'ev-001',
      title: 'GDPR Compliance Assessment',
      type: 'PDF',
      obligation: 'GDPR-001',
      uploadedAt: '2025-10-15',
      downloadUrl: '/api/regulator/evidence/ev-001.pdf',
    },
    {
      id: 'ev-002',
      title: 'HIPAA Security Controls Documentation',
      type: 'PDF',
      obligation: 'HIPAA-001',
      uploadedAt: '2025-09-20',
      downloadUrl: '/api/regulator/evidence/ev-002.pdf',
    },
  ])[0]

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would call ExternalAuditAPI
    setIsAuthenticated(true)
  }

  const handleRequestReport = () => {
    // In a real app, this would submit a report request
    alert('Report request submitted. You will be notified when it is ready.')
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-md py-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              Regulator Portal Login
            </CardTitle>
            <CardDescription>
              Secure portal for external auditors and regulators. Access is restricted and monitored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="auditor@regulatory-body.gov"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
            <div className="mt-4 p-3 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> This portal enforces strict RBAC. All access is logged and monitored.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Regulator Portal</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
              Regulator Portal
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Secure portal for external auditors and regulators to request reports, download evidence, and view audit log segments.
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsAuthenticated(false)}>
            Logout
          </Button>
        </div>
      </header>

      {/* Request New Report */}
      <Card>
        <CardHeader>
          <CardTitle>Request Compliance Report</CardTitle>
          <CardDescription>Request a new compliance report for a specific date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option>GDPR Compliance Report</option>
                <option>HIPAA Audit Report</option>
                <option>CCPA Compliance Report</option>
                <option>General Compliance Report</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" className="w-full" />
            </div>
          </div>
          <Button onClick={handleRequestReport} className="mt-4">
            <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
            Request Report
          </Button>
        </CardContent>
      </Card>

      {/* Report Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Report Requests</CardTitle>
          <CardDescription>Status of your requested compliance reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reportRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between rounded-md border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{request.type}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        request.status === 'READY' && 'border-emerald-300 text-emerald-900',
                        request.status === 'APPROVED' && 'border-blue-300 text-blue-900',
                        request.status === 'PENDING' && 'border-amber-300 text-amber-900',
                        request.status === 'REJECTED' && 'border-rose-300 text-rose-900',
                      )}
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(request.dateRange.from).toLocaleDateString()} -{' '}
                    {new Date(request.dateRange.to).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested: {new Date(request.requestedAt).toLocaleString()}
                  </p>
                </div>
                {request.status === 'READY' && request.downloadUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={request.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log Segments</CardTitle>
          <CardDescription>View and download audit log segments for specific entities and date ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {auditLogSegments.map((segment) => (
              <div key={segment.id} className="flex items-center justify-between rounded-md border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">Entity: {segment.entity}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(segment.dateRange.from).toLocaleDateString()} -{' '}
                    {new Date(segment.dateRange.to).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{segment.eventCount} events</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={segment.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                    Download
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evidence */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Evidence</CardTitle>
          <CardDescription>Download evidence documents for specific obligations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search evidence..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-3">
            {evidenceItems
              .filter(
                (item) =>
                  !search ||
                  item.title.toLowerCase().includes(search.toLowerCase()) ||
                  item.obligation.toLowerCase().includes(search.toLowerCase()),
              )
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{item.title}</h4>
                        <Badge variant="outline">{item.type}</Badge>
                        <Badge variant="outline" className="text-xs">{item.obligation}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Uploaded: {item.uploadedAt}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Security Notice</h4>
              <p className="text-sm text-amber-800">
                All access to this portal is logged and monitored. Unauthorized access attempts will be reported to
                security authorities. All downloaded materials are subject to confidentiality agreements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

