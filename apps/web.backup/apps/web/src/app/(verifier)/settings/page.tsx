'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

const API_BASE =
  process.env.NEXT_PUBLIC_VERIFIER_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  ''

interface VerifierSettings {
  proofRequired: boolean
  updatedAt: string
}

export default function VerifierSettingsPage() {
  const [settings, setSettings] = useState<VerifierSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const endpoint = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/verify/settings` : null

  useEffect(() => {
    if (!endpoint) {
      setError('Configure NEXT_PUBLIC_VERIFIER_API_BASE to manage settings.')
      setLoading(false)
      return
    }
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const response = await fetch(endpoint)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load settings')
        }
        setSettings(data as VerifierSettings)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load settings.')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [endpoint])

  const handleToggle = async (value: boolean) => {
    if (!endpoint) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofRequired: value }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update setting')
      }
      setSettings(data as VerifierSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update setting.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <p className="text-sm text-muted-foreground">Verifier controls</p>
        <h1 className="text-3xl font-semibold tracking-tight">Proof requirements</h1>
        <p className="text-muted-foreground">
          Enforce cryptographic block proofs for every presentation submission.
        </p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading settings...</CardTitle>
            <CardDescription>Fetching verifier configuration.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Proof required mode
              </CardTitle>
              <CardDescription>
                {settings
                  ? `Updated ${new Date(settings.updatedAt).toLocaleString()}`
                  : 'Not configured'}
              </CardDescription>
            </div>
            <Badge variant="outline">{settings?.proofRequired ? 'Enabled' : 'Disabled'}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-semibold">Require chain proof</p>
                <p className="text-sm text-muted-foreground">
                  Reject presentations without block hash + merkle proof metadata.
                </p>
              </div>
              <Switch
                disabled={!endpoint || pending}
                checked={settings?.proofRequired ?? false}
                onCheckedChange={handleToggle}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-xs text-muted-foreground">
              When enabled, `/api/verify/presentation` will respond with 412 unless `chainProof`
              metadata is included.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}










