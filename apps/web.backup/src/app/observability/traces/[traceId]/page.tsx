'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Span = {
  id: string
  name: string
  service: string
  startTime: number
  duration: number
  parentId?: string
  tags: Record<string, string>
  logs?: Array<{ timestamp: number; fields: Record<string, string> }>
}

type Trace = {
  traceId: string
  spans: Span[]
  startTime: number
  duration: number
  serviceCount: number
  spanCount: number
}

export default function TraceViewerPage() {
  const params = useParams()
  const traceId = params.traceId as string
  const [loading, setLoading] = useState(true)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [viewMode, setViewMode] = useState<'waterfall' | 'flame'>('waterfall')
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [showRawJson, setShowRawJson] = useState(false)

  useEffect(() => {
    const fetchTrace = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Generate mock trace data
      const startTime = Date.now() - 1000
      const spans: Span[] = [
        {
          id: 'span-1',
          name: 'HTTP GET /api/v1/verify',
          service: 'api',
          startTime: startTime,
          duration: 450,
          tags: {
            'http.method': 'GET',
            'http.path': '/api/v1/verify',
            'http.status_code': '200',
          },
        },
        {
          id: 'span-2',
          name: 'verifyCredential',
          service: 'verifier-api',
          startTime: startTime + 50,
          duration: 320,
          parentId: 'span-1',
          tags: {
            'operation': 'verify',
            'credential.type': 'employment',
          },
        },
        {
          id: 'span-3',
          name: 'checkRevocation',
          service: 'api',
          startTime: startTime + 70,
          duration: 120,
          parentId: 'span-2',
          tags: {
            'operation': 'check',
            'source': 'database',
          },
        },
        {
          id: 'span-4',
          name: 'queryDatabase',
          service: 'api',
          startTime: startTime + 85,
          duration: 80,
          parentId: 'span-3',
          tags: {
            'db.system': 'postgresql',
            'db.query': 'SELECT * FROM credentials',
          },
        },
        {
          id: 'span-5',
          name: 'validateSignature',
          service: 'verifier-api',
          startTime: startTime + 200,
          duration: 90,
          parentId: 'span-2',
          tags: {
            'operation': 'validate',
            'algorithm': 'EdDSA',
          },
        },
        {
          id: 'span-6',
          name: 'checkAuditLog',
          service: 'api',
          startTime: startTime + 350,
          duration: 60,
          parentId: 'span-1',
          tags: {
            'operation': 'audit',
            'event.type': 'verification',
          },
        },
      ]

      const totalDuration = Math.max(...spans.map((s) => s.startTime + s.duration)) - startTime

      setTrace({
        traceId,
        spans,
        startTime,
        duration: totalDuration,
        serviceCount: new Set(spans.map((s) => s.service)).size,
        spanCount: spans.length,
      })

      // Expand all by default
      setExpandedSpans(new Set(spans.map((s) => s.id)))
      setLoading(false)
    }

    fetchTrace()
  }, [traceId])

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  const getChildSpans = (parentId: string) => {
    return trace?.spans.filter((s) => s.parentId === parentId) || []
  }

  const getRootSpans = () => {
    return trace?.spans.filter((s) => !s.parentId) || []
  }

  const renderWaterfallSpan = (span: Span, depth: number = 0) => {
    const children = getChildSpans(span.id)
    const isExpanded = expandedSpans.has(span.id)
    const hasChildren = children.length > 0
    const startPercent = ((span.startTime - (trace?.startTime || 0)) / (trace?.duration || 1)) * 100
    const widthPercent = (span.duration / (trace?.duration || 1)) * 100

    if (searchTerm && !span.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !span.service.toLowerCase().includes(searchTerm.toLowerCase())) {
      return null
    }

    return (
      <div key={span.id} className="relative">
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 border-b hover:bg-muted/50 transition-colors',
            depth > 0 && 'pl-8'
          )}
          style={{ paddingLeft: `${depth * 2 + 0.75}rem` }}
        >
          <div className="w-48 flex-shrink-0">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleSpan(span.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            <span className="font-mono text-xs">{span.service}</span>
          </div>
          <div className="flex-1 min-w-0 relative h-8">
            <div
              className={cn(
                'absolute h-6 rounded bg-primary/80 hover:bg-primary transition-colors',
                'flex items-center justify-between px-2 text-xs text-white font-medium'
              )}
              style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
                minWidth: widthPercent < 2 ? '2%' : undefined,
              }}
            >
              <span className="truncate">{span.name}</span>
              <span className="ml-2 flex-shrink-0">{span.duration}ms</span>
            </div>
          </div>
          <div className="w-24 text-right text-xs text-muted-foreground">
            {span.duration}ms
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderWaterfallSpan(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const copyTraceId = () => {
    navigator.clipboard.writeText(traceId)
  }

  const exportTrace = () => {
    if (!trace) return
    const json = JSON.stringify(trace, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trace-${traceId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!trace) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Trace not found</p>
            <Link href="/observability/traces">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Traces
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
          <Link href="/observability/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Trace Viewer</h1>
              <Badge variant="outline" className="font-mono">{traceId.slice(0, 16)}...</Badge>
              <Button variant="ghost" size="sm" onClick={copyTraceId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-muted-foreground">
              {trace.serviceCount} services • {trace.spanCount} spans • {trace.duration}ms duration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search spans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportTrace}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <div className="flex items-center gap-2 border rounded-md px-2 py-1">
              <span className="text-sm text-muted-foreground">Waterfall</span>
              <Switch checked={viewMode === 'flame'} onCheckedChange={(checked) => setViewMode(checked ? 'flame' : 'waterfall')} />
              <span className="text-sm text-muted-foreground">Flame</span>
            </div>
            <Switch
              checked={showRawJson}
              onCheckedChange={setShowRawJson}
              id="raw-json"
            />
            <label htmlFor="raw-json" className="text-sm text-muted-foreground">
              Raw JSON
            </label>
          </div>
        </div>
      </header>

      {showRawJson ? (
        <Card>
          <CardHeader>
            <CardTitle>Raw Trace JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(trace, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Timeline Header */}
          <Card>
            <CardHeader>
              <CardTitle>Trace Timeline</CardTitle>
              <CardDescription>Waterfall visualization of span execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 border rounded-md">
                <div className="flex items-center gap-2 py-2 px-3 border-b bg-muted/50">
                  <div className="w-48 font-semibold text-sm">Service</div>
                  <div className="flex-1 text-sm font-semibold">Timeline</div>
                  <div className="w-24 text-right text-sm font-semibold">Duration</div>
                </div>
                {getRootSpans().map((span) => renderWaterfallSpan(span))}
              </div>
            </CardContent>
          </Card>

          {/* Span Details */}
          {trace.spans.filter((span) =>
            !searchTerm || span.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            span.service.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((span) => {
            const isExpanded = expandedSpans.has(`detail-${span.id}`)
            return (
              <Card key={`detail-${span.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{span.name}</CardTitle>
                      <CardDescription>
                        {span.service} • {span.duration}ms • {new Date(span.startTime).toLocaleTimeString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSpan(`detail-${span.id}`)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(span.tags).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="font-mono text-xs">
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {span.logs && span.logs.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Logs</h4>
                          <div className="space-y-2">
                            {span.logs.map((log, idx) => (
                              <div key={idx} className="bg-muted p-2 rounded text-xs font-mono">
                                <div className="text-muted-foreground">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </div>
                                {Object.entries(log.fields).map(([key, value]) => (
                                  <div key={key}>
                                    {key}: {value}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

