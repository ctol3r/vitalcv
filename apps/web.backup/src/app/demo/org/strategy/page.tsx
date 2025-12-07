'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RiskSurface, type RiskDataPoint } from '@/components/orgStrategy/RiskSurface'
import { Recommendations } from '@/components/orgStrategy/Recommendations'
import { BurdenCurve } from '@/components/orgStrategy/BurdenCurve'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  FileWarning,
  Shield,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

// Mock data for workforce readiness
interface WorkforceReadiness {
  department: string
  readinessScore: number // 0-100
  currentFTE: number
  requiredFTE: number
  gap: number
  trend: 'improving' | 'stable' | 'declining'
}

// Mock data for safety stress
interface SafetyStress {
  department: string
  stressScore: number // 0-100
  incidentRate: number
  nearMissRate: number
  trend: 'improving' | 'stable' | 'declining'
}

// Mock data for enrollment coverage
interface EnrollmentCoverage {
  department: string
  coveragePercent: number
  enrolledCount: number
  eligibleCount: number
  gap: number
}

// Mock data for privilege capacity forecast
interface PrivilegeCapacity {
  privilege: string
  currentCapacity: number
  forecastedCapacity: number
  utilizationPercent: number
  trend: 'increasing' | 'stable' | 'decreasing'
}

// Mock data for competency distribution
interface CompetencyDistribution {
  competency: string
  proficientCount: number
  developingCount: number
  noviceCount: number
  totalCount: number
}

// Mock data for predicted shortages
interface PredictedShortage {
  department: string
  role: string
  shortageCount: number
  impactDate: string
  severity: 'critical' | 'high' | 'medium'
}

const WORKFORCE_READINESS: WorkforceReadiness[] = [
  { department: 'ICU', readinessScore: 72, currentFTE: 45, requiredFTE: 52, gap: 7, trend: 'declining' },
  { department: 'ED', readinessScore: 88, currentFTE: 38, requiredFTE: 40, gap: 2, trend: 'stable' },
  { department: 'Cath Lab', readinessScore: 65, currentFTE: 12, requiredFTE: 16, gap: 4, trend: 'declining' },
  { department: 'Telehealth', readinessScore: 58, currentFTE: 24, requiredFTE: 32, gap: 8, trend: 'declining' },
  { department: 'Med/Surg', readinessScore: 82, currentFTE: 68, requiredFTE: 72, gap: 4, trend: 'stable' },
]

const SAFETY_STRESS: SafetyStress[] = [
  { department: 'ICU', stressScore: 68, incidentRate: 2.4, nearMissRate: 8.2, trend: 'declining' },
  { department: 'ED', stressScore: 45, incidentRate: 1.2, nearMissRate: 4.1, trend: 'improving' },
  { department: 'Cath Lab', stressScore: 72, incidentRate: 3.1, nearMissRate: 9.8, trend: 'declining' },
  { department: 'Telehealth', stressScore: 35, incidentRate: 0.8, nearMissRate: 2.3, trend: 'improving' },
  { department: 'Med/Surg', stressScore: 52, incidentRate: 1.8, nearMissRate: 5.4, trend: 'stable' },
]

const ENROLLMENT_COVERAGE: EnrollmentCoverage[] = [
  { department: 'ICU', coveragePercent: 85, enrolledCount: 38, eligibleCount: 45, gap: 7 },
  { department: 'ED', coveragePercent: 92, enrolledCount: 35, eligibleCount: 38, gap: 3 },
  { department: 'Cath Lab', coveragePercent: 75, enrolledCount: 9, eligibleCount: 12, gap: 3 },
  { department: 'Telehealth', coveragePercent: 68, enrolledCount: 16, eligibleCount: 24, gap: 8 },
  { department: 'Med/Surg', coveragePercent: 88, enrolledCount: 60, eligibleCount: 68, gap: 8 },
]

