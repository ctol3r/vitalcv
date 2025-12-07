'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  GitBranch,
  RotateCcw,
  TrendingUp,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

interface Deployment {
  id: string
  service: string
  environment: string
  blueVersion: string
  greenVersion: string
  activeEnvironment: 'blue' | 'green'
  trafficSplit: {
    blue: number
    green: number
  }
  status: 'idle' | 'deploying' | 'promoting' | 'rolling-back'
  lastDeployAt: string
  lastDeployOutcome: 'success' | 'failure' | null
  healthCheck: {
    blue: 'healthy' | 'degraded' | 'unhealthy'
    green: 'healthy' | 'degraded' | 'unhealthy'
  }
}

const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: 'deploy-1',
    service: 'auth-service',
    environment: 'production',
    blueVersion: 'v2.3.1',
    greenVersion: 'v2.4.0',
    activeEnvironment: 'blue',
    trafficSplit: {
      blue: 100,
      green: 0,
    },
    status: 'idle',
    lastDeployAt: '2025-11-16T08:00:00Z',
    lastDeployOutcome: 'success',
    healthCheck: {
      blue: 'healthy',
      green: 'healthy',
    },
  },
  {
    id: 'deploy-2',
    service: 'credential-service',
    environment: 'production',
    blueVersion: 'v1.8.2',
    greenVersion: 'v1.9.0',
    activeEnvironment: 'blue',
    trafficSplit: {
      blue: 80,
      green: 20,
    },
    status: 'promoting',
    lastDeployAt: '2025-11-16T09:00:00Z',
    lastDeployOutcome: null,
    healthCheck: {
      blue: 'healthy',
      green: 'healthy',
    },
  },
  {
    id: 'deploy-3',
    service: 'reputation-service',
    environment: 'staging',
    blueVersion: 'v3.1.0',
    greenVersion: 'v3.2.0-beta',
    activeEnvironment: 'green',
    trafficSplit: {
      blue: 0,
      green: 100,
    },
    status: 'idle',
    lastDeployAt: '2025-11-16T07:30:00Z',
    lastDeployOutcome: 'success',
    healthCheck: {
      blue: 'degraded',
      green: 'healthy',
    },
  },
]

