'use client'

import { useMemo, useState } from 'react'
import { Plug, Plus, Settings, CheckCircle2, XCircle, Clock, AlertTriangle, Key, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ConnectorType = 'TEFCA' | 'LICENSING_BOARD' | 'BLOCKCHAIN'

type ConnectorStatus = 'enabled' | 'disabled' | 'error' | 'syncing'

type Connector = {
  id: string
  name: string
  type: ConnectorType
  endpoint: string
  status: ConnectorStatus
  lastSyncTime?: string
  credentialsConfigured: boolean
  description: string
}

export default function ConnectorManagementPage() {
  const [connectors, setConnectors] = useState<Connector[]>(buildMockConnectors())
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [srMessage, setSrMessage] = useState('')

  const handleToggleConnector = (connectorId: string) => {
    setConnectors((prev) =>
      prev.map((conn) =>
        conn.id === connectorId
          ? {
              ...conn,
              status: conn.status === 'enabled' ? 'disabled' : 'enabled',
            }
          : conn,
      ),
    )
    const connector = connectors.find((c) => c.id === connectorId)
    setSrMessage(`${connector?.name} ${connector?.status === 'enabled' ? 'disabled' : 'enabled'}`)
    setTimeout(() => setSrMessage(''), 2000)
  }

  const handleSaveConnector = (connector: Connector) => {
    if (selectedConnector) {
      setConnectors((prev) => prev.map((c) => (c.id === connector.id ? connector : c)))
      setSrMessage(`${connector.name} configuration saved`)
    } else {
      setConnectors((prev) => [...prev, { ...connector, id: `conn-${Date.now()}` }])
      setSrMessage(`${connector.name} connector added`)
    }
    setIsDialogOpen(false)
    setSelectedConnector(null)
    setTimeout(() => setSrMessage(''), 2000)
  }

  const enabledCount = connectors.filter((c) => c.status === 'enabled').length
  const errorCount = connectors.filter((c) => c.status === 'error').length
  const syncingCount = connectors.filter((c) => c.status === 'syncing').length

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Integration • Connectors</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Plug className="h-8 w-8 text-primary" aria-hidden="true" />
              Connector Management
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Configure TEFCA, licensing boards, and blockchain connectors. Add endpoints, set credentials, and toggle enable/disable status.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedConnector(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connector
              </Button>
            </DialogTrigger>
            <ConnectorDialog
              connector={selectedConnector}
              onSave={handleSaveConnector}
              onClose={() => {
                setIsDialogOpen(false)
                setSelectedConnector(null)
              }}
            />
          </Dialog>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-4" aria-label="Connector summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Plug className="h-4 w-4" aria-hidden="true" />
              Total Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{connectors.length}</p>
            <p className="text-sm text-muted-foreground">Configured</p>
          </CardContent>
        </Card>
        <Card className={enabledCount > 0 ? 'border-emerald-200 bg-emerald-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{enabledCount}</p>
            <p className="text-sm text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>
        <Card className={errorCount > 0 ? 'border-rose-200 bg-rose-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-rose-600">{errorCount}</p>
            <p className="text-sm text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card className={syncingCount > 0 ? 'border-blue-200 bg-blue-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Syncing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{syncingCount}</p>
            <p className="text-sm text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </section>

      {/* Connectors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Connectors</CardTitle>
          <CardDescription>Manage external system connectors and their configurations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectors.map((connector) => (
                <TableRow key={connector.id}>
                  <TableCell className="font-semibold">{connector.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {connector.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{connector.endpoint}</TableCell>
                  <TableCell>
                    <StatusBadge status={connector.status} />
                  </TableCell>
                  <TableCell>
                    {connector.credentialsConfigured ? (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                        <Key className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {connector.lastSyncTime ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {connector.lastSyncTime}
                      </span>
                    ) : (
                      'Never'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={connector.status === 'enabled'}
                        onCheckedChange={() => handleToggleConnector(connector.id)}
                        aria-label={`Toggle ${connector.name}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedConnector(connector)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function ConnectorDialog({
  connector,
  onSave,
  onClose,
}: {
  connector: Connector | null
  onSave: (connector: Connector) => void
  onClose: () => void
}) {
  const [name, setName] = useState(connector?.name || '')
  const [type, setType] = useState<ConnectorType>(connector?.type || 'TEFCA')
  const [endpoint, setEndpoint] = useState(connector?.endpoint || '')
  const [description, setDescription] = useState(connector?.description || '')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [credentialsConfigured, setCredentialsConfigured] = useState(connector?.credentialsConfigured || false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: connector?.id || '',
      name,
      type,
      endpoint,
      description,
      status: connector?.status || 'disabled',
      credentialsConfigured: apiKey && apiSecret ? true : credentialsConfigured,
      lastSyncTime: connector?.lastSyncTime,
    })
  }

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{connector ? 'Edit Connector' : 'Add New Connector'}</DialogTitle>
        <DialogDescription>Configure connector endpoint, credentials, and settings.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connector Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., TEFCA Production" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Connector Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as ConnectorType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="TEFCA">TEFCA</option>
                <option value="LICENSING_BOARD">Licensing Board</option>
                <option value="BLOCKCHAIN">Blockchain</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                required
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </TabsContent>
          <TabsContent value="credentials" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setCredentialsConfigured(e.target.value.length > 0 && apiSecret.length > 0)
                }}
                placeholder="Enter API key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input
                id="apiSecret"
                type="password"
                value={apiSecret}
                onChange={(e) => {
                  setApiSecret(e.target.value)
                  setCredentialsConfigured(apiKey.length > 0 && e.target.value.length > 0)
                }}
                placeholder="Enter API secret"
              />
            </div>
            {credentialsConfigured && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-800">Credentials configured</span>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Connector</Button>
        </div>
      </form>
    </DialogContent>
  )
}

function StatusBadge({ status }: { status: ConnectorStatus }) {
  const config = {
    enabled: { label: 'Enabled', variant: 'default' as const, className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
    disabled: { label: 'Disabled', variant: 'secondary' as const, className: '', icon: XCircle },
    error: { label: 'Error', variant: 'destructive' as const, className: 'bg-rose-100 text-rose-800', icon: AlertTriangle },
    syncing: { label: 'Syncing', variant: 'default' as const, className: 'bg-blue-100 text-blue-800', icon: Clock },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 w-fit ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

function buildMockConnectors(): Connector[] {
  return [
    {
      id: 'conn-1',
      name: 'TEFCA Production',
      type: 'TEFCA',
      endpoint: 'https://tefca-api.example.com/v1',
      status: 'enabled',
      lastSyncTime: '2 minutes ago',
      credentialsConfigured: true,
      description: 'TEFCA interoperability connector for healthcare data exchange',
    },
    {
      id: 'conn-2',
      name: 'State Medical Board',
      type: 'LICENSING_BOARD',
      endpoint: 'https://medical-board.state.gov/api',
      status: 'enabled',
      lastSyncTime: '15 minutes ago',
      credentialsConfigured: true,
      description: 'State medical licensing board integration',
    },
    {
      id: 'conn-3',
      name: 'Polygon Blockchain',
      type: 'BLOCKCHAIN',
      endpoint: 'https://polygon-rpc.example.com',
      status: 'syncing',
      lastSyncTime: 'Just now',
      credentialsConfigured: true,
      description: 'Blockchain connector for credential anchoring',
    },
    {
      id: 'conn-4',
      name: 'TEFCA Sandbox',
      type: 'TEFCA',
      endpoint: 'https://tefca-sandbox.example.com/v1',
      status: 'disabled',
      credentialsConfigured: false,
      description: 'TEFCA sandbox environment for testing',
    },
    {
      id: 'conn-5',
      name: 'Nursing Board API',
      type: 'LICENSING_BOARD',
      endpoint: 'https://nursing-board.example.com/api',
      status: 'error',
      lastSyncTime: '1 hour ago',
      credentialsConfigured: true,
      description: 'State nursing board credential verification',
    },
  ]
}

