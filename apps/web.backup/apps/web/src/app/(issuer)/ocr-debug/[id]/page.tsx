'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Eye, ShieldCheck, Target, ZoomIn } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'

interface Overlay {
  label: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  source: 'template' | 'document'
}

interface OcrDebugCase {
  id: string
  imageUrl: string
  dpi: number
  fileSizeKb: number
  template: {
    name: string
    state: string
    version: string
    confidence: number
    source: 'tefca' | 'manual'
  }
  extractedFields: Array<{ label: string; value: string | null; confidence: number; method: 'keypoint' | 'regex' }>
  anomalies: Array<{ code: string; severity: 'low' | 'medium' | 'high'; message: string }>
  overlays: Overlay[]
  detectedAt: string
}

const SAMPLE_CASES: Record<string, OcrDebugCase> = {
  'case-147': {
    id: 'case-147',
    imageUrl: 'https://images.unsplash.com/photo-1521790361543-f645cf042ec4?auto=format&fit=crop&w=1200&q=80',
    dpi: 300,
    fileSizeKb: 512,
    template: {
      name: 'CA Board Compact Template',
      state: 'CA',
      version: 'v4.1',
      confidence: 0.93,
      source: 'tefca',
    },
    extractedFields: [
      { label: 'License number', value: 'CA-237662', confidence: 0.96, method: 'keypoint' },
      { label: 'Expiration date', value: '2026-02-28', confidence: 0.87, method: 'keypoint' },
      { label: 'State', value: 'CA', confidence: 0.91, method: 'keypoint' },
      { label: 'Holder name', value: 'Dr. Amara Chen', confidence: 0.84, method: 'regex' },
    ],
    anomalies: [
      { code: 'keypoint_drift', severity: 'medium', message: 'Keypoint overlap 62% vs baseline 80%' },
      { code: 'keypoint_missing', severity: 'low', message: 'Holder name parsed via regex fallback' },
    ],
    overlays: [
      { label: 'License number', bbox: { x: 0.1, y: 0.15, width: 0.3, height: 0.08 }, confidence: 0.95, source: 'document' },
      { label: 'Expiration date', bbox: { x: 0.1, y: 0.28, width: 0.28, height: 0.08 }, confidence: 0.88, source: 'document' },
      { label: 'Template anchor', bbox: { x: 0.05, y: 0.12, width: 0.35, height: 0.25 }, confidence: 0.4, source: 'template' },
    ],
    detectedAt: '2025-11-18T15:05:00Z',
  },
}

export default function OcrDebugPage() {
  const params = useParams<{ id: string }>()
  const [showTemplateOverlay, setShowTemplateOverlay] = useState(true)
  const [showDetectedOverlay, setShowDetectedOverlay] = useState(true)

  const debugCase = SAMPLE_CASES[params?.id ?? 'case-147'] ?? SAMPLE_CASES['case-147']
  const templateOverlays = useMemo(
    () => debugCase.overlays.filter((overlay) => overlay.source === 'template'),
    [debugCase],
  )
  const detectedOverlays = useMemo(
    () => debugCase.overlays.filter((overlay) => overlay.source === 'document'),
    [debugCase],
  )

  return (
    <div className="space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Issuer &raquo; OCR Debug &raquo; {debugCase.id}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">OCR debug viewer</h1>
          <Badge variant="outline" className="gap-1">
            <Eye className="h-3.5 w-3.5" />
            Analyst assist
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Inspect template detection, extracted fields, anomaly signals, and bounding-box overlays for license ingestion events.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Document viewer
            </CardTitle>
            <CardDescription>Overlay template anchors and detected keypoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showTemplateOverlay} onCheckedChange={setShowTemplateOverlay} />
                Template anchors
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showDetectedOverlay} onCheckedChange={setShowDetectedOverlay} />
                Detected keypoints
              </label>
            </div>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border">
              <Image
                src={debugCase.imageUrl}
                alt="Uploaded license"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 70vw"
              />
              {[showTemplateOverlay ? templateOverlays : [], showDetectedOverlay ? detectedOverlays : []]
                .flat()
                .map((overlay) => (
                  <div
                    key={`${overlay.label}-${overlay.source}`}
                    className={`absolute rounded border text-xs font-semibold ${
                      overlay.source === 'template' ? 'border-blue-400 text-blue-400' : 'border-emerald-400 text-emerald-400'
                    }`}
                    style={{
                      left: `${overlay.bbox.x * 100}%`,
                      top: `${overlay.bbox.y * 100}%`,
                      width: `${overlay.bbox.width * 100}%`,
                      height: `${overlay.bbox.height * 100}%`,
                    }}
                  >
                    <span className="absolute left-0 top-0 rounded-br bg-background/80 px-1 py-0.5">
                      {overlay.label} · {(overlay.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
            <div className="text-xs text-muted-foreground">
              DPI {debugCase.dpi} · {debugCase.fileSizeKb} KB · Detected at {new Date(debugCase.detectedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template detection</CardTitle>
            <CardDescription>Classifier confidence and source provenance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold">{debugCase.template.name}</div>
              <div className="text-sm text-muted-foreground">
                State {debugCase.template.state} · Version {debugCase.template.version}
              </div>
              <Badge variant="outline" className="w-fit gap-1 border-primary/30 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {(debugCase.template.confidence * 100).toFixed(1)}% confidence
              </Badge>
              <p className="text-sm text-muted-foreground">
                Sourced via {debugCase.template.source === 'tefca' ? 'TEFCA-aligned exchange' : 'manual upload'}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Extracted fields</CardTitle>
            <CardDescription>Keypoint vs regex provenance with confidence scores.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debugCase.extractedFields.map((field) => (
                  <TableRow key={field.label}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell>{field.value ?? '—'}</TableCell>
                    <TableCell>{(field.confidence * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Badge variant={field.method === 'keypoint' ? 'outline' : 'secondary'}>
                        {field.method === 'keypoint' ? 'Keypoint' : 'Regex fallback'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anomaly signals</CardTitle>
            <CardDescription>Fraud and quality heuristics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {debugCase.anomalies.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                No anomalies flagged.
              </div>
            ) : (
              debugCase.anomalies.map((anomaly) => (
                <div
                  key={anomaly.code}
                  className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                    anomaly.severity === 'high'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : anomaly.severity === 'medium'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-semibold uppercase text-xs tracking-wide">{anomaly.code}</p>
                    <p>{anomaly.message}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}










