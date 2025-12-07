'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { KeyRound, Loader2, Server } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { SignatureMethod } from '@/lib/issuer/types'

interface SignatureState {
  method: SignatureMethod
  updatedAt: string
}

const OPTIONS: Array<{
  value: SignatureMethod
  title: string
  description: string
  icon: typeof KeyRound
}> = [
  {
    value: 'ed25519-local',
    title: 'Ed25519 local key',
    description: 'Use the embedded Ed25519 keypair for offline signing.',
    icon: KeyRound,
  },
  {
    value: 'kms-managed',
    title: 'KMS managed key',
    description: 'Delegate signing to the organization KMS enclave.',
    icon: Server,
  },
]

export default function SignatureMethodSelector() {
  const params = useParams<{ id: string }>()
  const claimId = params?.id
  const [state, setState] = useState<SignatureState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchState = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/issuer/sign-method')
        const data = (await response.json()) as SignatureState & { error?: string }
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load signature method')
        }
        setState(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load method.')
      } finally {
        setLoading(false)
      }
    }
    fetchState()
  }, [])

  const handleChange = async (value: SignatureMethod) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/issuer/sign-method', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: value }),
      })
      const data = (await response.json()) as SignatureState & { error?: string }
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update method')
      }
      setState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update method.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Claim {claimId}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Issuer signature method</h1>
        <p className="text-muted-foreground">
          Pick the signing substrate for ACA-Py and browser-triggered credentials.
        </p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading method...</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing signature options
          </CardContent>
        </Card>
      ) : state ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Active method</CardTitle>
              <CardDescription>
                Last updated {new Date(state.updatedAt).toLocaleString()}
              </CardDescription>
            </div>
            <Badge variant="outline">{state.method}</Badge>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.method}
              onValueChange={(value) => handleChange(value as SignatureMethod)}
              className="grid gap-4 md:grid-cols-2"
            >
              {OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className="cursor-pointer rounded-lg border p-4 transition hover:border-foreground"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold">{option.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </Label>
              ))}
            </RadioGroup>
            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Changes propagate immediately across ACA-Py and SD-JWT issuance flows.
              </p>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving selection...
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleChange(state.method)}>
                  Re-sync configuration
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}










