'use client'

import { useState } from 'react'
import { Settings, AlertTriangle, Save, Map, Shield, Key, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

type MappingRule = {
  id: string
  name: string
  sourceField: string
  targetField: string
  transformation?: string
  enabled: boolean
}

type PolicyDefault = {
  id: string
  name: string
  value: string
  description: string
  category: 'privacy' | 'security' | 'compliance' | 'performance'
}

type CredentialSchemaMapping = {
  id: string
  sourceSchema: string
  targetSchema: string
  mapping: Record<string, string>
  enabled: boolean
}

type ComplianceSafeguard = {
  id: string
  name: string
  description: string
  enabled: boolean
  critical: boolean
}

export function InteropSettings() {
  const [mappingRules, setMappingRules] = useState<MappingRule[]>(buildMockMappingRules())
  const [policyDefaults, setPolicyDefaults] = useState<PolicyDefault[]>(buildMockPolicyDefaults())
  const [schemaMappings, setSchemaMappings] = useState<CredentialSchemaMapping[]>(buildMockSchemaMappings())
  const [safeguards, setSafeguards] = useState<ComplianceSafeguard[]>(buildMockSafeguards())
  const [showDisableWarning, setShowDisableWarning] = useState(false)
  const [safeguardToDisable, setSafeguardToDisable] = useState<string | null>(null)
  const [srMessage, setSrMessage] = useState('')

  const handleToggleSafeguard = (id: string) => {
    const safeguard = safeguards.find((s) => s.id === id)
    if (safeguard?.critical && safeguard.enabled) {
      setSafeguardToDisable(id)
      setShowDisableWarning(true)
    } else {
      setSafeguards((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
      setSrMessage(`${safeguard?.name} ${safeguard?.enabled ? 'disabled' : 'enabled'}`)
      setTimeout(() => setSrMessage(''), 2000)
    }
  }

  const handleConfirmDisable = () => {
    if (safeguardToDisable) {
      setSafeguards((prev) => prev.map((s) => (s.id === safeguardToDisable ? { ...s, enabled: false } : s)))
      setSrMessage('Critical compliance safeguard disabled')
      setTimeout(() => setSrMessage(''), 2000)
    }
    setShowDisableWarning(false)
    setSafeguardToDisable(null)
  }

  const handleSave = () => {
    // In a real app, this would save to the backend
    setSrMessage('Settings saved successfully')
    setTimeout(() => setSrMessage(''), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" aria-hidden="true" />
              Interoperability Settings
            </CardTitle>
            <CardDescription>
              Manage mapping rules, policy defaults, and credential schema mappings. Warnings appear when disabling compliance safeguards.
            </CardDescription>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mappings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mappings">Mapping Rules</TabsTrigger>
            <TabsTrigger value="policies">Policy Defaults</TabsTrigger>
            <TabsTrigger value="schemas">Schema Mappings</TabsTrigger>
            <TabsTrigger value="safeguards">Compliance Safeguards</TabsTrigger>
          </TabsList>

          {/* Mapping Rules Tab */}
          <TabsContent value="mappings" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Configure data field mapping rules between external systems.</p>
              <Button size="sm" variant="outline">
                <Map className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source Field</TableHead>
                    <TableHead>Target Field</TableHead>
                    <TableHead>Transformation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappingRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-semibold">{rule.name}</TableCell>
                      <TableCell className="font-mono text-sm">{rule.sourceField}</TableCell>
                      <TableCell className="font-mono text-sm">{rule.targetField}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{rule.transformation || 'None'}</TableCell>
                      <TableCell>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => {
                            setMappingRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
                          }}
                          aria-label={`Toggle ${rule.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Policy Defaults Tab */}
          <TabsContent value="policies" className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure default policy values for interoperability operations.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {policyDefaults.map((policy) => (
                <Card key={policy.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{policy.name}</CardTitle>
                      <Badge variant="outline" className="capitalize">
                        {policy.category}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{policy.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor={`policy-${policy.id}`}>Value</Label>
                      <Input
                        id={`policy-${policy.id}`}
                        value={policy.value}
                        onChange={(e) => {
                          setPolicyDefaults((prev) => prev.map((p) => (p.id === policy.id ? { ...p, value: e.target.value } : p)))
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Schema Mappings Tab */}
          <TabsContent value="schemas" className="space-y-4">
            <p className="text-sm text-muted-foreground">Manage credential schema mappings between different formats.</p>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Schema</TableHead>
                    <TableHead>Target Schema</TableHead>
                    <TableHead>Mappings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemaMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono text-sm">{mapping.sourceSchema}</TableCell>
                      <TableCell className="font-mono text-sm">{mapping.targetSchema}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{Object.keys(mapping.mapping).length} fields</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapping.enabled ? 'default' : 'secondary'}>
                          {mapping.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={mapping.enabled}
                            onCheckedChange={() => {
                              setSchemaMappings((prev) => prev.map((m) => (m.id === mapping.id ? { ...m, enabled: !m.enabled } : m)))
                            }}
                            aria-label={`Toggle ${mapping.sourceSchema}`}
                          />
                          <Button size="sm" variant="outline">
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Compliance Safeguards Tab */}
          <TabsContent value="safeguards" className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">Warning</p>
                <p className="text-sm text-amber-800">
                  Disabling compliance safeguards may violate regulatory requirements. Critical safeguards require confirmation before disabling.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {safeguards.map((safeguard) => (
                <Card key={safeguard.id} className={safeguard.critical && !safeguard.enabled ? 'border-rose-200 bg-rose-50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className={`h-4 w-4 ${safeguard.critical ? 'text-rose-600' : 'text-muted-foreground'}`} />
                          <h4 className="font-semibold">{safeguard.name}</h4>
                          {safeguard.critical && (
                            <Badge variant="destructive" className="text-xs">Critical</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{safeguard.description}</p>
                      </div>
                      <Switch
                        checked={safeguard.enabled}
                        onCheckedChange={() => handleToggleSafeguard(safeguard.id)}
                        aria-label={`Toggle ${safeguard.name}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Disable Safeguard Warning Dialog */}
      <AlertDialog open={showDisableWarning} onOpenChange={setShowDisableWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Disable Critical Compliance Safeguard?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to disable a critical compliance safeguard. This action may violate regulatory requirements and could result in:
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Non-compliance with healthcare regulations</li>
                <li>Security vulnerabilities</li>
                <li>Data privacy violations</li>
                <li>Legal and financial penalties</li>
              </ul>
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSafeguardToDisable(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} className="bg-rose-600 hover:bg-rose-700">
              Disable Safeguard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </Card>
  )
}

function buildMockMappingRules(): MappingRule[] {
  return [
    {
      id: 'rule-1',
      name: 'FHIR to Internal Credential',
      sourceField: 'FHIR.Practitioner.qualification',
      targetField: 'credential.qualifications',
      transformation: 'Array mapping',
      enabled: true,
    },
    {
      id: 'rule-2',
      name: 'TEFCA POU Mapping',
      sourceField: 'TEFCA.purposeOfUse',
      targetField: 'credential.purpose',
      transformation: 'Enum conversion',
      enabled: true,
    },
    {
      id: 'rule-3',
      name: 'License Board Status',
      sourceField: 'LICENSING_BOARD.status',
      targetField: 'credential.status',
      transformation: 'Status normalization',
      enabled: false,
    },
  ]
}

function buildMockPolicyDefaults(): PolicyDefault[] {
  return [
    {
      id: 'policy-1',
      name: 'Default Retention Period',
      value: '7 years',
      description: 'Default data retention period for interoperability records',
      category: 'compliance',
    },
    {
      id: 'policy-2',
      name: 'Max Request Size',
      value: '10MB',
      description: 'Maximum request payload size for external connectors',
      category: 'performance',
    },
    {
      id: 'policy-3',
      name: 'Encryption Standard',
      value: 'AES-256',
      description: 'Default encryption standard for data in transit',
      category: 'security',
    },
    {
      id: 'policy-4',
      name: 'Audit Log Level',
      value: 'INFO',
      description: 'Default logging level for interoperability operations',
      category: 'compliance',
    },
  ]
}

function buildMockSchemaMappings(): CredentialSchemaMapping[] {
  return [
    {
      id: 'schema-1',
      sourceSchema: 'FHIR/Practitioner',
      targetSchema: 'W3C/VerifiableCredential',
      mapping: {
        'id': 'credentialSubject.id',
        'name': 'credentialSubject.name',
        'qualification': 'credentialSubject.qualification',
      },
      enabled: true,
    },
    {
      id: 'schema-2',
      sourceSchema: 'TEFCA/Credential',
      targetSchema: 'W3C/VerifiableCredential',
      mapping: {
        'practitionerId': 'credentialSubject.id',
        'credentialType': 'type',
        'issuanceDate': 'issuanceDate',
      },
      enabled: true,
    },
  ]
}

function buildMockSafeguards(): ComplianceSafeguard[] {
  return [
    {
      id: 'safeguard-1',
      name: 'HIPAA Compliance Enforcement',
      description: 'Enforces HIPAA compliance checks on all data exchanges',
      enabled: true,
      critical: true,
    },
    {
      id: 'safeguard-2',
      name: 'POU (Purpose of Use) Validation',
      description: 'Validates Purpose of Use declarations in TEFCA transactions',
      enabled: true,
      critical: true,
    },
    {
      id: 'safeguard-3',
      name: 'Audit Trail Logging',
      description: 'Maintains comprehensive audit trails for all interoperability operations',
      enabled: true,
      critical: true,
    },
    {
      id: 'safeguard-4',
      name: 'Data Encryption in Transit',
      description: 'Enforces TLS 1.3 encryption for all external connections',
      enabled: true,
      critical: false,
    },
    {
      id: 'safeguard-5',
      name: 'Rate Limiting',
      description: 'Implements rate limiting to prevent abuse',
      enabled: true,
      critical: false,
    },
  ]
}

