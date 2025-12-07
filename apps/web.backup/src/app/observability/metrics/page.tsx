'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Download,
  Gauge,
  LineChart,
  Save,
  Search,
  TrendingUp,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type MetricQuery = {
  id: string
  name: string
  metric: string
  tags: Record<string, string>
  chartType: 'line' | 'bar' | 'area' | 'gauge'
  timeRange: string
  data: Array<{ timestamp: string; value: number }>
}

type MetricSuggestion = {
  name: string
  description: string
  tags: string[]
}

export default function MetricsExplorerPage() {
  const [loading, setLoading] = useState(false)
  const [queries, setQueries] = useState<MetricQuery[]>([])
  const [activeQuery, setActiveQuery] = useState<MetricQuery | null>(null)
  const [metricSuggestions, setMetricSuggestions] = useState<MetricSuggestion[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMetric, setSelectedMetric] = useState('')
  const [selectedTags, setSelectedTags] = useState<Record<string, string>>({})
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area' | 'gauge'>('line')
  const [timeRange, setTimeRange] = useState('1h')

  useEffect(() => {
    // Load saved queries
    const savedQueries = loadSavedQueries()
    if (savedQueries.length > 0) {
      setQueries(savedQueries)
      setActiveQuery(savedQueries[0])
    }

    // Load metric suggestions
    setMetricSuggestions([
      {
        name: 'http_requests_total',
        description: 'Total HTTP requests',
        tags: ['method', 'route', 'status'],
      },
      {
        name: 'http_request_duration_seconds',
        description: 'HTTP request duration',
        tags: ['method', 'route'],
      },
      {
        name: 'error_rate',
        description: 'Error rate percentage',
        tags: ['service', 'route'],
      },
      {
        name: 'queue_depth',
        description: 'Queue depth',
        tags: ['queue_name'],
      },
      {
        name: 'cpu_usage',
        description: 'CPU usage percentage',
        tags: ['service'],
      },
    ])
  }, [])

  const loadSavedQueries = (): MetricQuery[] => {
    // Load from localStorage or API
    const saved = localStorage.getItem('metrics_queries')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  }

  const saveQueries = (newQueries: MetricQuery[]) => {
    localStorage.setItem('metrics_queries', JSON.stringify(newQueries))
  }

  const executeQuery = async () => {
    if (!selectedMetric) return

    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock data
    const now = Date.now()
    const data: Array<{ timestamp: string; value: number }> = []
    const points = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : timeRange === '24h' ? 1440 : 2880
    const interval = timeRange === '1h' ? 60 * 1000 : timeRange === '6h' ? 10 * 60 * 1000 : timeRange === '24h' ? 60 * 60 * 1000 : 60 * 60 * 1000

    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now - i * interval).toISOString()
      data.push({
        timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        value: Math.floor(Math.random() * 1000) + 500,
      })
    }

    const newQuery: MetricQuery = {
      id: `query-${Date.now()}`,
      name: `${selectedMetric}${Object.keys(selectedTags).length > 0 ? ' with tags' : ''}`,
      metric: selectedMetric,
      tags: selectedTags,
      chartType,
      timeRange,
      data,
    }

    const updatedQueries = [...queries, newQuery]
    setQueries(updatedQueries)
    setActiveQuery(newQuery)
    saveQueries(updatedQueries)
    setLoading(false)
  }

  const deleteQuery = (queryId: string) => {
    const updatedQueries = queries.filter((q) => q.id !== queryId)
    setQueries(updatedQueries)
    saveQueries(updatedQueries)
    if (activeQuery?.id === queryId) {
      setActiveQuery(updatedQueries.length > 0 ? updatedQueries[0] : null)
    }
  }

  const filteredSuggestions = metricSuggestions.filter((suggestion) =>
    suggestion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const renderChart = (query: MetricQuery) => {
    if (!query.data || query.data.length === 0) return null

    const commonProps = {
      data: query.data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }

    switch (query.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="timestamp" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
            </RechartsLineChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="timestamp" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="timestamp" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'gauge':
        const latestValue = query.data[query.data.length - 1]?.value || 0
        const maxValue = Math.max(...query.data.map((d) => d.value))
        const percentage = (latestValue / maxValue) * 100
        return (
          <div className="flex flex-col items-center justify-center h-96">
            <div className="relative w-64 h-64">
              <svg className="transform -rotate-90 w-64 h-64">
                <circle
                  cx="128"
                  cy="128"
                  r="112"
                  stroke="hsl(var(--muted))"
                  strokeWidth="16"
                  fill="none"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="112"
                  stroke="hsl(var(--primary))"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${(percentage / 100) * 2 * Math.PI * 112} ${2 * Math.PI * 112}`}
                  strokeDashoffset="0"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold">{latestValue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Metrics Explorer</h1>
        <p className="text-muted-foreground">Query and visualize metrics by name and tags</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Query Builder */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Query Builder</CardTitle>
            <CardDescription>Build queries to visualize metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metric-search">Search Metrics</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="metric-search"
                  placeholder="Search metrics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric">Metric Name</Label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSuggestions.map((suggestion) => (
                    <SelectItem key={suggestion.name} value={suggestion.name}>
                      <div>
                        <div className="font-medium">{suggestion.name}</div>
                        <div className="text-xs text-muted-foreground">{suggestion.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                <SelectTrigger id="chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">
                    <div className="flex items-center gap-2">
                      <LineChart className="h-4 w-4" />
                      Line Chart
                    </div>
                  </SelectItem>
                  <SelectItem value="bar">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Bar Chart
                    </div>
                  </SelectItem>
                  <SelectItem value="area">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Area Chart
                    </div>
                  </SelectItem>
                  <SelectItem value="gauge">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      Gauge
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-range">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={executeQuery} className="w-full" disabled={loading || !selectedMetric}>
              {loading ? 'Loading...' : 'Execute Query'}
            </Button>

            {/* Saved Queries */}
            {queries.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Saved Queries</Label>
                <div className="space-y-1">
                  {queries.map((query) => (
                    <div
                      key={query.id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer"
                      onClick={() => setActiveQuery(query)}
                    >
                      <span className="text-sm truncate flex-1">{query.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteQuery(query.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart Display */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Metric Visualization</CardTitle>
                <CardDescription>
                  {activeQuery
                    ? `${activeQuery.metric} • ${activeQuery.timeRange} • ${activeQuery.chartType}`
                    : 'Execute a query to visualize metrics'}
                </CardDescription>
              </div>
              {activeQuery && (
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Query
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-96 w-full" />
            ) : activeQuery ? (
              <>
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{activeQuery.metric}</Badge>
                    {Object.entries(activeQuery.tags).map(([key, value]) => (
                      <Badge key={key} variant="outline">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
                {renderChart(activeQuery)}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <BarChart3 className="h-16 w-16 mb-4 opacity-50" />
                <p>No query selected. Build a query to visualize metrics.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

