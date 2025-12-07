'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingDown,
  TrendingUp,
  Shield,
  Building2,
  MapPin,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

type EnrollmentStatus = 'ENROLLED' | 'PENDING' | 'REJECTED' | 'PANEL_FULL' | 'DEACTIVATED' | 'UNKNOWN'

type PECOSEnrollment = {
  status: EnrollmentStatus
  enrollmentDate?: string
  expiryDate?: string
  score: number
}

type MedicaidEnrollment = {
  state: string
  status: EnrollmentStatus
  enrollmentDate?: string
  expiryDate?: string
}

type PayerEnrollment = {
  payerId: string
  payerName: string
  status: EnrollmentStatus
  enrollmentDate?: string
  expiryDate?: string
  isRequired: boolean
  failureReason?: string
}

type EnrollmentCompletenessData = {
  completeness: number
  pecosScore: number
  medicaidScore: number
  payerScore: number
  missingRequiredPayers: string[]
  breakdown: {
    pecos: { status: string; score: number }
    medicaid: { enrolledStates: number; totalStates: number; score: number }
    payers: { enrolled: number; required: number; total: number; score: number }
  }
  pecos: PECOSEnrollment
  medicaid: MedicaidEnrollment[]
  payers: PayerEnrollment[]
  alignmentMismatches?: Array<{
    payerName: string
    reason: string
  }>
  coverageGaps?: Array<{
    state: string
    missingPayers: string[]
    coverageRatio: number
  }>
}

type ClinicianEnrollmentProfile = {
  clinician: {
    name: string
    credentialId: string
    specialty: string
    facility: string
    npi: string
    practiceStates: string[]
  }
  enrollment: EnrollmentCompletenessData
}

function getStatusColor(status: EnrollmentStatus): string {
  switch (status) {
    case 'ENROLLED':
      return 'bg-green-500/10 text-green-700 dark:text-green-400'
    case 'PENDING':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    case 'REJECTED':
      return 'bg-red-500/10 text-red-700 dark:text-red-400'
    case 'PANEL_FULL':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
    case 'DEACTIVATED':
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    default:
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
  }
}

