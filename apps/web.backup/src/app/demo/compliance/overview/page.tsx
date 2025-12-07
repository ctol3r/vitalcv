'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  TrendingUp,
  Clock,
  ExternalLink,
  BarChart3,
  PieChart,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ComplianceStatus = 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT'

type ObligationSummary = {
  id: string
  title: string
  regulation: string
  status: ComplianceStatus
  fulfilled: number
  total: number
  lastAudit?: string
}

type AuditAlert = {
  id: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  obligation: string
  dueDate: string
  description: string
}

type RecentAudit = {
  id: string
  type: string
  date: string
  status: 'PASSED' | 'FAILED' | 'PENDING'
  auditor: string
}

export default function ComplianceOverviewDashboardPage() {
  const [srMessage, setSrMessage] = useState('')

  const obligations = useMemo(() => buildMockObligations(), [])
  const alerts = useMemo(() => buildMockAlerts(), [])
  const recentAudits = useMemo(() => buildMockRecentAudits(), [])

  const overallStats = useMemo(() => {
    const totalObligations = obligations.length
    const fulfilled = obligations.reduce((sum, o) => sum + o.fulfilled, 0)
    const total = obligations.reduce((sum, o) => sum + o.total, 0)
    const percentage = total > 0 ? Math.round((fulfilled / total) * 100) : 0
    const compliant = obligations.filter((o) => o.status === 'COMPLIANT').length
    const warnings = obligations.filter((o) => o.status === 'WARNING').length
    const nonCompliant = obligations.filter((o) => o.status === 'NON_COMPLIANT').length

    return {
      percentage,
      fulfilled,
      total,
      compliant,
      warnings,
      nonCompliant,
      totalObligations,
    }
  }, [obligations])

  const handleQuickLink = (path: string) => {
    setSrMessage(`Navigating to ${path}`)
    setTimeout(() => setSrMessage(''), 2000)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Compliance • Overview</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
              Compliance Overview Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Monitor your organization's compliance status across all obligations, track outstanding issues, and view recent audit activity.
            </p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Compliance summary">
        <StatCard
          title="Overall Compliance"
          value={`${overallStats.percentage}%`}
          description={`${overallStats.fulfilled} of ${overallStats.total} obligations fulfilled`}
          icon={<PieChart className="h-5 w-5 text-primary" aria-hidden="true" />}
          trend={overallStats.percentage >= 90 ? 'positive' : overallStats.percentage >= 70 ? 'neutral' : 'negative'}
        />
        <StatCard
          title="Compliant Obligations"
          value={`${overallStats.compliant}`}
          description={`${overallStats.totalObligations} total obligations`}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
          tone="success"
        />
        <StatCard
          title="Outstanding Issues"
          value={`${overallStats.warnings + overallStats.nonCompliant}`}
          description={`${overallStats.warnings} warnings, ${overallStats.nonCompliant} non-compliant`}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
          tone={overallStats.warnings + overallStats.nonCompliant > 0 ? 'warn' : undefined}
        />
        <StatCard
          title="Active Alerts"
          value={`${alerts.length}`}
          description={`${alerts.filter((a) => a.severity === 'HIGH').length} high priority`}
          icon={<ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />}
          tone={alerts.length > 0 ? 'fail' : undefined}
        />
      </section>

      {/* Compliance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
            Compliance Status by Regulation
          </CardTitle>
          <CardDescription>Visual breakdown of compliance across different regulatory frameworks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {obligations.map((obligation) => (
              <div key={obligation.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{obligation.title}</h3>
                    <Badge variant="outline" className={getStatusBadgeClass(obligation.status)}>
                      {obligation.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{obligation.regulation}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {obligation.fulfilled}/{obligation.total}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', getProgressBarClass(obligation.status))}
                    style={{ width: `${(obligation.fulfilled / obligation.total) * 100}%` }}
                    aria-label={`${obligation.fulfilled} of ${obligation.total} fulfilled`}
                  />
                </div>
                {obligation.lastAudit && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Last audit: {obligation.lastAudit}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Outstanding Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              Outstanding Issues
            </CardTitle>
            <CardDescription>Issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {obligations
              .filter((o) => o.status !== 'COMPLIANT')
              .map((obligation) => (
                <div key={obligation.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{obligation.title}</h4>
                    <Badge variant="outline" className={getStatusBadgeClass(obligation.status)}>
                      {obligation.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {obligation.total - obligation.fulfilled} unfulfilled obligations
                  </p>
                  <Link
                    href={`/demo/compliance/obligations/${obligation.id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    onClick={() => handleQuickLink(obligation.title)}
                  >
                    View details <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            {obligations.every((o) => o.status === 'COMPLIANT') && (
              <p className="text-sm text-muted-foreground text-center py-4">No outstanding issues 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Audit Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />
              Audit Alerts
            </CardTitle>
            <CardDescription>Recent alerts and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{alert.title}</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      alert.severity === 'HIGH' && 'border-rose-300 text-rose-900',
                      alert.severity === 'MEDIUM' && 'border-amber-300 text-amber-900',
                      alert.severity === 'LOW' && 'border-blue-300 text-blue-900',
                    )}
                  >
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{alert.obligation}</span>
                  <span>Due: {alert.dueDate}</span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active alerts</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Audits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            Recent Audits
          </CardTitle>
          <CardDescription>Latest audit activity and results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAudits.map((audit) => (
              <div key={audit.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{audit.type}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        audit.status === 'PASSED' && 'border-emerald-300 text-emerald-900',
                        audit.status === 'FAILED' && 'border-rose-300 text-rose-900',
                        audit.status === 'PENDING' && 'border-amber-300 text-amber-900',
                      )}
                    >
                      {audit.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {audit.date} • Conducted by {audit.auditor}
                  </p>
                </div>
                <Link
                  href={`/demo/compliance/audit-log?audit=${audit.id}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>Common compliance tasks and resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/demo/compliance/training">
                <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                Training Modules
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/demo/compliance/audit-log">
                <BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" />
                Audit Log
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/compliance/education">
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                Education & Docs
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/compliance/jurisdiction-policy">
                <ShieldAlert className="h-4 w-4 mr-2" aria-hidden="true" />
                Policy Editor
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
  tone,
  trend,
}: {
  title: string
  value: string
  description: string
  icon?: React.ReactNode
  tone?: 'success' | 'warn' | 'fail'
  trend?: 'positive' | 'neutral' | 'negative'
}) {
  const accent =
    tone === 'fail'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-muted bg-card'

  return (
    <Card className={cn('border', accent)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{value}</p>
          {trend && (
            <TrendingUp
              className={cn(
                'h-4 w-4',
                trend === 'positive' && 'text-emerald-600',
                trend === 'negative' && 'text-rose-600',
                trend === 'neutral' && 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function getStatusBadgeClass(status: ComplianceStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return 'border-emerald-300 text-emerald-900 bg-emerald-50'
    case 'WARNING':
      return 'border-amber-300 text-amber-900 bg-amber-50'
    case 'NON_COMPLIANT':
      return 'border-rose-300 text-rose-900 bg-rose-50'
  }
}

function getProgressBarClass(status: ComplianceStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return 'bg-emerald-500'
    case 'WARNING':
      return 'bg-amber-500'
    case 'NON_COMPLIANT':
      return 'bg-rose-500'
  }
}

function buildMockObligations(): ObligationSummary[] {
  return [
    {
      id: 'gdpr-001',
      title: 'GDPR Data Protection',
      regulation: 'GDPR',
      status: 'COMPLIANT',
      fulfilled: 12,
      total: 12,
      lastAudit: '2025-10-15',
    },
    {
      id: 'hipaa-001',
      title: 'HIPAA Privacy Rule',
      regulation: 'HIPAA',
      status: 'WARNING',
      fulfilled: 8,
      total: 10,
      lastAudit: '2025-09-20',
    },
    {
      id: 'hipaa-002',
      title: 'HIPAA Security Rule',
      regulation: 'HIPAA',
      status: 'COMPLIANT',
      fulfilled: 15,
      total: 15,
      lastAudit: '2025-10-01',
    },
    {
      id: 'ccpa-001',
      title: 'CCPA Consumer Rights',
      regulation: 'CCPA',
      status: 'NON_COMPLIANT',
      fulfilled: 3,
      total: 7,
      lastAudit: '2025-08-10',
    },
    {
      id: 'soc2-001',
      title: 'SOC 2 Type II',
      regulation: 'SOC 2',
      status: 'COMPLIANT',
      fulfilled: 20,
      total: 20,
      lastAudit: '2025-11-01',
    },
  ]
}

function buildMockAlerts(): AuditAlert[] {
  return [
    {
      id: 'alert-001',
      severity: 'HIGH',
      title: 'CCPA Data Deletion Request Overdue',
      obligation: 'CCPA-001',
      dueDate: '2025-11-20',
      description: 'Consumer data deletion request has exceeded the 45-day response window.',
    },
    {
      id: 'alert-002',
      severity: 'MEDIUM',
      title: 'HIPAA Risk Assessment Due',
      obligation: 'HIPAA-001',
      dueDate: '2025-11-25',
      description: 'Annual HIPAA risk assessment must be completed within 30 days.',
    },
    {
      id: 'alert-003',
      severity: 'LOW',
      title: 'GDPR DPO Training Reminder',
      obligation: 'GDPR-001',
      dueDate: '2025-12-01',
      description: 'Data Protection Officer training certification expires next month.',
    },
  ]
}

function buildMockRecentAudits(): RecentAudit[] {
  return [
    {
      id: 'audit-001',
      type: 'GDPR Compliance Audit',
      date: '2025-10-15',
      status: 'PASSED',
      auditor: 'External Audit Firm A',
    },
    {
      id: 'audit-002',
      type: 'HIPAA Security Assessment',
      date: '2025-10-01',
      status: 'PASSED',
      auditor: 'Internal Audit Team',
    },
    {
      id: 'audit-003',
      type: 'CCPA Compliance Review',
      date: '2025-08-10',
      status: 'FAILED',
      auditor: 'Regulatory Compliance Office',
    },
    {
      id: 'audit-004',
      type: 'SOC 2 Type II Audit',
      date: '2025-11-01',
      status: 'PASSED',
      auditor: 'Certified Auditor B',
    },
  ]
}

