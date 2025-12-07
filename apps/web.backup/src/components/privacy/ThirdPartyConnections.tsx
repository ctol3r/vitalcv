'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Trash2, Settings, Clock, Shield, AlertTriangle } from 'lucide-react'
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

interface ThirdPartyApp {
  id: string
  name: string
  description: string
  scopes: string[]
  lastUsed: string | null
  createdAt: string
  status: 'active' | 'expired' | 'revoked'
}

export default function ThirdPartyConnections() {
  const [apps, setApps] = useState<ThirdPartyApp[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; app: ThirdPartyApp | null }>(
    { open: false, app: null }
  )

  useEffect(() => {
    loadConnections()
  }, [])

  async function loadConnections() {
    try {
      const res = await fetch('/api/demo/privacy/third-party')
      if (res.ok) {
        const data = await res.json()
        setApps(data.apps || mockThirdPartyApps())
      } else {
        setApps(mockThirdPartyApps())
      }
    } catch (err) {
      setApps(mockThirdPartyApps())
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(app: ThirdPartyApp) {
    try {
      const res = await fetch(`/api/demo/privacy/third-party/${app.id}/revoke`, {
        method: 'POST',
      })

      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== app.id))
        setRevokeDialog({ open: false, app: null })
      }
    } catch (err) {
      console.error('Failed to revoke access', err)
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  function getScopeBadgeVariant(scope: string): 'default' | 'secondary' | 'destructive' {
    if (scope.includes('read')) return 'default'
    if (scope.includes('write')) return 'secondary'
    if (scope.includes('admin')) return 'destructive'
    return 'default'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading connections...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Third-Party Applications
              </CardTitle>
              <CardDescription>
                Manage applications that have access to your data
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <a href="/developer/portal/apps/register">Register New App</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <div className="text-center py-12">
              <ExternalLink className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No third-party applications connected</p>
              <Button variant="outline" asChild>
                <a href="/developer/portal/apps/register">Register Your First App</a>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{app.name}</div>
                        <div className="text-sm text-muted-foreground">{app.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {app.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant={getScopeBadgeVariant(scope)}
                            className="text-xs"
                          >
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(app.lastUsed)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          app.status === 'active'
                            ? 'default'
                            : app.status === 'expired'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeDialog({ open: true, app })}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <div className="font-medium">Review permissions regularly</div>
                <div className="text-muted-foreground">
                  Only grant access to applications you trust. Revoke access for apps you no longer
                  use.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium">Check scope requirements</div>
                <div className="text-muted-foreground">
                  Applications should only request the minimum permissions needed. Be cautious of
                  apps requesting broad access.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Monitor last used dates</div>
                <div className="text-muted-foreground">
                  If an app hasn't been used in a while, consider revoking its access for better
                  security.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, app: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for <strong>{revokeDialog.app?.name}</strong>?
              This will immediately stop the application from accessing your data. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeDialog.app && handleRevoke(revokeDialog.app)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function mockThirdPartyApps(): ThirdPartyApp[] {
  return [
    {
      id: 'app-1',
      name: 'Healthcare Analytics Dashboard',
      description: 'Analytics and reporting tool',
      scopes: ['read:credentials', 'read:logs'],
      lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    },
    {
      id: 'app-2',
      name: 'Credential Manager Pro',
      description: 'Credential management application',
      scopes: ['read:credentials', 'write:credentials'],
      lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    },
    {
      id: 'app-3',
      name: 'Legacy Integration',
      description: 'Old integration (no longer maintained)',
      scopes: ['read:all'],
      lastUsed: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'expired',
    },
  ]
}

