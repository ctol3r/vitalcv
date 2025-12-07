'use client'

import { useState, useMemo } from 'react'
import {
  ShieldAlert,
  Plus,
  Save,
  Trash2,
  Edit,
  History,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ObligationStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED'

type Jurisdiction = {
  id: string
  name: string
  code: string
  region: string
}

type Obligation = {
  id: string
  title: string
  description: string
  jurisdiction: string
  regulation: string
  status: ObligationStatus
  version: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

type VersionHistory = {
  id: string
  version: string
  changedBy: string
  changedAt: string
  changes: string
}

export default function JurisdictionPolicyEditorPage() {
  const [obligations, setObligations] = useState<Obligation[]>(buildMockObligations())
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [srMessage, setSrMessage] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    jurisdiction: '',
    regulation: '',
    status: 'DRAFT' as ObligationStatus,
  })

  const jurisdictions = useMemo(
    () => [
      { id: 'us', name: 'United States', code: 'US', region: 'North America' },
      { id: 'eu', name: 'European Union', code: 'EU', region: 'Europe' },
      { id: 'ca', name: 'Canada', code: 'CA', region: 'North America' },
      { id: 'uk', name: 'United Kingdom', code: 'UK', region: 'Europe' },
      { id: 'au', name: 'Australia', code: 'AU', region: 'Oceania' },
    ],
    [],
  )

  const handleCreate = () => {
    setIsCreating(true)
    setEditingObligation(null)
    setFormData({
      title: '',
      description: '',
      jurisdiction: '',
      regulation: '',
      status: 'DRAFT',
    })
  }

  const handleEdit = (obligation: Obligation) => {
    setEditingObligation(obligation)
    setIsCreating(false)
    setFormData({
      title: obligation.title,
      description: obligation.description,
      jurisdiction: obligation.jurisdiction,
      regulation: obligation.regulation,
      status: obligation.status,
    })
  }

  const handleSave = () => {
    if (!formData.title || !formData.description || !formData.jurisdiction || !formData.regulation) {
      setSrMessage('Please fill in all required fields')
      setTimeout(() => setSrMessage(''), 3000)
      return
    }

    if (isCreating) {
      const newObligation: Obligation = {
        id: `obl-${Date.now()}`,
        ...formData,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin@example.com',
      }
      setObligations((prev) => [newObligation, ...prev])
      setSrMessage('Obligation created successfully')
    } else if (editingObligation) {
      setObligations((prev) =>
        prev.map((obl) =>
          obl.id === editingObligation.id
            ? {
                ...obl,
                ...formData,
                version: incrementVersion(obl.version),
                updatedAt: new Date().toISOString(),
              }
            : obl,
        ),
      )
      setSrMessage('Obligation updated successfully')
    }

    setIsCreating(false)
    setEditingObligation(null)
    setFormData({
      title: '',
      description: '',
      jurisdiction: '',
      regulation: '',
      status: 'DRAFT',
    })
    setTimeout(() => setSrMessage(''), 3000)
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingObligation(null)
    setFormData({
      title: '',
      description: '',
      jurisdiction: '',
      regulation: '',
      status: 'DRAFT',
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this obligation?')) {
      setObligations((prev) => prev.filter((obl) => obl.id !== id))
      setSrMessage('Obligation deleted')
      setTimeout(() => setSrMessage(''), 3000)
    }
  }

  const filteredObligations = useMemo(() => {
    return obligations
  }, [obligations])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin • Compliance • Policy Editor</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
              Jurisdiction Policy Editor
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Add and edit compliance obligations and jurisdictions. Manage policy versions and integrate with PolicyEngine.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            New Obligation
          </Button>
        </div>
      </header>

      {/* Form */}
      {(isCreating || editingObligation) && (
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? 'Create New Obligation' : 'Edit Obligation'}</CardTitle>
            <CardDescription>
              {isCreating
                ? 'Define a new compliance obligation for a jurisdiction'
                : `Editing obligation: ${editingObligation?.title}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., GDPR Data Protection"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Regulation <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.regulation}
                  onChange={(e) => setFormData({ ...formData, regulation: e.target.value })}
                  placeholder="e.g., GDPR, HIPAA, CCPA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the compliance obligation..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Jurisdiction <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                >
                  <option value="">Select jurisdiction</option>
                  {jurisdictions.map((jur) => (
                    <option key={jur.id} value={jur.code}>
                      {jur.name} ({jur.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ObligationStatus })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {srMessage && (
        <div
          className={cn(
            'rounded-md border p-4 flex items-center gap-2',
            srMessage.includes('successfully') || srMessage.includes('created')
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50',
          )}
        >
          {srMessage.includes('successfully') || srMessage.includes('created') ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          )}
          <p className="text-sm">{srMessage}</p>
        </div>
      )}

      {/* Obligations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Obligations</CardTitle>
          <CardDescription>Manage obligations by jurisdiction and regulation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Regulation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredObligations.map((obligation) => (
                  <TableRow key={obligation.id}>
                    <TableCell className="font-medium">{obligation.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{obligation.jurisdiction}</Badge>
                    </TableCell>
                    <TableCell>{obligation.regulation}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          obligation.status === 'ACTIVE' && 'border-emerald-300 text-emerald-900',
                          obligation.status === 'DRAFT' && 'border-amber-300 text-amber-900',
                          obligation.status === 'ARCHIVED' && 'border-muted text-muted-foreground',
                        )}
                      >
                        {obligation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{obligation.version}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(obligation.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(obligation)}>
                          <Edit className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowHistory(showHistory === obligation.id ? null : obligation.id)}
                        >
                          <History className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(obligation.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Version History</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(null)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <CardDescription>View changes and version history for this obligation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {buildMockVersionHistory(showHistory).map((version) => (
                <div key={version.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        v{version.version}
                      </Badge>
                      <span className="text-sm text-muted-foreground">by {version.changedBy}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(version.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{version.changes}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function incrementVersion(version: string): string {
  const parts = version.split('.')
  const minor = parseInt(parts[2] || '0', 10) + 1
  return `${parts[0]}.${parts[1]}.${minor}`
}

function buildMockObligations(): Obligation[] {
  return [
    {
      id: 'obl-001',
      title: 'GDPR Data Protection',
      description: 'Ensures personal data of EU residents is processed in accordance with GDPR requirements.',
      jurisdiction: 'EU',
      regulation: 'GDPR',
      status: 'ACTIVE',
      version: '2.1.0',
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-10-15T00:00:00Z',
      createdBy: 'admin@example.com',
    },
    {
      id: 'obl-002',
      title: 'HIPAA Privacy Rule',
      description: 'Protects the privacy of individually identifiable health information.',
      jurisdiction: 'US',
      regulation: 'HIPAA',
      status: 'ACTIVE',
      version: '1.5.0',
      createdAt: '2025-02-01T00:00:00Z',
      updatedAt: '2025-09-20T00:00:00Z',
      createdBy: 'admin@example.com',
    },
    {
      id: 'obl-003',
      title: 'CCPA Consumer Rights',
      description: 'Provides California consumers with rights regarding their personal information.',
      jurisdiction: 'US',
      regulation: 'CCPA',
      status: 'DRAFT',
      version: '1.0.0',
      createdAt: '2025-11-01T00:00:00Z',
      updatedAt: '2025-11-01T00:00:00Z',
      createdBy: 'admin@example.com',
    },
  ]
}

function buildMockVersionHistory(obligationId: string): VersionHistory[] {
  return [
    {
      id: 'v1',
      version: '2.1.0',
      changedBy: 'admin@example.com',
      changedAt: '2025-10-15T00:00:00Z',
      changes: 'Updated data retention requirements and added new privacy controls.',
    },
    {
      id: 'v2',
      version: '2.0.0',
      changedBy: 'admin@example.com',
      changedAt: '2025-08-01T00:00:00Z',
      changes: 'Major revision: Added support for data portability and right to erasure.',
    },
    {
      id: 'v3',
      version: '1.0.0',
      changedBy: 'admin@example.com',
      changedAt: '2025-01-15T00:00:00Z',
      changes: 'Initial version created.',
    },
  ]
}

