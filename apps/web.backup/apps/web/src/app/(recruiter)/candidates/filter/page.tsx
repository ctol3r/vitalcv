'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Filter, Loader2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')

interface Candidate {
  clinicianId: string
  readinessScore: number
  specialty?: string
}

interface SkillMatchResult {
  match: {
    clinicianId: string
    skillMatchScore: number
    missingSkills: string[]
    coveredSkills: string[]
    coverageByCategory: Record<string, number>
  }
}

export default function SkillFilterPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [matches, setMatches] = useState<Record<string, SkillMatchResult['match']>>({})
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [requiredSkills, setRequiredSkills] = useState('Tele-ICU, Structural Heart')
  const [requiredCerts, setRequiredCerts] = useState('ABIM Board, ACLS')
  const [requiredProcedures, setRequiredProcedures] = useState('TAVR, Impella Support')

  useEffect(() => {
    void loadCandidates()
  }, [])

  async function loadCandidates() {
    setLoadingCandidates(true)
    setError(null)
    try {
      const response = await fetch(
        buildApiUrl('/api/recruiter/candidates?ready=true'),
      )
      if (!response.ok) {
        throw new Error(`Candidate API responded with ${response.status}`)
      }
      const data = await response.json()
      const rows = (data.candidates ?? []).slice(0, 5).map((candidate: any) => ({
        clinicianId: candidate.clinicianId,
        readinessScore: candidate.readinessScore,
        specialty: candidate.specialty ?? 'General',
      }))
      setCandidates(rows)
    } catch (err) {
      console.warn('Falling back to mock candidate roster', err)
      setCandidates(buildMockCandidates())
      setError('Candidate API unavailable — using demo roster.')
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function evaluateMatches(event?: FormEvent) {
    event?.preventDefault()
    if (!candidates.length) return
    setEvaluating(true)
    try {
      const requirements = {
        requiredSkills: tokenize(requiredSkills),
        requiredCertifications: tokenize(requiredCerts),
        privilegedProcedures: tokenize(requiredProcedures),
      }
      const results = await Promise.all(
        candidates.map(async (candidate) => {
          const response = await fetch(buildApiUrl('/api/skills/match'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clinicianId: candidate.clinicianId,
              ...requirements,
            }),
          })
          if (!response.ok) {
            throw new Error(`Match API failed with ${response.status}`)
          }
          const payload = (await response.json()) as SkillMatchResult
          return payload.match
        }),
      )
      setMatches(
        results.reduce<Record<string, SkillMatchResult['match']>>((acc, match) => {
          acc[match.clinicianId] = match
          return acc
        }, {}),
      )
    } catch (err) {
      console.warn('Skill match API unavailable, using heuristic scoring', err)
      const mockMatches = candidates.reduce<Record<string, SkillMatchResult['match']>>(
        (acc, candidate) => {
          acc[candidate.clinicianId] = {
            clinicianId: candidate.clinicianId,
            skillMatchScore: Number((candidate.readinessScore * 0.8).toFixed(2)),
            coveredSkills: tokenize(requiredSkills).slice(0, 1),
            missingSkills: tokenize(requiredProcedures).slice(0, 1),
            coverageByCategory: { skills: 0.6, certifications: 0.5, procedures: 0.4 },
          }
          return acc
        },
        {},
      )
      setMatches(mockMatches)
      setError('Skill match API unavailable — showing heuristic scores.')
    } finally {
      setEvaluating(false)
    }
  }

  const sortedCandidates = useMemo(() => {
    if (!candidates.length) return []
    return [...candidates].sort((a, b) => {
      const matchA = matches[a.clinicianId]?.skillMatchScore ?? 0
      const matchB = matches[b.clinicianId]?.skillMatchScore ?? 0
      return matchB - matchA
    })
  }, [candidates, matches])

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Recruiter</p>
          <h1 className="text-3xl font-bold">Skill-based candidate filtering</h1>
          <p className="text-muted-foreground max-w-2xl">
            Align required skills, certifications, and privileged procedures to incoming
            candidates. The SkillMatch engine combines clinician graphs + requirements to
            surface fit and missing competencies.
          </p>
        </div>
        <Button onClick={evaluateMatches} disabled={evaluating}>
          {evaluating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating…
            </>
          ) : (
            <>
              <Filter className="mr-2 h-4 w-4" /> Evaluate matches
            </>
          )}
        </Button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job requirements</CardTitle>
          <CardDescription>Adjust filters to recompute fit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={evaluateMatches}>
            <RequirementInput
              label="Required skills"
              value={requiredSkills}
              onChange={setRequiredSkills}
            />
            <RequirementInput
              label="Certifications"
              value={requiredCerts}
              onChange={setRequiredCerts}
            />
            <RequirementInput
              label="Privileged procedures"
              value={requiredProcedures}
              onChange={setRequiredProcedures}
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidate matches</CardTitle>
          <CardDescription>Ranked by skill match score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingCandidates ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            sortedCandidates.map((candidate) => (
              <CandidateRow
                key={candidate.clinicianId}
                candidate={candidate}
                match={matches[candidate.clinicianId]}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RequirementInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Input
        className="mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Comma-separated list"
      />
    </div>
  )
}

function CandidateRow({
  candidate,
  match,
}: {
  candidate: Candidate
  match?: SkillMatchResult['match']
}) {
  const score = match?.skillMatchScore ?? candidate.readinessScore * 0.5
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{candidate.clinicianId}</p>
          <p className="text-xs text-muted-foreground">
            Specialty: {candidate.specialty ?? 'Unknown'}
          </p>
        </div>
        <Badge
          variant={
            score >= 0.75
              ? 'default'
              : score >= 0.5
                ? 'secondary'
                : 'outline'
          }
          className="text-base"
        >
          {(score * 100).toFixed(0)}%
        </Badge>
      </div>
      {match && (
        <div className="mt-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Missing:</span>{' '}
            {match.missingSkills.length ? match.missingSkills.join(', ') : 'None'}
          </div>
          <div>
            <span className="font-medium">Covered:</span>{' '}
            {match.coveredSkills.length ? match.coveredSkills.join(', ') : 'Baseline'}
          </div>
        </div>
      )}
    </div>
  )
}

function tokenize(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function buildMockCandidates(): Candidate[] {
  return [
    { clinicianId: 'mock-npi-7788', readinessScore: 0.92, specialty: 'Cardiology' },
    { clinicianId: 'mock-npi-9922', readinessScore: 0.81, specialty: 'Cardiology' },
    { clinicianId: 'mock-npi-4411', readinessScore: 0.79, specialty: 'Critical Care' },
  ]
}

