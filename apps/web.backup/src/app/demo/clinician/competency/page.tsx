'use client'

import { useMemo } from 'react'
import { AlertTriangle, BookOpen, CheckCircle2, Target, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FusionScoreBadge, type FusionScoreBreakdown, type FusionScoreSignal } from '@/components/fusion/FusionScoreBadge'
import { FusionTrendChart, type FusionTrendDatum } from '@/components/fusion/FusionTrendChart'
import { TrendChart } from '@/components/oppe/TrendChart'
import { cn } from '@/lib/utils'

type CompetencyDomain = 'Clinical Skills' | 'Patient Safety' | 'Communication' | 'Professionalism' | 'Quality Metrics'

type DomainDetail = {
  score: number
  risk: 'low' | 'medium' | 'high'
  trend: 'up' | 'down' | 'stable'
  explanation: string
  evidence: string[]
}

type TrainingOpportunity = {
  id: string
  title: string
  domain: CompetencyDomain
  priority: 'high' | 'medium' | 'low'
  description: string
  estimatedHours: number
}

type ClinicianCompetencyProfile = {
  clinician: {
    name: string
    credentialId: string
    specialty: string
    facility: string
    npi: string
  }
  cci: {
    current: number
    trend: number
    percentile: number
    explanation: string
    breakdown: FusionScoreBreakdown[]
  }
  fusionScore: {
    current: number
    percentile: number
    signals: FusionScoreSignal[]
  }
  domains: Record<CompetencyDomain, DomainDetail>
  strengths: Array<{ domain: CompetencyDomain; score: number; evidence: string[] }>
  improvementAreas: Array<{ domain: CompetencyDomain; score: number; gap: number; recommendations: string[] }>
  trainingOpportunities: TrainingOpportunity[]
  trend: FusionTrendDatum[]
  cciHistory: Array<{ label: string; value: number; date?: string }>
}

