'use client'

import { useMemo, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, FileText, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type BiasMetric = {
  id: string
  category: string
  metric: string
  value: number
  threshold: number
  status: 'pass' | 'warning' | 'fail'
  description: string
}

type CorrectiveAction = {
  id: string
  type: 'algorithm_adjustment' | 'data_remediation' | 'policy_update' | 'monitoring_enhancement'
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  assignedTo: string
  dueDate: string
  completedAt?: string
}

type AuditResult = {
  id: string
  auditDate: string
  period: {
    start: string
    end: string
  }
  overallStatus: 'pass' | 'warning' | 'fail'
  summary: string
  biasMetrics: BiasMetric[]
  correctiveActions: CorrectiveAction[]
}

type FairnessAuditData = {
  latestAudit: AuditResult
  historicalAudits: AuditResult[]
  complianceOfficer: {
    name: string
    role: string
  }
}

export default function FairnessAuditViewerPage() {
  const [selectedAudit, setSelectedAudit] = useState<AuditResult | null>(null)
  const [srMessage, setSrMessage] = useState('')

  const data = useMemo(() => buildMockData(), [])

  const handleDownloadReport = async (auditId: string) => {
    setSrMessage('Preparing audit report for download')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSrMessage('Audit report ready')
    setTimeout(() => setSrMessage(''), 2000)
  }

  const passCount = data.latestAudit.biasMetrics.filter((m) => m.status === 'pass').length
  const warningCount = data.latestAudit.biasMetrics.filter((m) => m.status === 'warning').length
  const failCount = data.latestAudit.biasMetrics.filter((m) => m.status === 'fail').length

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • System • Fairness Audit</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Fairness Audit Viewer
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Review audit results, bias metrics, and corrective actions for the reputation engine. Accessible to compliance officers.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleDownloadReport(data.latestAudit.id)}>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>
      </header>

      {/* Latest Audit Summary */}
      <section className="grid gap-4 md:grid-cols-4" aria-label="Audit summary">
        <Card className={data.latestAudit.overallStatus === 'pass' ? 'border-emerald-200 bg-emerald-50' : data.latestAudit.overallStatus === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Overall Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={data.latestAudit.overallStatus === 'pass' ? 'default' : data.latestAudit.overallStatus === 'warning' ? 'default' : 'destructive'}
              className="text-lg px-3 py-1 capitalize"
            >
              {data.latestAudit.overallStatus}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Metrics Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{passCount}</p>
            <p className="text-sm text-muted-foreground">Out of {data.latestAudit.biasMetrics.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{warningCount}</p>
            <p className="text-sm text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-600">{failCount}</p>
            <p className="text-sm text-muted-foreground">Require action</p>
          </CardContent>
        </Card>
      </section>

      {/* Latest Audit Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Latest Audit Results</CardTitle>
              <CardDescription>
                Audit period: {data.latestAudit.period.start} to {data.latestAudit.period.end} • Conducted on {data.latestAudit.auditDate}
              </CardDescription>
            </div>
            <Badge variant={data.latestAudit.overallStatus === 'pass' ? 'default' : data.latestAudit.overallStatus === 'warning' ? 'default' : 'destructive'} className="capitalize">
              {data.latestAudit.overallStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-6">{data.latestAudit.summary}</p>

          <div className="space-y-6">
            {/* Bias Metrics */}
            <section>
              <h3 className="text-lg font-semibold mb-4">Bias Metrics</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.latestAudit.biasMetrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.category}</TableCell>
                      <TableCell>{metric.metric}</TableCell>
                      <TableCell>
                        <span className={metric.value > metric.threshold ? 'text-rose-600 font-semibold' : ''}>
                          {metric.value.toFixed(3)}
                        </span>
                      </TableCell>
                      <TableCell>{metric.threshold.toFixed(3)}</TableCell>
                      <TableCell>
                        <StatusBadge status={metric.status} />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-muted-foreground">{metric.description}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Corrective Actions */}
            <section>
              <h3 className="text-lg font-semibold mb-4">Corrective Actions</h3>
              {data.latestAudit.correctiveActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No corrective actions required.</p>
              ) : (
                <div className="space-y-3">
                  {data.latestAudit.correctiveActions.map((action) => (
                    <Card key={action.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {action.type.replace('_', ' ')}
                              </Badge>
                              <StatusBadge status={action.status} />
                            </div>
                            <h4 className="font-semibold">{action.title}</h4>
                            <p className="text-sm text-muted-foreground">{action.description}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>Assigned to: {action.assignedTo}</span>
                              <span>Due: {action.dueDate}</span>
                              {action.completedAt && <span>Completed: {action.completedAt}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </CardContent>
      </Card>

      {/* Historical Audits */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Audits</CardTitle>
          <CardDescription>Previous audit results for trend analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Metrics Passed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.historicalAudits.map((audit) => (
                <TableRow key={audit.id}>
                  <TableCell>{audit.auditDate}</TableCell>
                  <TableCell>
                    {audit.period.start} to {audit.period.end}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={audit.overallStatus} />
                  </TableCell>
                  <TableCell>
                    {audit.biasMetrics.filter((m) => m.status === 'pass').length} / {audit.biasMetrics.length}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelectedAudit(audit)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Detail Dialog */}
      <Dialog open={Boolean(selectedAudit)} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        {selectedAudit && (
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Details</DialogTitle>
              <DialogDescription>
                Audit period: {selectedAudit.period.start} to {selectedAudit.period.end} • Conducted on {selectedAudit.auditDate}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Summary</h3>
                <p className="text-sm">{selectedAudit.summary}</p>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Bias Metrics</h3>
                <div className="space-y-2">
                  {selectedAudit.biasMetrics.map((metric) => (
                    <div key={metric.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="font-medium">{metric.category} - {metric.metric}</p>
                        </div>
                        <StatusBadge status={metric.status} />
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Value: {metric.value.toFixed(3)}</span>
                        <span>Threshold: {metric.threshold.toFixed(3)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{metric.description}</p>
                    </div>
                  ))}
                </div>
              </section>
              {selectedAudit.correctiveActions.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Corrective Actions</h3>
                  <div className="space-y-2">
                    {selectedAudit.correctiveActions.map((action) => (
                      <div key={action.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{action.title}</p>
                          <StatusBadge status={action.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          <span>Type: {action.type.replace('_', ' ')}</span>
                          <span>Assigned: {action.assignedTo}</span>
                          <span>Due: {action.dueDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: 'pass' | 'warning' | 'fail' | 'pending' | 'in_progress' | 'completed' | 'rejected' }) {
  const config = {
    pass: { label: 'Pass', variant: 'default' as const, icon: CheckCircle2 },
    warning: { label: 'Warning', variant: 'default' as const, icon: AlertTriangle },
    fail: { label: 'Fail', variant: 'destructive' as const, icon: AlertTriangle },
    pending: { label: 'Pending', variant: 'secondary' as const },
    in_progress: { label: 'In Progress', variant: 'default' as const },
    completed: { label: 'Completed', variant: 'default' as const, icon: CheckCircle2 },
    rejected: { label: 'Rejected', variant: 'destructive' as const },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit capitalize">
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

function buildMockData(): FairnessAuditData {
  return {
    latestAudit: {
      id: 'audit-2025-11',
      auditDate: '2025-11-15',
      period: {
        start: '2025-10-01',
        end: '2025-11-15',
      },
      overallStatus: 'warning',
      summary:
        'The reputation engine audit identified minor bias concerns in peer recognition metrics. Overall system performance remains within acceptable thresholds, but corrective actions are recommended for peer scoring algorithms.',
      biasMetrics: [
        {
          id: 'm1',
          category: 'Demographic Parity',
          metric: 'Gender Disparity',
          value: 0.08,
          threshold: 0.10,
          status: 'pass',
          description: 'Gender-based score differences are within acceptable range.',
        },
        {
          id: 'm2',
          category: 'Demographic Parity',
          metric: 'Racial Disparity',
          value: 0.12,
          threshold: 0.10,
          status: 'warning',
          description: 'Minor racial disparities detected in credential scoring. Requires monitoring.',
        },
        {
          id: 'm3',
          category: 'Equalized Odds',
          metric: 'False Positive Rate',
          value: 0.15,
          threshold: 0.20,
          status: 'pass',
          description: 'False positive rates are balanced across demographic groups.',
        },
        {
          id: 'm4',
          category: 'Peer Recognition',
          metric: 'Endorsement Bias',
          value: 0.18,
          threshold: 0.15,
          status: 'warning',
          description: 'Peer endorsement patterns show slight bias toward certain specialties.',
        },
        {
          id: 'm5',
          category: 'Enrollment Fairness',
          metric: 'Network Access',
          value: 0.22,
          threshold: 0.20,
          status: 'fail',
          description: 'Enrollment approval rates show disparities that exceed threshold.',
        },
      ],
      correctiveActions: [
        {
          id: 'ca1',
          type: 'algorithm_adjustment',
          title: 'Adjust Peer Recognition Algorithm',
          description: 'Review and recalibrate peer endorsement weighting to reduce specialty bias.',
          status: 'pending',
          assignedTo: 'ML Engineering Team',
          dueDate: '2025-12-01',
        },
        {
          id: 'ca2',
          type: 'data_remediation',
          title: 'Review Enrollment Data',
          description: 'Audit enrollment decision data for potential bias sources.',
          status: 'in_progress',
          assignedTo: 'Data Quality Team',
          dueDate: '2025-11-30',
        },
        {
          id: 'ca3',
          type: 'monitoring_enhancement',
          title: 'Enhanced Bias Monitoring',
          description: 'Implement real-time bias monitoring dashboard for compliance officers.',
          status: 'completed',
          assignedTo: 'Platform Team',
          dueDate: '2025-11-10',
          completedAt: '2025-11-08',
        },
      ],
    },
    historicalAudits: [
      {
        id: 'audit-2025-10',
        auditDate: '2025-10-15',
        period: {
          start: '2025-09-01',
          end: '2025-10-15',
        },
        overallStatus: 'pass',
        summary: 'All bias metrics within acceptable thresholds.',
        biasMetrics: [
          {
            id: 'h1',
            category: 'Demographic Parity',
            metric: 'Gender Disparity',
            value: 0.06,
            threshold: 0.10,
            status: 'pass',
            description: 'Within acceptable range.',
          },
          {
            id: 'h2',
            category: 'Demographic Parity',
            metric: 'Racial Disparity',
            value: 0.09,
            threshold: 0.10,
            status: 'pass',
            description: 'Within acceptable range.',
          },
        ],
        correctiveActions: [],
      },
      {
        id: 'audit-2025-09',
        auditDate: '2025-09-15',
        period: {
          start: '2025-08-01',
          end: '2025-09-15',
        },
        overallStatus: 'pass',
        summary: 'All metrics passed. System performing well.',
        biasMetrics: [
          {
            id: 'h3',
            category: 'Demographic Parity',
            metric: 'Gender Disparity',
            value: 0.05,
            threshold: 0.10,
            status: 'pass',
            description: 'Within acceptable range.',
          },
        ],
        correctiveActions: [],
      },
    ],
    complianceOfficer: {
      name: 'Jane Smith',
      role: 'Chief Compliance Officer',
    },
  }
}

