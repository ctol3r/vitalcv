'use client'

import { useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Shield,
  KeyRound,
  RefreshCw,
  LockKeyhole,
  Anchor,
  Download,
  Upload,
  Smartphone,
  Mail,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')
const DEMO_CLINICIAN = 'demo-78123'

type RecoverySession = {
  sessionId: string
  delivery: string
  maskedDestination?: string
  expiresAt?: string
  debugCode?: string
}

type RecoveryKit = {
  blob: string
  secret: string
  credentialCount: number
  checksum: string
}

export default function DeviceLossRecoveryPage() {
  const { toast } = useToast()
  const [method, setMethod] = useState<'email' | 'phone' | 'recovery-kit'>('email')
  const [session, setSession] = useState<RecoverySession | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [kit, setKit] = useState<RecoveryKit | null>(null)
  const [kitUpload, setKitUpload] = useState<{ blob: string; key: string }>({ blob: '', key: '' })
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startRecovery() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(buildApiUrl('/api/did/recovery/session'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicianId: DEMO_CLINICIAN, method }),
      })
      if (!response.ok) throw new Error(`Init failed (${response.status})`)
      const data = (await response.json()) as RecoverySession
      setSession(data)
      setVerifyCode(data.debugCode ?? '')
      setStep(1)
      toast({
        title: 'Challenge issued',
        description: `Sent via ${data.delivery} to ${data.maskedDestination ?? 'destination'}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start recovery')
    } finally {
      setLoading(false)
    }
  }

  async function verifyChallenge() {
    if (!session) return
    setLoading(true)
    try {
      const response = await fetch(
        buildApiUrl(`/api/did/recovery/session/${session.sessionId}/verify`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: verifyCode }),
        },
      )
      if (!response.ok) throw new Error(`Verification failed (${response.status})`)
      await response.json()
      setStep(2)
      toast({ title: 'Challenge verified', description: 'Proceed to rotate keys.' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function downloadKit() {
    setLoading(true)
    try {
      const response = await fetch(buildApiUrl(`/api/did/recovery/kit/${DEMO_CLINICIAN}`))
      if (!response.ok) throw new Error(`Kit request failed (${response.status})`)
      const data = (await response.json()) as RecoveryKit
      setKit(data)
      setKitUpload({ blob: data.blob, key: data.secret })
      toast({
        title: 'Recovery kit ready',
        description: `Checksum ${data.checksum.slice(0, 10)}…`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export kit')
    } finally {
      setLoading(false)
    }
  }

  async function rotateKeys() {
    if (!session) return
    if (!kitUpload.blob || !kitUpload.key) {
      setError('Provide recovery kit blob + key before rotating.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(
        buildApiUrl(`/api/did/recovery/session/${session.sessionId}/rotate`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kitBlob: kitUpload.blob,
            kitKey: kitUpload.key,
          }),
        },
      )
      if (!response.ok) throw new Error(`Rotation failed (${response.status})`)
      const payload = await response.json()
      setResult(payload)
      setStep(4)
      toast({
        title: 'Keys rotated',
        description: `DID ${payload.did}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rotate keys')
    } finally {
      setLoading(false)
    }
  }

function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setKitUpload((prev) => ({ ...prev, blob: String(reader.result ?? '') }))
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet</p>
        <h1 className="text-3xl font-bold">Device loss recovery</h1>
        <p className="text-muted-foreground max-w-3xl">
          Choose a recovery channel, verify the challenge, download the encrypted recovery kit, and
          rotate DID keys. Each step anchors to the audit ledger with anti-replay guards.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Recovery halted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <StepCard
          title="1. Choose method"
          description="Send a one-time challenge"
          icon={<Shield className="h-5 w-5" />}
          active
          badge={session ? 'Challenge issued' : undefined}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant={method === 'email' ? 'default' : 'outline'}
              onClick={() => setMethod('email')}
              size="sm"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button
              variant={method === 'phone' ? 'default' : 'outline'}
              onClick={() => setMethod('phone')}
              size="sm"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              SMS
            </Button>
            <Button
              variant={method === 'recovery-kit' ? 'default' : 'outline'}
              onClick={() => setMethod('recovery-kit')}
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Recovery kit
            </Button>
          </div>
          <Button className="mt-4 w-full" onClick={startRecovery} disabled={loading}>
            {loading ? 'Sending…' : 'Send challenge'}
          </Button>
          {session && (
            <p className="text-xs text-muted-foreground">
              Delivered via {session.delivery} to {session.maskedDestination ?? 'destination'}
            </p>
          )}
        </StepCard>

        <StepCard
          title="2. Verify challenge"
          description="Enter the OTP or escrow code"
          icon={<KeyRound className="h-5 w-5" />}
          active={step >= 1}
          badge={step >= 2 ? 'Verified' : undefined}
        >
          <Input
            placeholder="Enter code"
            value={verifyCode}
            onChange={(event) => setVerifyCode(event.target.value)}
            disabled={!session}
          />
          <Button className="mt-3 w-full" onClick={verifyChallenge} disabled={!session || loading}>
            Verify
          </Button>
        </StepCard>

        <StepCard
          title="3. Restore kit"
          description="Upload encrypted blob + key"
          icon={<LockKeyhole className="h-5 w-5" />}
          active={step >= 2}
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadKit} disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Download kit
              </Button>
              <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload kit
                <input type="file" className="hidden" accept="text/plain" onChange={handleFileUpload} />
              </label>
            </div>
            <Input
              placeholder="Kit secret"
              value={kitUpload.key}
              onChange={(event) => setKitUpload((prev) => ({ ...prev, key: event.target.value }))}
            />
            <Button className="w-full" variant="secondary" onClick={rotateKeys} disabled={loading}>
              Rotate keys & restore
            </Button>
            {kit && (
              <p className="text-xs text-muted-foreground">
                Kit checksum {kit.checksum.slice(0, 12)}… ({kit.credentialCount} credentials)
              </p>
            )}
          </div>
        </StepCard>
      </section>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Anchor className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>4. Anchor recovery</CardTitle>
            <CardDescription>Chain receipt proving keys rotated + vault restored.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">DID {result.did}</Badge>
                <Badge variant="secondary">{result.restoredCredentials?.length ?? 0} credentials</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Anchor tx: <span className="font-mono">{result.anchor?.txHash ?? '—'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Session {result.sessionId ?? '—'} • kit checksum {kitUpload.blob ? hashPreview(kitUpload.blob) : 'n/a'}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete the steps above to generate a new DID, restore vault contents, and anchor the recovery.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function hashPreview(value: string) {
  return value.slice(0, 10)
}

function StepCard({
  title,
  description,
  icon,
  children,
  active,
  badge,
}: {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
  active?: boolean
  badge?: string
}) {
  return (
    <Card className={active ? 'border-primary/40 shadow-sm' : undefined}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full border p-2 text-muted-foreground">{icon}</div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

