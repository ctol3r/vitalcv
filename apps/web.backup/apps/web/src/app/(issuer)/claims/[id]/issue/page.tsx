'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Network, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import type { AriesIssuanceResult, IssuerClaim } from '@/lib/issuer/types'

export default function AriesIssuancePanel() {
  const params = useParams<{ id: string }>()
  const claimId = params?.id
  const [claim, setClaim] = useState<IssuerClaim | null>(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [result, setResult] = useState<AriesIssuanceResult | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!claimId) return
    const fetchClaim = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/issuer/claims?claimId=${claimId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load claim')
        }
        setClaim(data.claim as IssuerClaim)
      } catch (error) {
        toast({
          title: 'Failed to load claim',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    fetchClaim()
  }, [claimId, toast])

  const handleIssue = async () => {
    if (!claimId) return
    setIssuing(true)
    setResult(null)
    try {
      const response = await fetch(`/api/issuer/issue/aries/${claimId}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'ACA-Py issuance failed')
      }
      setResult(data as AriesIssuanceResult)
      toast({
        title: 'Issued via ACA-Py',
        description: `Anchor ${data.anchorTx.slice(0, 12)}…`,
      })
    } catch (error) {
      toast({
        title: 'Issuance failed',
        description: error instanceof Error ? error.message : 'Unable to issue via ACA-Py.',
        variant: 'destructive',
      })
    } finally {
      setIssuing(false)
    }
  }

  const steps = useMemo(() => {
    if (!result) return []
    return [
      {
        title: 'Credential built',
        description: 'VC payload minted from PSV bundle.',
        complete: true,
      },
      {
        title: 'ACA-Py DIDComm',
        description: `Invitation ${result.connectionId} delivered.`,
        complete: true,
      },
      {
        title: 'Chain anchor',
        description: `Tx ${result.anchorTx.slice(0, 12)}…`,
        complete: true,
      },
    ]
  }, [result])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/issuer/claims" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to claims
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">ACA-Py issuance</span>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading claim...</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing ACA-Py payload
          </CardContent>
        </Card>
      ) : claim ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-2xl">{claim.clinicianName}</CardTitle>
                <CardDescription className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>NPI {claim.npi}</span>
                  <span>•</span>
                  <span>{claim.specialty}</span>
                </CardDescription>
              </div>
              <Badge variant="outline">{claim.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>License {claim.autoParsed.license.state}</p>
                <p>Board {claim.autoParsed.board.name}</p>
                <p>Risk score {(claim.riskScore * 100).toFixed(0)}%</p>
              </div>
              <Button
                onClick={handleIssue}
                disabled={issuing || claim.status === 'issued' || !claim.psv}
              >
                {issuing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Issuing via ACA-Py
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Issue via ACA-Py
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Issuance timeline
                </CardTitle>
                <CardDescription>
                  Delivered {new Date(result.deliveredAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-semibold">{index + 1}. {step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Invitation URL:{' '}
                  <a className="underline" href={result.invitationUrl} target="_blank" rel="noreferrer">
                    {result.invitationUrl}
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