function getStatusIcon(status: EnrollmentStatus) {
  switch (status) {
    case 'ENROLLED':
      return <CheckCircle2 className="h-4 w-4" />
    case 'PENDING':
      return <Clock className="h-4 w-4" />
    case 'REJECTED':
    case 'DEACTIVATED':
      return <XCircle className="h-4 w-4" />
    case 'PANEL_FULL':
      return <AlertTriangle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

function isExpired(expiryDate?: string): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400'
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

export default function ClinicianEnrollmentPage() {
  const profile = useMemo(() => buildMockProfile(), [])

  const { enrollment } = profile

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Demo • Clinician • Enrollment
        </p>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Enrollment Completeness</h1>
          <p className="text-muted-foreground mt-2">
            {profile.clinician.name} • {profile.clinician.specialty} • NPI: {profile.clinician.npi}
          </p>
        </div>
      </header>

      {/* Overall Completeness Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Enrollment Completeness</CardTitle>
          <CardDescription>
            Weighted score: PECOS (30%), Medicaid (20%), Payers (50%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completeness Score</span>
              <span className={cn('text-2xl font-bold', getScoreColor(enrollment.completeness))}>
                {(enrollment.completeness * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={enrollment.completeness * 100} className="h-3" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>PECOS</span>
              </div>
              <div className={cn('text-lg font-semibold', getScoreColor(enrollment.pecosScore))}>
                {(enrollment.pecosScore * 100).toFixed(0)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Medicaid</span>
              </div>
              <div className={cn('text-lg font-semibold', getScoreColor(enrollment.medicaidScore))}>
                {(enrollment.medicaidScore * 100).toFixed(0)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>Payers</span>
              </div>
              <div className={cn('text-lg font-semibold', getScoreColor(enrollment.payerScore))}>
                {(enrollment.payerScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PECOS Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>PECOS Enrollment</CardTitle>
          <CardDescription>Medicare enrollment status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(enrollment.pecos.status)}>
                <span className="flex items-center gap-1.5">
                  {getStatusIcon(enrollment.pecos.status)}
                  {enrollment.pecos.status}
                </span>
              </Badge>
              {isExpired(enrollment.pecos.expiryDate) && (
                <Badge variant="destructive">Expired</Badge>
              )}
            </div>
            <div className={cn('text-lg font-semibold', getScoreColor(enrollment.pecos.score))}>
              Score: {(enrollment.pecos.score * 100).toFixed(0)}%
            </div>
          </div>
          {enrollment.pecos.enrollmentDate && (
            <div className="text-sm text-muted-foreground">
              Enrolled: {new Date(enrollment.pecos.enrollmentDate).toLocaleDateString()}
            </div>
          )}
          {enrollment.pecos.expiryDate && (
            <div className="text-sm text-muted-foreground">
              Expires: {new Date(enrollment.pecos.expiryDate).toLocaleDateString()}
              {isExpired(enrollment.pecos.expiryDate) && (
                <span className="ml-2 text-red-600 dark:text-red-400">(Expired)</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medicaid Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>Medicaid Enrollment</CardTitle>
          <CardDescription>
            {enrollment.breakdown.medicaid.enrolledStates} of{' '}
            {enrollment.breakdown.medicaid.totalStates} states enrolled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Coverage</span>
              <span className={cn('text-lg font-semibold', getScoreColor(enrollment.medicaidScore))}>
                {(enrollment.medicaidScore * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={enrollment.medicaidScore * 100} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {enrollment.medicaid.map((medicaid) => (
              <div
                key={medicaid.state}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(medicaid.status)}>
                    <span className="flex items-center gap-1.5">
                      {getStatusIcon(medicaid.status)}
                      {medicaid.state}
                    </span>
                  </Badge>
                  {isExpired(medicaid.expiryDate) && (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                  )}
                </div>
                {medicaid.expiryDate && (
                  <div className="text-xs text-muted-foreground">
                    {isExpired(medicaid.expiryDate) ? 'Expired' : 'Active'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payer Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>Payer Enrollment</CardTitle>
          <CardDescription>
            {enrollment.breakdown.payers.enrolled} of {enrollment.breakdown.payers.total} payers
            enrolled ({enrollment.breakdown.payers.required} required)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payer Score</span>
              <span className={cn('text-lg font-semibold', getScoreColor(enrollment.payerScore))}>
                {(enrollment.payerScore * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={enrollment.payerScore * 100} className="h-2" />
          </div>

          {enrollment.missingRequiredPayers.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex items-center gap-2 text-sm font-medium text-red-900 dark:text-red-100">
                <AlertTriangle className="h-4 w-4" />
                Missing Required Payers
              </div>
              <ul className="mt-2 list-disc list-inside text-sm text-red-700 dark:text-red-300">
                {enrollment.missingRequiredPayers.map((payer) => (
                  <li key={payer}>{payer}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {enrollment.payers.map((payer) => (
              <div
                key={payer.payerId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(payer.status)}>
                    <span className="flex items-center gap-1.5">
                      {getStatusIcon(payer.status)}
                      {payer.status}
                    </span>
                  </Badge>
                  <div>
                    <div className="font-medium">{payer.payerName}</div>
                    {payer.isRequired && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpired(payer.expiryDate) && (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                  )}
                  {payer.failureReason && (
                    <div className="text-xs text-muted-foreground">{payer.failureReason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coverage Gaps */}
      {enrollment.coverageGaps && enrollment.coverageGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Region Coverage Gaps</CardTitle>
            <CardDescription>Missing major payers by region</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollment.coverageGaps.map((gap) => (
              <div key={gap.state} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{gap.state}</div>
                  <div className="text-sm text-muted-foreground">
                    Coverage: {(gap.coverageRatio * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Missing: {gap.missingPayers.join(', ')}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alignment Mismatches */}
      {enrollment.alignmentMismatches && enrollment.alignmentMismatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alignment Mismatches</CardTitle>
            <CardDescription>Required payers not aligned with practice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollment.alignmentMismatches.map((mismatch, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                <div className="font-medium">{mismatch.payerName}</div>
                <div className="text-sm text-muted-foreground">{mismatch.reason}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function buildMockProfile(): ClinicianEnrollmentProfile {
  const now = new Date()
  const expiredDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const futureDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  return {
    clinician: {
      name: 'Dr. Sarah Chen',
      credentialId: 'cred-001',
      specialty: 'Cardiology',
      facility: 'Stanford Health',
      npi: '1234567890',
      practiceStates: ['CA', 'NY'],
    },
    enrollment: {
      completeness: 0.72,
      pecosScore: 0.3, // Expired
      medicaidScore: 0.75,
      payerScore: 0.85,
      missingRequiredPayers: ['Blue Shield of California', 'Aetna'],
      breakdown: {
        pecos: { status: 'ENROLLED', score: 0.3 },
        medicaid: { enrolledStates: 1, totalStates: 2, score: 0.75 },
        payers: { enrolled: 4, required: 3, total: 6, score: 0.85 },
      },
      pecos: {
        status: 'ENROLLED',
        enrollmentDate: '2020-01-15',
        expiryDate: expiredDate.toISOString(),
        score: 0.3,
      },
      medicaid: [
        {
          state: 'CA',
          status: 'ENROLLED',
          enrollmentDate: '2021-03-01',
          expiryDate: futureDate.toISOString(),
        },
        {
          state: 'NY',
          status: 'REJECTED',
          enrollmentDate: undefined,
          expiryDate: undefined,
        },
      ],
      payers: [
        {
          payerId: 'payer-1',
          payerName: 'Medicare',
          status: 'ENROLLED',
          enrollmentDate: '2020-01-15',
          expiryDate: futureDate.toISOString(),
          isRequired: true,
        },
        {
          payerId: 'payer-2',
          payerName: 'Blue Shield of California',
          status: 'PENDING',
          enrollmentDate: undefined,
          expiryDate: undefined,
          isRequired: true,
          failureReason: 'Application under review',
        },
        {
          payerId: 'payer-3',
          payerName: 'Aetna',
          status: 'REJECTED',
          enrollmentDate: undefined,
          expiryDate: undefined,
          isRequired: true,
          failureReason: 'Panel full',
        },
        {
          payerId: 'payer-4',
          payerName: 'UnitedHealthcare',
          status: 'ENROLLED',
          enrollmentDate: '2021-06-01',
          expiryDate: futureDate.toISOString(),
          isRequired: false,
        },
        {
          payerId: 'payer-5',
          payerName: 'Cigna',
          status: 'ENROLLED',
          enrollmentDate: '2021-08-15',
          expiryDate: futureDate.toISOString(),
          isRequired: false,
        },
        {
          payerId: 'payer-6',
          payerName: 'Kaiser Permanente',
          status: 'PANEL_FULL',
          enrollmentDate: undefined,
          expiryDate: undefined,
          isRequired: false,
        },
      ],
      alignmentMismatches: [
        {
          payerName: 'Aetna',
          reason: 'Required but panel full',
        },
        {
          payerName: 'Blue Shield of California',
          reason: 'Required but pending',
        },
      ],
      coverageGaps: [
        {
          state: 'CA',
          missingPayers: ['Blue Shield of California', 'Aetna'],
          coverageRatio: 0.5,
        },
      ],
    },
  }
}

