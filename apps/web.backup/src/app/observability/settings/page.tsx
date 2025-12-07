'use client'

import { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'

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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type ObservabilitySettings = {
  sampling: {
    rate: number
    environment: 'dev' | 'staging' | 'production'
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    retention: number
    maxSize: number
  }
  notifications: {
    email: string[]
    slack: string[]
    pagerduty: string
    enabled: boolean
  }
  metrics: {
    retention: number
    resolution: number
    enabled: boolean
  }
  tracing: {
    samplingRate: number
    maxSpans: number
    enabled: boolean
  }
}

export default function ObservabilitySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<ObservabilitySettings>({
    sampling: {
      rate: 100,
      environment: 'production',
    },
    logging: {
      level: 'info',
      retention: 30,
      maxSize: 1000,
    },
    notifications: {
      email: [],
      slack: [],
      pagerduty: '',
      enabled: true,
    },
    metrics: {
      retention: 90,
      resolution: 60,
      enabled: true,
    },
    tracing: {
      samplingRate: 10,
      maxSpans: 1000,
      enabled: true,
    },
  })

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // In real implementation, fetch from API
      setLoading(false)
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // In real implementation, save to API via ObservabilityConfigService
    setSaving(false)
  }

  const updateSettings = (section: keyof ObservabilitySettings, updates: Partial<ObservabilitySettings[keyof ObservabilitySettings]>) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates,
      },
    }))
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Observability Settings</h1>
        <p className="text-muted-foreground">Configure observability preferences and sampling rates</p>
      </header>

      <Tabs defaultValue="sampling" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sampling">Sampling</TabsTrigger>
          <TabsTrigger value="logging">Logging</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="tracing">Tracing</TabsTrigger>
        </TabsList>

        {/* Sampling Settings */}
        <TabsContent value="sampling">
          <Card>
            <CardHeader>
              <CardTitle>Sampling Configuration</CardTitle>
              <CardDescription>Configure sampling rates by environment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={settings.sampling.environment}
                      onValueChange={(value: 'dev' | 'staging' | 'production') =>
                        updateSettings('sampling', { environment: value })
                      }
                    >
                      <SelectTrigger id="environment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dev">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sampling-rate">Sampling Rate (%)</Label>
                    <Input
                      id="sampling-rate"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.sampling.rate}
                      onChange={(e) =>
                        updateSettings('sampling', { rate: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage of requests to sample. 100% = all requests, 10% = 1 in 10 requests.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logging Settings */}
        <TabsContent value="logging">
          <Card>
            <CardHeader>
              <CardTitle>Logging Configuration</CardTitle>
              <CardDescription>Configure log levels and retention policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="log-level">Log Level</Label>
                    <Select
                      value={settings.logging.level}
                      onValueChange={(value: 'debug' | 'info' | 'warn' | 'error') =>
                        updateSettings('logging', { level: value })
                      }
                    >
                      <SelectTrigger id="log-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Minimum log level to capture. Logs below this level will be discarded.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retention">Retention (days)</Label>
                    <Input
                      id="retention"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.logging.retention}
                      onChange={(e) =>
                        updateSettings('logging', { retention: parseInt(e.target.value) || 30 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of days to retain logs before automatic deletion.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-size">Max Log Size (MB)</Label>
                    <Input
                      id="max-size"
                      type="number"
                      min="1"
                      value={settings.logging.maxSize}
                      onChange={(e) =>
                        updateSettings('logging', { maxSize: parseInt(e.target.value) || 1000 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum size of individual log files before rotation.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>Configure notification endpoints for alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications-enabled">Enable Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable or disable all notification channels
                      </p>
                    </div>
                    <Switch
                      id="notifications-enabled"
                      checked={settings.notifications.enabled}
                      onCheckedChange={(checked) =>
                        updateSettings('notifications', { enabled: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Addresses</Label>
                    <Textarea
                      id="email"
                      placeholder="email1@example.com, email2@example.com"
                      value={settings.notifications.email.join(', ')}
                      onChange={(e) =>
                        updateSettings('notifications', {
                          email: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of email addresses to receive alerts.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slack">Slack Webhooks</Label>
                    <Textarea
                      id="slack"
                      placeholder="https://hooks.slack.com/services/..."
                      value={settings.notifications.slack.join('\n')}
                      onChange={(e) =>
                        updateSettings('notifications', {
                          slack: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      One webhook URL per line.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pagerduty">PagerDuty Integration Key</Label>
                    <Input
                      id="pagerduty"
                      type="text"
                      placeholder="Integration key"
                      value={settings.notifications.pagerduty}
                      onChange={(e) =>
                        updateSettings('notifications', { pagerduty: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      PagerDuty integration key for critical alerts.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Settings */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Metrics Configuration</CardTitle>
              <CardDescription>Configure metrics collection and retention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="metrics-enabled">Enable Metrics</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable or disable metrics collection
                      </p>
                    </div>
                    <Switch
                      id="metrics-enabled"
                      checked={settings.metrics.enabled}
                      onCheckedChange={(checked) =>
                        updateSettings('metrics', { enabled: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metrics-retention">Retention (days)</Label>
                    <Input
                      id="metrics-retention"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.metrics.retention}
                      onChange={(e) =>
                        updateSettings('metrics', { retention: parseInt(e.target.value) || 90 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of days to retain metrics data.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metrics-resolution">Resolution (seconds)</Label>
                    <Input
                      id="metrics-resolution"
                      type="number"
                      min="1"
                      value={settings.metrics.resolution}
                      onChange={(e) =>
                        updateSettings('metrics', { resolution: parseInt(e.target.value) || 60 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Time resolution for metrics data points.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracing Settings */}
        <TabsContent value="tracing">
          <Card>
            <CardHeader>
              <CardTitle>Tracing Configuration</CardTitle>
              <CardDescription>Configure distributed tracing settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="tracing-enabled">Enable Tracing</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable or disable distributed tracing
                      </p>
                    </div>
                    <Switch
                      id="tracing-enabled"
                      checked={settings.tracing.enabled}
                      onCheckedChange={(checked) =>
                        updateSettings('tracing', { enabled: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tracing-sampling">Sampling Rate (%)</Label>
                    <Input
                      id="tracing-sampling"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.tracing.samplingRate}
                      onChange={(e) =>
                        updateSettings('tracing', { samplingRate: parseInt(e.target.value) || 10 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage of traces to sample. Lower rates reduce storage costs.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tracing-max-spans">Max Spans per Trace</Label>
                    <Input
                      id="tracing-max-spans"
                      type="number"
                      min="1"
                      value={settings.tracing.maxSpans}
                      onChange={(e) =>
                        updateSettings('tracing', { maxSpans: parseInt(e.target.value) || 1000 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of spans per trace to prevent excessive data.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-end gap-4">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? (
                <>
                  <Settings className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

