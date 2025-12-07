"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts"
import { Activity, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import Link from "next/link"

interface FailureMode {
  mode: "temporal" | "missing" | "contradictory"
  count: number
  percentage: number
  examples: Array<{
    id: string
    description: string
    resourceLink?: string
  }>
}

interface HistogramData {
  bucket: string
  count: number
}

interface AgentBenchMetrics {
  vpBytes: {
    histogram: HistogramData[]
    mean: number
    p50: number
    p95: number
    p99: number
  }
  latency: {
    histogram: HistogramData[]
    mean: number
    p50: number
    p95: number
    p99: number
  }
  failureModes: FailureMode[]
  totalRuns: number
  successRate: number
}

export default function AgentBenchDashboard() {
  const [metrics, setMetrics] = useState<AgentBenchMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - replace with actual API call
    const fetchMetrics = async () => {
      try {
        // const response = await fetch('/api/agentbench/metrics');
        // const data = await response.json();
        // setMetrics(data);

        // Mock data
        setTimeout(() => {
          setMetrics({
            vpBytes: {
              histogram: [
                { bucket: "0-1KB", count: 45 },
                { bucket: "1-5KB", count: 120 },
                { bucket: "5-10KB", count: 85 },
                { bucket: "10-50KB", count: 30 },
                { bucket: "50KB+", count: 5 },
              ],
              mean: 8500,
              p50: 5200,
              p95: 18000,
              p99: 35000,
            },
            latency: {
              histogram: [
                { bucket: "0-100ms", count: 150 },
                { bucket: "100-500ms", count: 200 },
                { bucket: "500ms-1s", count: 80 },
                { bucket: "1-2s", count: 30 },
                { bucket: "2s+", count: 5 },
              ],
              mean: 420,
              p50: 280,
              p95: 1200,
              p99: 2100,
            },
            failureModes: [
              {
                mode: "temporal",
                count: 12,
                percentage: 2.6,
                examples: [
                  {
                    id: "ex-1",
                    description: "Date mismatch: License issued date after expiration date",
                    resourceLink: "/resources/temporal-example-1.jsonl",
                  },
                  {
                    id: "ex-2",
                    description: "Timeline inconsistency: Education completed before birth date",
                  },
                ],
              },
              {
                mode: "missing",
                count: 8,
                percentage: 1.7,
                examples: [
                  {
                    id: "ex-3",
                    description: "Required field 'licenseNumber' missing from credential",
                    resourceLink: "/resources/missing-example-1.jsonl",
                  },
                  {
                    id: "ex-4",
                    description: "Issuer DID not present in credential proof",
                  },
                ],
              },
              {
                mode: "contradictory",
                count: 15,
                percentage: 3.3,
                examples: [
                  {
                    id: "ex-5",
                    description: "NPI mismatch: Credential NPI differs from verified NPI",
                    resourceLink: "/resources/contradictory-example-1.jsonl",
                  },
                  {
                    id: "ex-6",
                    description: "Specialty conflict: Multiple conflicting specialty claims",
                  },
                ],
              },
            ],
            totalRuns: 465,
            successRate: 92.4,
          })
          setLoading(false)
        }, 500)
      } catch (error) {
        console.error("Failed to fetch AgentBench metrics:", error)
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12 text-muted-foreground">Loading AgentBench metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12 text-muted-foreground">No metrics available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Activity className="h-8 w-8" />
          AgentBench Dashboard
        </h1>
        <p className="text-muted-foreground">
          FHIR-AgentBench performance metrics and failure mode analysis
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalRuns.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {metrics.successRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Failure Modes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {metrics.failureModes.reduce((sum, mode) => sum + mode.count, 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {(
                (metrics.failureModes.reduce((sum, mode) => sum + mode.count, 0) /
                  metrics.totalRuns) *
                100
              ).toFixed(1)}
              % of runs
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="histograms" className="space-y-6">
        <TabsList>
          <TabsTrigger value="histograms">Histograms</TabsTrigger>
          <TabsTrigger value="failures">Failure Modes</TabsTrigger>
        </TabsList>

        <TabsContent value="histograms" className="space-y-6">
          {/* VP Bytes Histogram */}
          <Card>
            <CardHeader>
              <CardTitle>VP Bytes Distribution</CardTitle>
              <CardDescription>
                Histogram of Verifiable Presentation sizes (Prometheus metrics)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.vpBytes.histogram}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">Mean</div>
                    <div className="text-lg font-semibold">
                      {(metrics.vpBytes.mean / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P50</div>
                    <div className="text-lg font-semibold">
                      {(metrics.vpBytes.p50 / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P95</div>
                    <div className="text-lg font-semibold">
                      {(metrics.vpBytes.p95 / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P99</div>
                    <div className="text-lg font-semibold">
                      {(metrics.vpBytes.p99 / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Latency Histogram */}
          <Card>
            <CardHeader>
              <CardTitle>Latency Distribution</CardTitle>
              <CardDescription>
                Histogram of request latency in milliseconds (Prometheus metrics)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.latency.histogram}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">Mean</div>
                    <div className="text-lg font-semibold">{metrics.latency.mean}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P50</div>
                    <div className="text-lg font-semibold">{metrics.latency.p50}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P95</div>
                    <div className="text-lg font-semibold">{metrics.latency.p95}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">P99</div>
                    <div className="text-lg font-semibold">{metrics.latency.p99}ms</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="space-y-6">
          {metrics.failureModes.map((mode) => (
            <Card key={mode.mode}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="capitalize">{mode.mode} Failures</CardTitle>
                    <CardDescription>
                      {mode.count} occurrences ({mode.percentage.toFixed(1)}% of runs)
                    </CardDescription>
                  </div>
                  <Badge
                    variant={mode.count > 10 ? "destructive" : mode.count > 5 ? "default" : "secondary"}
                  >
                    {mode.count} failures
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Example Cases:</h4>
                  {mode.examples.map((example) => (
                    <div
                      key={example.id}
                      className="p-3 rounded-lg border bg-muted/50 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm">{example.description}</p>
                        {example.resourceLink && (
                          <Link
                            href={example.resourceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View resource
                          </Link>
                        )}
                      </div>
                      {mode.mode === "temporal" && (
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      )}
                      {mode.mode === "missing" && (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                      {mode.mode === "contradictory" && (
                        <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

