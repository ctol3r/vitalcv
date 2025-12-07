'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Anchor, Box, Server } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_VERIFIER_API_BASE || ''

interface BlockProofResponse {
  eventId: string
  blockHash: string
  merklePath: string[]
  palletName?: string
  eventType: string
  timestamp: string
}

export default function WalletProofViewer() {
  const params = useParams<{ eventId: string }>()
  const eventId = params?.eventId
  const [proof, setProof] = useState<BlockProofResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId) return
    if (!API_BASE) {
      setError('Configure NEXT_PUBLIC_API_BASE to fetch chain proofs.')
      setLoading(false)
      return
    }
    const fetchProof = async () => {
      setLoading(true)
      setError(null)
      try {
        const base = API_BASE.replace(/\/$/, '')
        const response = await fetch(`${base}/api/proof/${eventId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to fetch chain proof')
        }
        setProof(data as BlockProofResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch proof.')
      } finally {
        setLoading(false)
      }
    }
    fetchProof()
  }, [eventId])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Wallet / Chain proof</p>
        <h1 className="text-3xl font-semibold tracking-tight">Event {eventId}</h1>
        <p className="text-muted-foreground">
          Inspect the on-chain anchor for your credential presentation.
        </p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Resolving proof...</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Querying node</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load proof</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : proof ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="h-4 w-4" />
                  Block anchor
                </CardTitle>
                <CardDescription>{new Date(proof.timestamp).toLocaleString()}</CardDescription>
              </div>
              <Badge variant="outline">{proof.eventType}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Block hash</p>
                <p className="font-mono text-xs break-all">{proof.blockHash}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Anchor tx</p>
                <p className="font-mono text-xs break-all">{proof.blockHash.slice(0, 42)}...</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pallet</p>
                <p>{proof.palletName ?? 'audit.scrapbook'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Merkle path
              </CardTitle>
              <CardDescription>Branches linking tx to block root</CardDescription>
            </CardHeader>
            <CardContent>
              {proof.merklePath.length === 0 ? (
                <p className="text-sm text-muted-foreground">No merkle proof provided.</p>
              ) : (
                <div className="space-y-3">
                  {proof.merklePath.map((node, index) => (
                    <div key={`${node}-${index}`} className="rounded-md border p-3">
                      <p className="text-xs uppercase text-muted-foreground">Node {index + 1}</p>
                      <p className="font-mono text-xs break-all">{node}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {proof ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Event metadata
            </CardTitle>
            <CardDescription>Includes pallet + timestamp details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Event id</span>
              <span className="font-mono">{proof.eventId}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span>Network</span>
              <span>{API_BASE ? new URL(API_BASE).hostname : 'pilot-l2'}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