const PRIVILEGE_CAPACITY: PrivilegeCapacity[] = [
  { privilege: 'Critical Care', currentCapacity: 45, forecastedCapacity: 38, utilizationPercent: 95, trend: 'decreasing' },
  { privilege: 'Interventional Cardiology', currentCapacity: 12, forecastedCapacity: 8, utilizationPercent: 88, trend: 'decreasing' },
  { privilege: 'Emergency Medicine', currentCapacity: 38, forecastedCapacity: 40, utilizationPercent: 82, trend: 'stable' },
  { privilege: 'Telehealth Behavioral', currentCapacity: 24, forecastedCapacity: 16, utilizationPercent: 92, trend: 'decreasing' },
  { privilege: 'Hospitalist', currentCapacity: 68, forecastedCapacity: 64, utilizationPercent: 78, trend: 'stable' },
]

const COMPETENCY_DISTRIBUTION: CompetencyDistribution[] = [
  { competency: 'Critical Care', proficientCount: 32, developingCount: 8, noviceCount: 5, totalCount: 45 },
  { competency: 'Emergency Procedures', proficientCount: 28, developingCount: 6, noviceCount: 4, totalCount: 38 },
  { competency: 'Interventional Procedures', proficientCount: 8, developingCount: 3, noviceCount: 1, totalCount: 12 },
  { competency: 'Telehealth Delivery', proficientCount: 16, developingCount: 5, noviceCount: 3, totalCount: 24 },
  { competency: 'Hospital Medicine', proficientCount: 52, developingCount: 12, noviceCount: 4, totalCount: 68 },
]

const PREDICTED_SHORTAGES: PredictedShortage[] = [
  { department: 'ICU', role: 'Intensivist', shortageCount: 7, impactDate: '2025-12-22', severity: 'critical' },
  { department: 'Telehealth', role: 'Behavioral Health', shortageCount: 8, impactDate: '2025-12-01', severity: 'critical' },
  { department: 'Cath Lab', role: 'Interventional Card', shortageCount: 4, impactDate: '2026-01-15', severity: 'high' },
  { department: 'Med/Surg', role: 'Hospitalist', shortageCount: 4, impactDate: '2025-12-15', severity: 'medium' },
]

const RISK_DATA: RiskDataPoint[] = [
  { department: 'ICU', specialty: 'Critical Care', timePeriod: '2025-11', riskScore: 68, riskTrend: 'increasing', contributingFactors: ['License renewals', 'DEA expirations'] },
  { department: 'ICU', specialty: 'Critical Care', timePeriod: '2025-12', riskScore: 75, riskTrend: 'increasing', contributingFactors: ['License renewals', 'DEA expirations', 'Privilege renewals'] },
  { department: 'ED', specialty: 'Emergency Medicine', timePeriod: '2025-11', riskScore: 45, riskTrend: 'stable', contributingFactors: [] },
  { department: 'ED', specialty: 'Emergency Medicine', timePeriod: '2025-12', riskScore: 48, riskTrend: 'stable', contributingFactors: [] },
  { department: 'Cath Lab', specialty: 'Interventional', timePeriod: '2025-11', riskScore: 72, riskTrend: 'increasing', contributingFactors: ['Privilege renewals'] },
  { department: 'Cath Lab', specialty: 'Interventional', timePeriod: '2025-12', riskScore: 78, riskTrend: 'increasing', contributingFactors: ['Privilege renewals', 'Board cycles'] },
  { department: 'Telehealth', specialty: 'Behavioral Health', timePeriod: '2025-11', riskScore: 65, riskTrend: 'increasing', contributingFactors: ['License renewals'] },
  { department: 'Telehealth', specialty: 'Behavioral Health', timePeriod: '2025-12', riskScore: 82, riskTrend: 'increasing', contributingFactors: ['License renewals', 'Compact expirations'] },
  { department: 'Med/Surg', specialty: 'Hospitalist', timePeriod: '2025-11', riskScore: 52, riskTrend: 'stable', contributingFactors: [] },
  { department: 'Med/Surg', specialty: 'Hospitalist', timePeriod: '2025-12', riskScore: 55, riskTrend: 'stable', contributingFactors: [] },
]

