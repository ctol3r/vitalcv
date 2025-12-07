'use client'

import { type ReactNode, useState } from 'react'
import { AlertTriangle, Anchor, CheckCircle2, Copy, FileText, Loader2, Share2, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

type EvidencePackType = 'ncqa-cr' | 'dea-mate' | 'tjc-psv'

type EvidenceDelta = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  detectedAt: string
  details?: Record<string, unknown> | null
}

type AnchorSummary = {
  type: string
  txHash: string
  network: string
  timestamp: string
  merkleRoot: string
}

type EvidenceManifest = {
  hash: string
  formatVersion: string
  packId: string
  packType: string
  generatedAt: string
  clinician: {
    id: string
    orgId: string | null
    name: string | null
    email: string | null
    npi: string | null
    state: string | null
  }
  summary: {
    itemCount: number
    warningCount: number
    deltaCodes: string[]
    latestAnchor?: string | null
  }
  items: Array<{
    key: string
    label: string
    type: string
    capturedAt: string | null
    source: string
    hash: string
  }>
  warnings: EvidenceDelta[]
  anchors: AnchorSummary[]
}

type EvidenceShareResponse = {
  shareId: string
  shareToken: string
  shareUrl: string | null
  expiresAt: string
  packId: string
  packType: EvidencePackType
  manifest: EvidenceManifest
  manifestYaml: string
  warnings: EvidenceDelta[]
  anchors: AnchorSummary[]
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.API_BASE_URL ??
  ''

export default function IssuerEvidenceExportPage() {
  const { toast } = useToast()
  const [clinicianId, setClinicianId] = useState('')
  const [recipientOrgId, setRecipientOrgId] = useState('')
  const [packType, setPackType] = useState<EvidencePackType>('ncqa-cr')
  const [expiresInHours, setExpiresInHours] = useState('24')
  const [notes, setNotes] = useState('Automated compliance export for auditor review.')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EvidenceShareResponse | null>(null)

  const handleGenerate = async () => {
    if (!clinicianId.trim()) {
      toast({
        title: 'Clinician ID required',
        description: 'Enter the clinician identifier before generating a pack.',
        variant: 'destructive',
      })
      return
    }

    if (!API_BASE) {
      toast({
        title: 'API base URL missing',
        description: 'Set NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_API_BASE_URL to call the API.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/compliance/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId: clinicianId.trim(),
          packType,
          recipientOrgId: recipientOrgId.trim() || undefined,
          expiresInHours: Number(expiresInHours) || undefined,
          notes,
        }),
      })

      const payload = (await response.json()) as EvidenceShareResponse & { error?: string; message?: string }
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Unable to generate evidence pack.')
      }

      setResult(payload)
      toast({
        title: 'Evidence pack ready',
        description: 'Share link and manifest generated successfully.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while generating pack.')
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unable to generate evidence pack.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value)
    toast({ title: 'Copied', description: message })
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Issuer • Compliance</p>
        <h1 className="text-3xl font-semibold tracking-tight">Evidence export & share</h1>
        <p className="text-muted-foreground max-w-3xl">
          Generate machine-readable NCQA, DEA/MATE, or Joint Commission packs directly from audit evidence and share them with downstream
          auditors. Each pack contains hashed manifests, anchor proofs, and evidence deltas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Share configuration</CardTitle>
          <CardDescription>Pick the pack you need, recipient, and TTL. All exports are anchored automatically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clinician">Clinician ID</Label>
            <Input
              id="clinician"
              placeholder="CLN-1234"
              value={clinicianId}
              onChange={(event) => setClinicianId(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="packType">Pack Type</Label>
            <Select value={packType} onValueChange={(value) => setPackType(value as EvidencePackType)}>
              <SelectTrigger id="packType" aria-label="Select evidence pack">
                <SelectValue placeholder="Select pack" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ncqa-cr">NCQA CR1–CR5</SelectItem>
                <SelectItem value="dea-mate">DEA / MATE compliance</SelectItem>
                <SelectItem value="tjc-psv">Joint Commission PSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient org (optional)</Label>
            <Input
              id="recipient"
              placeholder="ORG-789"
              value={recipientOrgId}
              onChange={(event) => setRecipientOrgId(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ttl">Expires in</Label>
            <Select value={expiresInHours} onValueChange={setExpiresInHours}>
              <SelectTrigger id="ttl">
                <SelectValue placeholder="24 hours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">72 hours</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Context for auditors</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes describing what changed or why the pack is being shared."
              rows={3}
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {error ? <p className="text-sm text-destructive">Error: {error}</p> : <span className="text-sm text-muted-foreground">Share links automatically hash manifests with eventType evidencePackAnchored.</span>}
            <Button onClick={handleGenerate} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Generate pack
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <section className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Share link</CardTitle>
                <CardDescription>Hash: {result.manifest.hash.slice(0, 16)}…</CardDescription>
              </div>
              <Badge variant="secondary" className="uppercase">
                {result.packType}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
                  title="Items"
                  value={result.manifest.summary.itemCount.toString()}
                  description="Evidence artifacts hashed inside the manifest."
                />
                <StatCard
                  icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                  title="Warnings"
                  value={result.manifest.summary.warningCount.toString()}
                  description="Detected deltas (CME, licensure, sanctions)."
                />
                <StatCard
                  icon={<Anchor className="h-5 w-5 text-sky-500" />}
                  title="Anchors"
                  value={result.manifest.anchors.length.toString()}
                  description="Latest audit/chain anchor references."
                />
                <StatCard
                  icon={<CheckCircle2 className="h-5 w-5 text-violet-500" />}
                  title="Expires"
                  value={formatDate(result.expiresAt)}
                  description="After expiry, regenerate to share again."
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <Label>Share URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={result.shareUrl ?? 'No public URL available – configure EVIDENCE_SHARE_BASE_URL.'}
                    className="font-mono text-sm"
                  />
                  {result.shareUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(result.shareUrl!, 'Share URL copied to clipboard.')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly value={result.shareToken} className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(result.shareToken, 'Share token copied to clipboard.')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence manifest</CardTitle>
              <CardDescription>Machine-readable summary (JSON + YAML) for auditors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="rounded-md border bg-muted/40 p-4">
                <pre className="text-sm font-mono text-muted-foreground">{JSON.stringify(result.manifest, null, 2)}</pre>
              </ScrollArea>
              <div className="flex items-center justify-between">
                <Label>YAML</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(result.manifestYaml, 'YAML manifest copied.')}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy YAML
                </Button>
              </div>
              <ScrollArea className="rounded-md border bg-muted/40 p-4">
                <pre className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{result.manifestYaml}</pre>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence items</CardTitle>
              <CardDescription>Latest hashed entries included in this pack.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Captured</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.manifest.items.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.capturedAt ? formatDate(item.capturedAt) : '—'}</TableCell>
                      <TableCell>{item.source}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.hash.slice(0, 16)}…
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evidence deltas</CardTitle>
                <CardDescription>Automated detector for CME, licensure, sanctions freshness.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.warnings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No outstanding deltas detected.</p>
                )}
                {result.warnings.map((warning) => (
                  <div
                    key={warning.code + warning.detectedAt}
                    className="rounded-md border p-3"
                    data-severity={warning.severity}
                  >
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="capitalize">{warning.code.replace(/_/g, ' ')}</span>
                      <Badge variant={warning.severity === 'critical' ? 'destructive' : 'secondary'}>{warning.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{warning.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">Detected {formatDate(warning.detectedAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chain anchors</CardTitle>
                <CardDescription>Recent anchor events linked to this pack.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.anchors.length === 0 && (
                  <p className="text-sm text-muted-foreground">No anchors recorded yet for this clinician.</p>
                )}
                {result.anchors.map((anchor) => (
                  <div key={anchor.txHash} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{anchor.type}</span>
                      <Badge variant="outline">{anchor.network}</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mt-1">{anchor.txHash.slice(0, 24)}…</p>
                    <p className="text-xs text-muted-foreground mt-1">Anchored {formatDate(anchor.timestamp)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon, title, value, description }: { icon: ReactNode; title: string; value: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-muted p-2">{icon}</div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