export default function ClinicianCompetencyProfilePage() {
  const profile = useMemo(() => buildMockProfile(), [])

  const cciExplanation = useMemo(() => {
    return {
      title: 'Clinical Competency Index (CCI)',
      description: profile.cci.explanation,
      components: [
        {
          label: 'Clinical Skills',
          value: profile.domains['Clinical Skills'].score,
          description: 'Technical proficiency and diagnostic accuracy',
        },
        {
          label: 'Patient Safety',
          value: profile.domains['Patient Safety'].score,
          description: 'Adherence to safety protocols and error prevention',
        },
        {
          label: 'Communication',
          value: profile.domains.Communication.score,
          description: 'Patient communication and team collaboration',
        },
        {
          label: 'Professionalism',
          value: profile.domains.Professionalism.score,
          description: 'Ethical conduct and professional standards',
        },
        {
          label: 'Quality Metrics',
          value: profile.domains['Quality Metrics'].score,
          description: 'Outcomes, efficiency, and quality indicators',
        },
      ],
    }
  }, [profile])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Competency</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" aria-hidden="true" />
              Clinician Competency Profile
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Comprehensive competency assessment for {profile.clinician.name}. Includes CCI breakdown, domain analysis, training opportunities, and improvement recommendations.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clinical Competency Index (CCI)</CardTitle>
            <CardDescription>Composite score reflecting overall clinical competency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-4xl font-bold">{profile.cci.current.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">
                  {profile.cci.percentile}th percentile • {profile.cci.trend >= 0 ? '+' : ''}
                  {profile.cci.trend.toFixed(1)} vs last quarter
                </p>
              </div>
              {profile.cci.trend >= 0 ? (
                <TrendingUp className="h-6 w-6 text-emerald-600" aria-label="Trending up" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-rose-600" aria-label="Trending down" />
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold">What is CCI?</p>
              <p className="text-sm text-muted-foreground">{cciExplanation.description}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Component Breakdown</p>
              <dl className="space-y-2">
                {cciExplanation.components.map((component) => (
                  <div key={component.label} className="flex items-center justify-between text-sm">
                    <div>
                      <dt className="font-medium">{component.label}</dt>
                      <dd className="text-xs text-muted-foreground">{component.description}</dd>
                    </div>
                    <Badge variant="outline" className="font-semibold">
                      {component.value}
                    </Badge>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fusion Score</CardTitle>
            <CardDescription>Combined credential and quality signals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <FusionScoreBadge
                score={profile.fusionScore.current}
                label="Fusion Score"
                percentile={profile.fusionScore.percentile}
                breakdown={profile.cci.breakdown}
                signals={profile.fusionScore.signals}
                size="lg"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CCI Trend</CardTitle>
            <CardDescription>Historical Clinical Competency Index</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              title=""
              description=""
              data={profile.cciHistory}
              valueFormatter={(value) => `${Math.round(value)}`}
              unitLabel="CCI"
              srHint="CCI trend chart showing historical competency index over time"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fusion Score Trend</CardTitle>
            <CardDescription>Combined credential and quality metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <FusionTrendChart
              data={profile.trend}
              title=""
              description=""
              initialView="combined"
              srHint="Fusion score trend showing combined credential and quality metrics over time"
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Strengths
            </CardTitle>
            <CardDescription>Areas of exceptional performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.strengths.map((strength) => (
              <div key={strength.domain} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-emerald-900">{strength.domain}</p>
                  <Badge className="bg-emerald-600 text-white">{strength.score}</Badge>
                </div>
                <ul className="space-y-1 text-sm text-emerald-800">
                  {strength.evidence.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" aria-hidden="true" />
              Improvement Areas
            </CardTitle>
            <CardDescription>Domains with opportunities for growth</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.improvementAreas.map((area) => (
              <div key={area.domain} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-amber-900">{area.domain}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-300 text-amber-900">
                      {area.score}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Gap: {area.gap} pts</span>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-amber-800">
                  {area.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Target className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            Training Opportunities
          </CardTitle>
          <CardDescription>Recommended training to enhance competency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profile.trainingOpportunities.map((opp) => (
              <div
                key={opp.id}
                className={cn(
                  'rounded-lg border p-4',
                  opp.priority === 'high' ? 'border-rose-200 bg-rose-50/50' : opp.priority === 'medium' ? 'border-amber-200 bg-amber-50/50' : 'border-blue-200 bg-blue-50/50',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{opp.title}</p>
                      <Badge
                        variant={opp.priority === 'high' ? 'destructive' : opp.priority === 'medium' ? 'outline' : 'secondary'}
                        className="text-xs"
                      >
                        {opp.priority} priority
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {opp.domain}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{opp.description}</p>
                    <p className="text-xs text-muted-foreground">Estimated: {opp.estimatedHours} hours</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Details</CardTitle>
          <CardDescription>Comprehensive breakdown by competency domain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(Object.keys(profile.domains) as CompetencyDomain[]).map((domain) => {
              const detail = profile.domains[domain]
              return (
                <div key={domain} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{domain}</p>
                      <p className="text-sm text-muted-foreground">{detail.explanation}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={detail.risk === 'high' ? 'destructive' : detail.risk === 'medium' ? 'outline' : 'secondary'}
                        className="font-semibold"
                      >
                        {detail.score}
                      </Badge>
                      {detail.trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-600" aria-label="Trending up" />}
                      {detail.trend === 'down' && <AlertTriangle className="h-4 w-4 text-rose-600" aria-label="Trending down" />}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Evidence</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {detail.evidence.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinician Profile</CardTitle>
          <CardDescription>Identifiers and basic information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Name', value: profile.clinician.name },
            { label: 'Credential ID', value: profile.clinician.credentialId },
            { label: 'Specialty', value: profile.clinician.specialty },
            { label: 'Facility', value: profile.clinician.facility },
            { label: 'NPI', value: profile.clinician.npi },
          ].map((item) => (
            <div key={item.label} className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function buildMockProfile(): ClinicianCompetencyProfile {
  const now = new Date()
  const trend: FusionTrendDatum[] = []
  const cciHistory: Array<{ label: string; value: number; date?: string }> = []

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    trend.push({
      label: monthLabel,
      date: date.toISOString(),
      combined: 87 + Math.random() * 4,
      credential: 89 + Math.random() * 3,
      quality: 85 + Math.random() * 5,
    })
    cciHistory.push({
      label: monthLabel,
      value: 87.5 + Math.random() * 3,
      date: date.toISOString(),
    })
  }

  return {
    clinician: {
      name: 'Dr. Maya Lennox',
      credentialId: 'ORG-CC-9845',
      specialty: 'Interventional Cardiology',
      facility: 'Northwind Medical Center',
      npi: '1750392145',
    },
    cci: {
      current: 87.5,
      trend: 2.3,
      percentile: 85,
      explanation:
        'The Clinical Competency Index (CCI) is a composite score that measures overall clinical performance across five key domains: Clinical Skills, Patient Safety, Communication, Professionalism, and Quality Metrics. Your CCI of 87.5 places you in the 85th percentile, indicating strong performance across all competency areas.',
      breakdown: [
        { label: 'Clinical Skills', value: 92 },
        { label: 'Patient Safety', value: 88 },
        { label: 'Communication', value: 85 },
        { label: 'Professionalism', value: 90 },
        { label: 'Quality Metrics', value: 86 },
      ],
    },
    fusionScore: {
      current: 89,
      percentile: 82,
      signals: [
        { label: 'Strong credential stack', severity: 'positive', helper: 'All PSV current' },
        { label: 'OPPE trends positive', severity: 'positive', helper: '6-month improvement' },
        { label: 'Quality metrics stable', severity: 'positive' },
      ],
    },
    domains: {
      'Clinical Skills': {
        score: 92,
        risk: 'low',
        trend: 'up',
        explanation: 'Exceptional technical proficiency with consistent positive outcomes',
        evidence: ['95% diagnostic accuracy rate', 'Zero sentinel events', 'Peer review: Excellent'],
      },
      'Patient Safety': {
        score: 88,
        risk: 'low',
        trend: 'stable',
        explanation: 'Strong adherence to safety protocols with minor documentation improvements needed',
        evidence: ['100% hand hygiene compliance', 'No medication errors in 12 months', 'Active participation in safety rounds'],
      },
      Communication: {
        score: 85,
        risk: 'low',
        trend: 'up',
        explanation: 'Good patient communication with opportunities to enhance team collaboration',
        evidence: ['Patient satisfaction: 4.6/5', 'Timely documentation', 'Regular team huddles'],
      },
      Professionalism: {
        score: 90,
        risk: 'low',
        trend: 'stable',
        explanation: 'Exemplary professional conduct and ethical standards',
        evidence: ['Zero complaints', 'Mentorship activities', 'Continuing education current'],
      },
      'Quality Metrics': {
        score: 86,
        risk: 'low',
        trend: 'up',
        explanation: 'Strong quality outcomes with consistent improvement trends',
        evidence: ['Readmission rate: 8% (below target)', 'Length of stay: Optimal', 'Patient outcomes: Above average'],
      },
    },
    strengths: [
      {
        domain: 'Clinical Skills',
        score: 92,
        evidence: ['Highest diagnostic accuracy in department', 'Recognized for complex case management', 'Peer-reviewed publications'],
      },
      {
        domain: 'Professionalism',
        score: 90,
        evidence: ['Mentors junior clinicians', 'Active in quality improvement initiatives', 'Exemplary ethical conduct'],
      },
    ],
    improvementAreas: [
      {
        domain: 'Communication',
        score: 85,
        gap: 5,
        recommendations: [
          'Participate in communication skills workshop',
          'Enhance interdisciplinary team collaboration',
          'Improve patient education materials utilization',
        ],
      },
    ],
    trainingOpportunities: [
      {
        id: 'train-1',
        title: 'Advanced Communication Techniques',
        domain: 'Communication',
        priority: 'medium',
        description: 'Workshop focusing on patient-centered communication and interdisciplinary collaboration',
        estimatedHours: 8,
      },
      {
        id: 'train-2',
        title: 'Quality Improvement Methodology',
        domain: 'Quality Metrics',
        priority: 'low',
        description: 'Training on QI tools and methodologies to further enhance outcomes',
        estimatedHours: 4,
      },
    ],
    trend,
    cciHistory,
  }
}