const RECOMMENDATIONS_DATA = [
  {
    id: 'rec-1',
    type: 'renew_early',
    priority: 'high',
    title: 'Renew licenses early for ICU staff',
    description: '24 ICU clinicians have licenses expiring in Dec 2025. Start renewal process 60 days early to avoid coverage gaps.',
    affectedCount: 24,
    impactDate: '2025-12-15',
    estimatedBenefit: 'Prevent 12% coverage drop',
  },
  {
    id: 'rec-2',
    type: 'onboard',
    priority: 'critical',
    title: 'Onboard 8 Telehealth Behavioral Health clinicians',
    description: 'Critical shortage predicted. Start onboarding immediately to meet Dec 2025 demand.',
    affectedCount: 8,
    impactDate: '2025-12-01',
    estimatedBenefit: 'Restore 25% coverage',
  },
  {
    id: 'rec-3',
    type: 'expand_privileges',
    priority: 'medium',
    title: 'Expand privilege set Y for Cath Lab',
    description: '15 interventional cardiologists can expand privileges to reduce bottleneck.',
    affectedCount: 15,
    impactDate: '2026-01-15',
    estimatedBenefit: 'Increase capacity by 20%',
  },
  {
    id: 'rec-4',
    type: 'renegotiate_payer',
    priority: 'low',
    title: 'Renegotiate payer Z contract terms',
    description: 'Current contract creates credential burden. Renegotiate to reduce renewal frequency.',
    affectedCount: 0,
    impactDate: '2026-02-01',
    estimatedBenefit: 'Reduce admin burden by 30%',
  },
  {
    id: 'rec-5',
    type: 'preempt_safety',
    priority: 'high',
    title: 'Preempt safety risk K in ICU',
    description: 'High stress indicators suggest increased incident risk. Implement proactive safety measures.',
    affectedCount: 45,
    impactDate: '2025-12-01',
    estimatedBenefit: 'Reduce incident rate by 15%',
  },
]

