'use client'

import { useState, useEffect } from 'react'
import { Shield, Calendar, Building2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ConsentRecord {
  id: string
  purpose: string
  description: string
  entity: string
  duration: string
  grantedAt: string
  expiresAt: string | null
  status: 'active' | 'expired' | 'revoked'
  scopes: string[]
}

export default function ConsentSettings() {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; consent: ConsentRecord | null }>(
    { open: false, consent: null }
  )

  useEffect(() => {
    loadConsents()
  }, [])

  async function loadConsents() {
    try {
      const res = await fetch('/api/demo/privacy/consent')
      if (res.ok) {
        const data = await res.json()
        setConsents(data.consents || mockConsentRecords())
      } else {
        setConsents(mockConsentRecords())
      }
    } catch (err) {
      setConsents(mockConsentRecords())
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(consent: ConsentRecord) {
    try {
      const res = await fetch(`/api/demo/privacy/consent/${consent.id}/revoke`, {
        method: 'POST',
      })

      if (res.ok) {
        setConsents((prev) =>
          prev.map((c) => (c.id === consent.id ? { ...c, status: 'revoked' as const } : c))
        )
        setRevokeDialog({ open: false, consent: null })
      }
    } catch (err) {
      console.error('Failed to revoke consent', err)
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never expires'
    return new Date(dateString).toLocaleDateString()
  }

  function getDaysUntilExpiry(expiresAt: string | null): number | null {
    if (!expiresAt) return null
    const expiry = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  const activeConsents = consents.filter((c) => c.status === 'active')
  const expiredConsents = consents.filter((c) => c.status === 'expired')
  const revokedConsents = consents.filter((c) => c.status === 'revoked')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading consent records...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consent Management
          </CardTitle>
          <CardDescription>
            View and manage consent given for data sharing with third parties
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{activeConsents.length}</div>
              <div className="text-sm text-muted-foreground">Active Consents</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{expiredConsents.length}</div>
              <div className="text-sm text-muted-foreground">Expired</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{revokedConsents.length}</div>
              <div className="text-sm text-muted-foreground">Revoked</div>
            </div>
          </div>

          {/* Active Consents */}
          {activeConsents.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Active Consents</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeConsents.map((consent) => {
                    const daysUntilExpiry = getDaysUntilExpiry(consent.expiresAt)
                    return (
                      <TableRow key={consent.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{consent.purpose}</div>
                            <div className="text-sm text-muted-foreground">
                              {consent.description}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {consent.scopes.map((scope) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{consent.entity}</span>
                          </div>
                        </TableCell>
                        <TableCell>{consent.duration}</TableCell>
                        <TableCell>
                          {daysUntilExpiry !== null ? (
                            <div>
                              <div>{formatDate(consent.expiresAt)}</div>
                              {daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {daysUntilExpiry} days left
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="default">No expiry</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeDialog({ open: true, consent })}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Expired Consents */}
          {expiredConsents.length > 0 && (
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold text-muted-foreground">Expired Consents</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Expired</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredConsents.map((consent) => (
                    <TableRow key={consent.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{consent.purpose}</div>
                          <div className="text-sm text-muted-foreground">{consent.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>{consent.entity}</TableCell>
                      <TableCell>{formatDate(consent.expiresAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Revoked Consents */}
          {revokedConsents.length > 0 && (
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold text-muted-foreground">Revoked Consents</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Revoked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revokedConsents.map((consent) => (
                    <TableRow key={consent.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{consent.purpose}</div>
                          <div className="text-sm text-muted-foreground">{consent.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>{consent.entity}</TableCell>
                      <TableCell>{formatDate(consent.grantedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {consents.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No consent records found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            About Consent Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">What is consent?</div>
              <div className="text-muted-foreground">
                Consent records track when you've given permission for third parties to access your
                data. This includes sharing credentials, audit logs, or other personal information.
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Revoking consent</div>
              <div className="text-muted-foreground">
                When you revoke consent, the third party will immediately lose access to your data.
                However, they may have already processed data shared before revocation.
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Expiration</div>
              <div className="text-muted-foreground">
                Some consents have expiration dates. Once expired, access is automatically revoked.
                You'll be notified before consents expire.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, consent: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Consent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke consent for <strong>{revokeDialog.consent?.purpose}</strong> with{' '}
              <strong>{revokeDialog.consent?.entity}</strong>? This will immediately stop them from
              accessing your data. Note that they may have already processed data shared before
              revocation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeDialog.consent && handleRevoke(revokeDialog.consent)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Consent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function mockConsentRecords(): ConsentRecord[] {
  return [
    {
      id: 'consent-1',
      purpose: 'Credential Verification',
      description: 'Allow verification of medical credentials for employment purposes',
      entity: 'Healthcare Organization A',
      duration: '1 year',
      grantedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      scopes: ['read:credentials', 'verify:credentials'],
    },
    {
      id: 'consent-2',
      purpose: 'Research Participation',
      description: 'Share anonymized data for medical research',
      entity: 'Research Institution B',
      duration: '2 years',
      grantedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 610 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      scopes: ['read:anonymized'],
    },
    {
      id: 'consent-3',
      purpose: 'Background Check',
      description: 'Allow access to credential history for background verification',
      entity: 'Verification Service C',
      duration: '6 months',
      grantedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'expired',
      scopes: ['read:credentials', 'read:logs'],
    },
    {
      id: 'consent-4',
      purpose: 'Marketing',
      description: 'Allow use of data for marketing purposes',
      entity: 'Marketing Company D',
      duration: 'Indefinite',
      grantedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: null,
      status: 'revoked',
      scopes: ['read:profile'],
    },
  ]
}

