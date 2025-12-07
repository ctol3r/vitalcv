'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Edit,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type AlertRule = {
  id: string
  name: string
  description: string
  enabled: boolean
  threshold: number
  condition: 'greater_than' | 'less_than' | 'equals'
  metric: string
  severity: 'critical' | 'warning' | 'info'
  channels: string[]
  service?: string
}

type Incident = {
  id: string
  ruleId: string
  ruleName: string
  severity: 'critical' | 'warning' | 'info'
  status: 'open' | 'resolved'
  startTime: string
  endTime?: string
  message: string
  service?: string
}

export default function AlertManagementPage() {
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setRules([
        {
          id: 'rule-1',
          name: 'High Error Rate',
          description: 'Alert when error rate exceeds 5%',
          enabled: true,
          threshold: 5,
          condition: 'greater_than',
          metric: 'error_rate',
          severity: 'critical',
          channels: ['email', 'slack'],
          service: 'api',
        },
        {
          id: 'rule-2',
          name: 'High Latency',
          description: 'Alert when P95 latency exceeds 500ms',
          enabled: true,
          threshold: 500,
          condition: 'greater_than',
          metric: 'p95_latency',
          severity: 'warning',
          channels: ['slack'],
        },
        {
          id: 'rule-3',
          name: 'Service Down',
          description: 'Alert when service is down',
          enabled: false,
          threshold: 0,
          condition: 'equals',
          metric: 'uptime',
          severity: 'critical',
          channels: ['email', 'slack', 'pagerduty'],
        },
      ])

      setIncidents([
        {
          id: 'inc-1',
          ruleId: 'rule-1',
          ruleName: 'High Error Rate',
          severity: 'critical',
          status: 'open',
          startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          message: 'Error rate has exceeded 5% threshold',
          service: 'api',
        },
        {
          id: 'inc-2',
          ruleId: 'rule-2',
          ruleName: 'High Latency',
          severity: 'warning',
          status: 'open',
          startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          message: 'P95 latency has exceeded 500ms',
        },
      ])

      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    )
  }

  const deleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
  }

  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openIncidents = incidents.filter((inc) => inc.status === 'open')
  const resolvedIncidents = incidents.filter((inc) => inc.status === 'resolved')

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Alert Management</h1>
        <p className="text-muted-foreground">Manage alert rules and monitor active incidents</p>
      </header>

      {/* Active Incidents */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Currently open incidents requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : openIncidents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active incidents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                  >
                    <Badge
                      variant={
                        incident.severity === 'critical'
                          ? 'destructive'
                          : incident.severity === 'warning'
                            ? 'default'
                            : 'secondary'
                      }
                      className="mt-0.5"
                    >
                      {incident.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{incident.ruleName}</p>
                      <p className="text-sm text-muted-foreground mt-1">{incident.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {incident.service && (
                          <>
                            <span>{incident.service}</span>
                            <span>•</span>
                          </>
                        )}
                        <time dateTime={incident.startTime}>
                          Started {new Date(incident.startTime).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolved Incidents</CardTitle>
            <CardDescription>Recently resolved incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : resolvedIncidents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No resolved incidents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resolvedIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-muted/50"
                  >
                    <Badge variant="secondary" className="mt-0.5">
                      Resolved
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{incident.ruleName}</p>
                      <p className="text-sm text-muted-foreground mt-1">{incident.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {incident.endTime && (
                          <time dateTime={incident.endTime}>
                            Resolved {new Date(incident.endTime).toLocaleString()}
                          </time>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>Configure rules that trigger alerts based on metrics</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Alert Rule</DialogTitle>
                    <DialogDescription>
                      Define conditions that will trigger alerts when met
                    </DialogDescription>
                  </DialogHeader>
                  <AlertRuleForm
                    onSuccess={() => {
                      setIsCreateDialogOpen(false)
                      // Refresh rules
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alert rules found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Enabled</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.metric}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {rule.condition === 'greater_than' ? '>' : rule.condition === 'less_than' ? '<' : '='}{' '}
                          {rule.threshold}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rule.severity === 'critical'
                              ? 'destructive'
                              : rule.severity === 'warning'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.channels.map((channel) => (
                            <Badge key={channel} variant="outline" className="text-xs">
                              {channel}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Alert Rule</DialogTitle>
              <DialogDescription>Update the alert rule configuration</DialogDescription>
            </DialogHeader>
            <AlertRuleForm
              rule={editingRule}
              onSuccess={() => {
                setEditingRule(null)
                // Refresh rules
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AlertRuleForm({ rule, onSuccess }: { rule?: AlertRule; onSuccess: () => void }) {
  const [name, setName] = useState(rule?.name || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [metric, setMetric] = useState(rule?.metric || 'error_rate')
  const [condition, setCondition] = useState<string>(rule?.condition || 'greater_than')
  const [threshold, setThreshold] = useState(String(rule?.threshold || 0))
  const [severity, setSeverity] = useState<string>(rule?.severity || 'warning')
  const [channels, setChannels] = useState<string[]>(rule?.channels || [])
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    onSuccess()
  }

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="High Error Rate"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Alert when error rate exceeds threshold"
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="metric">Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger id="metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error_rate">Error Rate</SelectItem>
              <SelectItem value="p95_latency">P95 Latency</SelectItem>
              <SelectItem value="p99_latency">P99 Latency</SelectItem>
              <SelectItem value="request_rate">Request Rate</SelectItem>
              <SelectItem value="uptime">Uptime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger id="condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="greater_than">Greater Than</SelectItem>
              <SelectItem value="less_than">Less Than</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="threshold">Threshold</Label>
          <Input
            id="threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="severity">Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Enabled</Label>
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notification Channels</Label>
        <div className="flex flex-wrap gap-2">
          {['email', 'slack', 'pagerduty', 'webhook'].map((channel) => (
            <Button
              key={channel}
              type="button"
              variant={channels.includes(channel) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleChannel(channel)}
            >
              {channel}
            </Button>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">{rule ? 'Update Rule' : 'Create Rule'}</Button>
      </DialogFooter>
    </form>
  )
}