export default function OrgStrategicDashboardPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')

  const departments = useMemo(() => {
    const depts = new Set([
      ...WORKFORCE_READINESS.map((w) => w.department),
      ...SAFETY_STRESS.map((s) => s.department),
      ...ENROLLMENT_COVERAGE.map((e) => e.department),
    ])
    return Array.from(depts)
  }, [])

  const avgReadiness = useMemo(() => {
    const sum = WORKFORCE_READINESS.reduce((acc, w) => acc + w.readinessScore, 0)
    return Math.round(sum / WORKFORCE_READINESS.length)
  }, [])

  const avgSafetyStress = useMemo(() => {
    const sum = SAFETY_STRESS.reduce((acc, s) => s.stressScore, 0)
    return Math.round(sum / SAFETY_STRESS.length)
  }, [])

  const totalEnrollmentGap = useMemo(() => {
    return ENROLLMENT_COVERAGE.reduce((sum, e) => sum + e.gap, 0)
  }, [])

  const criticalShortages = useMemo(() => {
    return PREDICTED_SHORTAGES.filter((s) => s.severity === 'critical').length
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » Org » Strategy</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" /> Org Strategic Dashboard
            </h1>
            <p className="text-muted-foreground max-w-3xl mt-1">
              Comprehensive view of workforce readiness, credential burden, safety stress, enrollment coverage, privilege
              capacity, competency distribution, and predicted shortages.
            </p>
          </div>
          <Link href="/demo/org/strategy/scenario">
            <Button>
              <Zap className="h-4 w-4 mr-2" />
              Scenario Simulator
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workforce Readiness</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgReadiness}%</div>
            <p className="text-xs text-muted-foreground">Average across departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Safety Stress</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgSafetyStress}%</div>
            <p className="text-xs text-muted-foreground">Average stress score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrollment Gap</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{totalEnrollmentGap}</div>
            <p className="text-xs text-muted-foreground">Clinicians not enrolled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Shortages</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{criticalShortages}</div>
            <p className="text-xs text-muted-foreground">Predicted in next 90 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="readiness">Workforce Readiness</TabsTrigger>
          <TabsTrigger value="safety">Safety Stress</TabsTrigger>
          <TabsTrigger value="coverage">Enrollment Coverage</TabsTrigger>
          <TabsTrigger value="privileges">Privilege Capacity</TabsTrigger>
          <TabsTrigger value="competency">Competency Distribution</TabsTrigger>
          <TabsTrigger value="risk">Risk Surface</TabsTrigger>
          <TabsTrigger value="burden">Credential Burden</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Workforce Readiness by Department</CardTitle>
                <CardDescription>Current FTE vs required FTE and readiness scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {WORKFORCE_READINESS.map((w) => (
                    <div key={w.department} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{w.department}</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              w.readinessScore >= 80
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : w.readinessScore >= 60
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-rose-50 text-rose-900 border-rose-200',
                            )}
                          >
                            {w.readinessScore}%
                          </Badge>
                          {w.trend === 'declining' && <TrendingDown className="h-4 w-4 text-rose-600" />}
                          {w.trend === 'improving' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                          {w.trend === 'stable' && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Current: {w.currentFTE} FTE | Required: {w.requiredFTE} FTE
                        </span>
                        {w.gap > 0 && <span className="text-rose-600 font-semibold">Gap: {w.gap} FTE</span>}
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            w.readinessScore >= 80
                              ? 'bg-emerald-500'
                              : w.readinessScore >= 60
                                ? 'bg-amber-500'
                                : 'bg-rose-500',
                          )}
                          style={{ width: `${w.readinessScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Stress Indicators</CardTitle>
                <CardDescription>Stress scores, incident rates, and near-miss rates by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {SAFETY_STRESS.map((s) => (
                    <div key={s.department} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.department}</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              s.stressScore >= 70
                                ? 'bg-rose-50 text-rose-900 border-rose-200'
                                : s.stressScore >= 50
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200',
                            )}
                          >
                            {s.stressScore}%
                          </Badge>
                          {s.trend === 'declining' && <TrendingDown className="h-4 w-4 text-rose-600" />}
                          {s.trend === 'improving' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                          {s.trend === 'stable' && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Incidents: {s.incidentRate}/1000</span>
                        <span>Near-misses: {s.nearMissRate}/1000</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            s.stressScore >= 70
                              ? 'bg-rose-500'
                              : s.stressScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-500',
                          )}
                          style={{ width: `${s.stressScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Recommendations recommendations={RECOMMENDATIONS_DATA} />
        </TabsContent>

        <TabsContent value="readiness" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workforce Readiness Analysis</CardTitle>
              <CardDescription>Detailed breakdown of workforce readiness metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {WORKFORCE_READINESS.map((w) => (
                  <div key={w.department} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{w.department}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          w.readinessScore >= 80
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : w.readinessScore >= 60
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200',
                        )}
                      >
                        {w.readinessScore}% Ready
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current FTE</p>
                        <p className="font-semibold text-lg">{w.currentFTE}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Required FTE</p>
                        <p className="font-semibold text-lg">{w.requiredFTE}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gap</p>
                        <p className={cn('font-semibold text-lg', w.gap > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                          {w.gap > 0 ? `-${w.gap}` : `+${Math.abs(w.gap)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Safety Stress Analysis</CardTitle>
              <CardDescription>Safety stress indicators and incident rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {SAFETY_STRESS.map((s) => (
                  <div key={s.department} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{s.department}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          s.stressScore >= 70
                            ? 'bg-rose-50 text-rose-900 border-rose-200'
                            : s.stressScore >= 50
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200',
                        )}
                      >
                        {s.stressScore}% Stress
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Incident Rate</p>
                        <p className="font-semibold text-lg">{s.incidentRate}/1000</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Near-Miss Rate</p>
                        <p className="font-semibold text-lg">{s.nearMissRate}/1000</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Trend</p>
                        <div className="flex items-center gap-1">
                          {s.trend === 'declining' && <TrendingDown className="h-4 w-4 text-rose-600" />}
                          {s.trend === 'improving' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                          {s.trend === 'stable' && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                          <span className="capitalize">{s.trend}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Coverage</CardTitle>
              <CardDescription>Enrollment status and coverage gaps by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ENROLLMENT_COVERAGE.map((e) => (
                  <div key={e.department} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{e.department}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          e.coveragePercent >= 90
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : e.coveragePercent >= 75
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200',
                        )}
                      >
                        {e.coveragePercent}% Coverage
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Enrolled</p>
                        <p className="font-semibold text-lg">{e.enrolledCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Eligible</p>
                        <p className="font-semibold text-lg">{e.eligibleCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gap</p>
                        <p className="font-semibold text-lg text-rose-600">{e.gap}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all',
                          e.coveragePercent >= 90
                            ? 'bg-emerald-500'
                            : e.coveragePercent >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500',
                        )}
                        style={{ width: `${e.coveragePercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privileges" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privilege Capacity Forecast</CardTitle>
              <CardDescription>Current and forecasted privilege capacity with utilization rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {PRIVILEGE_CAPACITY.map((p) => (
                  <div key={p.privilege} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{p.privilege}</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            p.utilizationPercent >= 90
                              ? 'bg-rose-50 text-rose-900 border-rose-200'
                              : p.utilizationPercent >= 75
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200',
                          )}
                        >
                          {p.utilizationPercent}% Utilized
                        </Badge>
                        {p.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-rose-600" />}
                        {p.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                        {p.trend === 'stable' && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current Capacity</p>
                        <p className="font-semibold text-lg">{p.currentCapacity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Forecasted Capacity</p>
                        <p className="font-semibold text-lg">{p.forecastedCapacity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Change</p>
                        <p
                          className={cn(
                            'font-semibold text-lg',
                            p.currentCapacity > p.forecastedCapacity ? 'text-rose-600' : 'text-emerald-600',
                          )}
                        >
                          {p.currentCapacity > p.forecastedCapacity
                            ? `-${p.currentCapacity - p.forecastedCapacity}`
                            : `+${p.forecastedCapacity - p.currentCapacity}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Competency Distribution</CardTitle>
              <CardDescription>Distribution of proficiency levels across competencies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {COMPETENCY_DISTRIBUTION.map((c) => {
                  const proficientPercent = (c.proficientCount / c.totalCount) * 100
                  const developingPercent = (c.developingCount / c.totalCount) * 100
                  const novicePercent = (c.noviceCount / c.totalCount) * 100
                  return (
                    <div key={c.competency} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{c.competency}</h3>
                        <Badge variant="outline" className="text-sm">
                          Total: {c.totalCount}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Proficient</span>
                          <span className="font-semibold text-emerald-600">{c.proficientCount}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${proficientPercent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Developing</span>
                          <span className="font-semibold text-amber-600">{c.developingCount}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${developingPercent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Novice</span>
                          <span className="font-semibold text-rose-600">{c.noviceCount}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${novicePercent}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <RiskSurface data={RISK_DATA} />
        </TabsContent>

        <TabsContent value="burden" className="space-y-6">
          <BurdenCurve />
        </TabsContent>
      </Tabs>

      {/* Predicted Shortages */}
      <Card>
        <CardHeader>
          <CardTitle>Predicted Shortages</CardTitle>
          <CardDescription>Forecasted workforce shortages by department and role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PREDICTED_SHORTAGES.map((s) => (
              <div key={`${s.department}-${s.role}`} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {s.department} • {s.role}
                    </h3>
                    <p className="text-sm text-muted-foreground">Impact Date: {new Date(s.impactDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        s.severity === 'critical'
                          ? 'bg-rose-50 text-rose-900 border-rose-200'
                          : s.severity === 'high'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-sky-50 text-sky-900 border-sky-200',
                      )}
                    >
                      {s.severity}
                    </Badge>
                    <span className="text-2xl font-bold text-rose-600">-{s.shortageCount} FTE</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
