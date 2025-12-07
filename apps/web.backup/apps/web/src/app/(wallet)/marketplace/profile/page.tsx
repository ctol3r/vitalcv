'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Sparkles,
  ShieldCheck,
  Globe,
  MapPin,
  Eye,
  EyeOff,
  MailPlus,
  RefreshCw,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')
const DEMO_CLINICIAN = 'demo-78123'
const SPECIALTY_OPTIONS = ['Telehealth', 'Hospitalist', 'Psychiatry', 'Critical Care', 'Oncology']
const REGION_OPTIONS = ['National', 'Remote', 'IMLC', 'PSYPACT']

type MarketplaceProfile = {
  clinicianId: string
  visibility: string
  specialties: string[]
  regions: string[]
  readiness: {
    score: number
    tier: string
    updatedAt?: string
    factors: Record<string, any>
  }
  compactEligibility: {
    eligible: boolean
    compacts: string[]
  }
  updatedAt: string
}

export default function MarketplaceProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null)
  const [form, setForm] = useState({
    visibility: 'invite',
    specialties: SPECIALTY_OPTIONS.slice(0, 3),
    regions: ['National'],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(buildApiUrl(`/api/marketplace/profile/${DEMO_CLINICIAN}`))
      if (!response.ok) {
        throw new Error(`Profile API responded with ${response.status}`)
      }
      const data = (await response.json()) as MarketplaceProfile
      setProfile(data)
      setForm({
        visibility: data.visibility,
        specialties: data.specialties ?? [],
        regions: data.regions ?? [],
      })
    } catch (err) {
      console.warn('[marketplace][profile] load failed', err)
      setError('Marketplace profile API unavailable — showing demo state.')
      setProfile(buildMockProfile())
      setForm({
        visibility: 'public',
        specialties: ['Telehealth', 'Hospitalist'],
        regions: ['National', 'IMLC'],
      })
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const response = await fetch(buildApiUrl(`/api/marketplace/profile/${DEMO_CLINICIAN}`), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        throw new Error(`Update failed with ${response.status}`)
      }
      const data = (await response.json()) as MarketplaceProfile
      setProfile(data)
      toast({
        title: 'Marketplace profile updated',
        description: `Visibility set to ${data.visibility}.`,
      })
    } catch (err) {
      console.error('[marketplace][profile] update failed', err)
      toast({
        title: 'Unable to save profile',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const readinessBadge = useMemo(() => {
    if (!profile) return null
    const value = (profile.readiness.score * 100).toFixed(1)
    return `${value}% • ${profile.readiness.tier}`
  }, [profile])

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet Marketplace</p>
          <h1 className="text-3xl font-bold">Talent Exchange Profile</h1>
          <p className="text-muted-foreground max-w-2xl">
            Tune visibility, specialties, and regional preferences to participate in the cross-org
            talent exchange. Recruiters reuse readiness credentials and compact signals automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadProfile} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                Visibility controls
              </CardTitle>
              <CardDescription>Choose who can see your credential-backed profile.</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {form.visibility.toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <VisibilityButton
                label="Public"
                description="Recruiters across the network"
                active={form.visibility === 'public'}
                icon={<Globe className="h-4 w-4" />}
                onClick={() => setForm((prev) => ({ ...prev, visibility: 'public' }))}
              />
              <VisibilityButton
                label="Invite only"
                description="Share via direct link"
                active={form.visibility === 'invite'}
                icon={<MailPlus className="h-4 w-4" />}
                onClick={() => setForm((prev) => ({ ...prev, visibility: 'invite' }))}
              />
              <VisibilityButton
                label="Private"
                description="Only you can view"
                active={form.visibility === 'private'}
                icon={<EyeOff className="h-4 w-4" />}
                onClick={() => setForm((prev) => ({ ...prev, visibility: 'private' }))}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-semibold">Custom message</p>
              <Input placeholder="Add a short blurb recruiters will see…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Readiness preview
            </CardTitle>
            <CardDescription>Live readiness badge shared on invites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !profile ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Composite readiness</p>
                    <p className="text-2xl font-semibold">{readinessBadge}</p>
                  </div>
                  <Badge variant={profile.compactEligibility.eligible ? 'secondary' : 'outline'}>
                    {profile.compactEligibility.eligible
                      ? `Compact: ${profile.compactEligibility.compacts.join(', ')}`
                      : 'No compact'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {profile.readiness.updatedAt ? new Date(profile.readiness.updatedAt).toLocaleString() : 'recently'}.
                  Recruiters see tier + readiness notes only.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Specialty preferences
            </CardTitle>
            <CardDescription>
              Highlight specialties recruiters should match you with.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={form.specialties.includes(option) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleValue('specialties', option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-500" />
              Regions & compacts
            </CardTitle>
            <CardDescription>Share licensure reach, compacts, or telehealth coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REGION_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={form.regions.includes(option) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleValue('regions', option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Invite signal preview</CardTitle>
          <CardDescription>
            Recruiters see this summary when sending an “Invite to Apply” across the marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {loading || !profile ? (
            <Skeleton className="h-32 w-full md:col-span-3" />
          ) : (
            <>
              <ProfileStat
                title="Visibility"
                value={form.visibility === 'public' ? 'Listed' : form.visibility === 'invite' ? 'Invite-only' : 'Hidden'}
                icon={<Eye className="h-4 w-4" />}
              />
              <ProfileStat
                title="Specialties"
                value={`${form.specialties.length} selected`}
                icon={<Sparkles className="h-4 w-4" />}
              />
              <ProfileStat
                title="Regions"
                value={form.regions.join(', ') || 'Not specified'}
                icon={<Globe className="h-4 w-4" />}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )

  function toggleValue(field: 'specialties' | 'regions', value: string) {
    setForm((prev) => {
      const exists = prev[field].includes(value)
      const nextValues = exists ? prev[field].filter((entry) => entry !== value) : [...prev[field], value]
      return { ...prev, [field]: nextValues }
    })
  }
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function VisibilityButton({
  label,
  description,
  icon,
  active,
  onClick,
}: {
  label: string
  description: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[180px] flex-1 flex-col rounded-lg border px-3 py-2 text-left ${
        active ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full border bg-white p-2 text-primary">{icon}</span>
        <p className="font-medium">{label}</p>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  )
}

function ProfileStat({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function buildMockProfile(): MarketplaceProfile {
  return {
    clinicianId: DEMO_CLINICIAN,
    visibility: 'public',
    specialties: ['Telehealth', 'Hospitalist'],
    regions: ['National', 'IMLC'],
    readiness: {
      score: 0.91,
      tier: 'Ready in 48h',
      updatedAt: new Date().toISOString(),
      factors: {
        sanctionsClear: true,
        npdb: 'clear',
      },
    },
    compactEligibility: {
      eligible: true,
      compacts: ['IMLC'],
    },
    updatedAt: new Date().toISOString(),
  }
}

