'use client'

import {
  BookOpen,
  Code,
  FileText,
  Gauge,
  List,
  Settings,
  TrendingUp,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ObservabilityUserGuidePage() {
  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Observability User Guide</h1>
        <p className="text-muted-foreground">
          Learn how to use metrics, logging, tracing, and alerting effectively
        </p>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
          <TabsTrigger value="tracing">Tracing</TabsTrigger>
          <TabsTrigger value="alerting">Alerting</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>What is Observability?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Observability is the ability to understand the internal state of your system based on its external outputs.
                  Our observability platform provides three pillars:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Gauge className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Metrics</h4>
                      <p className="text-sm text-muted-foreground">
                        Numerical measurements over time (request rate, latency, error rate)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Logs</h4>
                      <p className="text-sm text-muted-foreground">
                        Discrete events with timestamps, levels, and context
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Traces</h4>
                      <p className="text-sm text-muted-foreground">
                        Distributed request flows across multiple services
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold">Explore the Dashboard</h4>
                      <p className="text-sm text-muted-foreground">
                        Start with the observability dashboard to see overall system health
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold">Set Up Alerts</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure alert rules to get notified of critical issues
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold">Instrument Your Services</h4>
                      <p className="text-sm text-muted-foreground">
                        Add metrics, logging, and tracing to your application code
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <a href="/observability/dashboard" className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <h4 className="font-semibold mb-1">Dashboard</h4>
                    <p className="text-sm text-muted-foreground">Overview of all services</p>
                  </a>
                  <a href="/observability/metrics" className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <h4 className="font-semibold mb-1">Metrics Explorer</h4>
                    <p className="text-sm text-muted-foreground">Query and visualize metrics</p>
                  </a>
                  <a href="/observability/logs" className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <h4 className="font-semibold mb-1">Log Viewer</h4>
                    <p className="text-sm text-muted-foreground">Search and filter logs</p>
                  </a>
                  <a href="/observability/alerts" className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <h4 className="font-semibold mb-1">Alert Management</h4>
                    <p className="text-sm text-muted-foreground">Configure alert rules</p>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics */}
        <TabsContent value="metrics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Understanding Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Metrics are numerical measurements collected over time. They help you understand system performance
                  and identify trends.
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Types of Metrics</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <strong className="text-foreground">Counters:</strong> Incrementing values (e.g., request count)
                      </li>
                      <li>
                        <strong className="text-foreground">Gauges:</strong> Values that go up and down (e.g., queue depth)
                      </li>
                      <li>
                        <strong className="text-foreground">Histograms:</strong> Distribution of values (e.g., latency percentiles)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Common Metrics</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">http_requests_total</Badge>
                      <Badge variant="outline">http_request_duration_seconds</Badge>
                      <Badge variant="outline">error_rate</Badge>
                      <Badge variant="outline">queue_depth</Badge>
                      <Badge variant="outline">cpu_usage</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Querying Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Use the Metrics Explorer to query and visualize metrics. You can filter by tags and select different
                  chart types.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Example Query</h4>
                  <code className="text-sm">
                    http_request_duration_seconds{'{'}method=&quot;GET&quot;, route=&quot;/api/v1/verify&quot;{'}'}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instrumenting Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">1. Import Metrics Helper</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`import { createMetricsRegistry, createHttpMetrics } from '@/infra/observability/metricsHelper';`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Create Metrics</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`const register = createMetricsRegistry({ serviceName: 'my-service' });
const httpMetrics = createHttpMetrics('my-service', register);`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">3. Use Middleware</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`app.use(httpMetricsMiddleware(httpMetrics));
app.get('/metrics', metricsEndpoint(register));`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logging */}
        <TabsContent value="logging">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Understanding Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Logs are discrete events with timestamps, levels, and context. They help you understand what happened
                  in your system.
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Log Levels</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-500">ERROR</Badge>
                        <span className="text-muted-foreground">Critical errors requiring immediate attention</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-500">WARN</Badge>
                        <span className="text-muted-foreground">Warnings about potential issues</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500">INFO</Badge>
                        <span className="text-muted-foreground">Informational messages about normal operation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gray-500">DEBUG</Badge>
                        <span className="text-muted-foreground">Detailed debugging information</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Correlation IDs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Correlation IDs allow you to track a request across multiple services. All logs from the same request
                  will have the same correlation ID.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Example Correlation ID</h4>
                  <code className="text-sm">corr-abc123def456</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click on a correlation ID in the log viewer to view the full trace.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Use structured logging with consistent fields</li>
                  <li>✓ Include correlation IDs in all log entries</li>
                  <li>✓ Never log sensitive data (passwords, tokens, PHI)</li>
                  <li>✓ Use appropriate log levels</li>
                  <li>✓ Include context (service name, user ID, request ID)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tracing */}
        <TabsContent value="tracing">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Understanding Traces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Traces show the path of a request through multiple services. Each trace contains spans that represent
                  individual operations.
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Trace Components</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <strong className="text-foreground">Trace:</strong> Complete request flow across services
                      </li>
                      <li>
                        <strong className="text-foreground">Span:</strong> Individual operation within a service
                      </li>
                      <li>
                        <strong className="text-foreground">Parent/Child:</strong> Relationship between spans showing call hierarchy
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Viewing Traces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Use the Trace Viewer to visualize traces. You can view them as a waterfall or flame graph.
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Waterfall View</h4>
                    <p className="text-sm text-muted-foreground">
                      Shows spans as horizontal bars with their duration and timing relative to each other.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Flame Graph View</h4>
                    <p className="text-sm text-muted-foreground">
                      Shows the call stack with nested spans representing the execution hierarchy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instrumenting Tracing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">1. Initialize Tracing</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`import { initializeTracing, tracingMiddleware } from '@/infra/observability/tracing';

initializeTracing({
  serviceName: 'my-service',
  otlpEndpoint: process.env.OTEL_ENDPOINT
});

app.use(tracingMiddleware('my-service'));`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Create Spans</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`import { withSpan } from '@/infra/observability/tracing';

await withSpan('operation-name', async (span) => {
  span.setAttribute('key', 'value');
  // Your operation
});`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerting */}
        <TabsContent value="alerting">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Understanding Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Alerts notify you when metrics exceed thresholds. You can configure alert rules to automatically
                  trigger when conditions are met.
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Alert Severity Levels</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">CRITICAL</Badge>
                        <span className="text-muted-foreground">Immediate action required</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">WARNING</Badge>
                        <span className="text-muted-foreground">Needs attention soon</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">INFO</Badge>
                        <span className="text-muted-foreground">Informational only</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Creating Alert Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">1. Select Metric</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose the metric you want to monitor (e.g., error_rate, latency)
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Set Condition</h4>
                    <p className="text-sm text-muted-foreground">
                      Define when the alert should trigger (greater than, less than, equals)
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">3. Configure Threshold</h4>
                    <p className="text-sm text-muted-foreground">
                      Set the value that triggers the alert
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">4. Select Channels</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose notification channels (email, Slack, PagerDuty)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Managing Incidents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  When an alert fires, it creates an incident. You can manage incidents by acknowledging them,
                  adding notes, and resolving them.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Acknowledge incidents to indicate you're working on them</p>
                  <p>• Add notes to document investigation and resolution steps</p>
                  <p>• Resolve incidents when the issue is fixed</p>
                  <p>• Review incident timeline to understand what happened</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