export function DeploymentStatus() {
  const [deployments, setDeployments] = useState<Deployment[]>(MOCK_DEPLOYMENTS)
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
  const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'deploying':
      case 'promoting':
        return <Clock className="h-4 w-4 animate-pulse text-blue-600" />
      case 'rolling-back':
        return <RotateCcw className="h-4 w-4 animate-spin text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'idle':
        return 'default'
      case 'deploying':
      case 'promoting':
        return 'default'
      case 'rolling-back':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'default'
      case 'degraded':
        return 'secondary'
      case 'unhealthy':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const handlePromote = (deployment: Deployment) => {
    setSelectedDeployment(deployment)
    setIsPromoteDialogOpen(true)
  }

  const handleConfirmPromote = () => {
    if (!selectedDeployment) return

    setDeployments((prev) =>
      prev.map((d) =>
        d.id === selectedDeployment.id
          ? {
              ...d,
              status: 'promoting' as const,
              trafficSplit: {
                blue: d.activeEnvironment === 'blue' ? 0 : 100,
                green: d.activeEnvironment === 'blue' ? 100 : 0,
              },
            }
          : d
      )
    )

    // Simulate promotion completion
    setTimeout(() => {
      setDeployments((prev) =>
        prev.map((d) =>
          d.id === selectedDeployment.id
            ? {
                ...d,
                status: 'idle' as const,
                activeEnvironment: d.activeEnvironment === 'blue' ? 'green' : 'blue',
                lastDeployAt: new Date().toISOString(),
                lastDeployOutcome: 'success' as const,
              }
            : d
        )
      )
    }, 3000)

    setIsPromoteDialogOpen(false)
    setSelectedDeployment(null)
  }

  const handleRollback = (deployment: Deployment) => {
    setSelectedDeployment(deployment)
    setIsRollbackDialogOpen(true)
  }

  const handleConfirmRollback = () => {
    if (!selectedDeployment) return

    setDeployments((prev) =>
      prev.map((d) =>
        d.id === selectedDeployment.id
          ? {
              ...d,
              status: 'rolling-back' as const,
              trafficSplit: {
                blue: d.activeEnvironment === 'green' ? 100 : 0,
                green: d.activeEnvironment === 'green' ? 0 : 100,
              },
            }
          : d
      )
    )

    // Simulate rollback completion
    setTimeout(() => {
      setDeployments((prev) =>
        prev.map((d) =>
          d.id === selectedDeployment.id
            ? {
                ...d,
                status: 'idle' as const,
                activeEnvironment: d.activeEnvironment === 'green' ? 'blue' : 'green',
                lastDeployAt: new Date().toISOString(),
                lastDeployOutcome: 'success' as const,
              }
            : d
        )
      )
    }, 2000)

    setIsRollbackDialogOpen(false)
    setSelectedDeployment(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Deployment Status</h2>
        <p className="text-muted-foreground mt-1">
          Monitor blue/green deployments and manage traffic splits
        </p>
      </div>

      {/* Deployment Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {deployments.map((deployment) => (
          <Card key={deployment.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{deployment.service}</CardTitle>
                  <CardDescription>{deployment.environment}</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(deployment.status)}>
                  {getStatusIcon(deployment.status)}
                  <span className="ml-2">{deployment.status}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Version Info */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={cn(
                    'p-3 rounded-md border-2',
                    deployment.activeEnvironment === 'blue'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Blue</span>
                    {deployment.activeEnvironment === 'blue' && (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  <div className="text-lg font-bold">{deployment.blueVersion}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getHealthBadgeVariant(deployment.healthCheck.blue)}>
                      {deployment.healthCheck.blue}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {deployment.trafficSplit.blue}% traffic
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    'p-3 rounded-md border-2',
                    deployment.activeEnvironment === 'green'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Green</span>
                    {deployment.activeEnvironment === 'green' && (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  <div className="text-lg font-bold">{deployment.greenVersion}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getHealthBadgeVariant(deployment.healthCheck.green)}>
                      {deployment.healthCheck.green}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {deployment.trafficSplit.green}% traffic
                    </span>
                  </div>
                </div>
              </div>

              {/* Traffic Split Visualization */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Traffic Split</span>
                  <span className="text-muted-foreground">
                    {deployment.trafficSplit.blue}% / {deployment.trafficSplit.green}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-blue-500"
                      style={{ width: `${deployment.trafficSplit.blue}%` }}
                    />
                    <div
                      className="bg-green-500"
                      style={{ width: `${deployment.trafficSplit.green}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Last Deploy Info */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Deploy:</span>
                  <div className="flex items-center gap-2">
                    {getOutcomeIcon(deployment.lastDeployOutcome)}
                    <span>{formatDate(deployment.lastDeployAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {deployment.status === 'idle' && deployment.trafficSplit.green > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handlePromote(deployment)}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Promote to 100%
                  </Button>
                )}
                {deployment.status === 'idle' && deployment.trafficSplit.green > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRollback(deployment)}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rollback
                  </Button>
                )}
                {deployment.status !== 'idle' && (
                  <div className="flex-1 text-sm text-muted-foreground text-center py-2">
                    {deployment.status === 'promoting' && 'Promoting deployment...'}
                    {deployment.status === 'rolling-back' && 'Rolling back...'}
                    {deployment.status === 'deploying' && 'Deploying...'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promote Confirmation Dialog */}
      <AlertDialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote Deployment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to promote {selectedDeployment?.greenVersion} to 100% traffic for{' '}
              {selectedDeployment?.service}? This will route all traffic to the green environment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeployment(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPromote}>Promote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Deployment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback {selectedDeployment?.service} to{' '}
              {selectedDeployment?.activeEnvironment === 'green'
                ? selectedDeployment?.blueVersion
                : selectedDeployment?.greenVersion}
              ? This will route all traffic back to the previous version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeployment(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRollback}>Rollback</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

