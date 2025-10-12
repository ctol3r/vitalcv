'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Database,
  Server,
  Activity,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
}

interface RedisHealth {
  status: 'healthy' | 'unhealthy'
  redis_enabled: boolean
  timestamp: string
}

interface SystemHealth {
  app: HealthStatus | null
  redis: RedisHealth | null
  lastChecked: Date
}

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth>({
    app: null,
    redis: null,
    lastChecked: new Date(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)

    try {
      const [appResponse, redisResponse] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/health/redis'),
      ])

      const appData = appResponse.ok ? await appResponse.json() : null
      const redisData = redisResponse.ok ? await redisResponse.json() : null

      setHealth({
        app: appData,
        redis: redisData,
        lastChecked: new Date(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check system health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Healthy
          </Badge>
        )
      case 'degraded':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Degraded
          </Badge>
        )
      case 'unhealthy':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="mr-1 h-3 w-3" />
            Unhealthy
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Unknown
          </Badge>
        )
    }
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const overallStatus = (): 'healthy' | 'degraded' | 'unhealthy' => {
    if (!health.app) return 'unhealthy'
    if (health.app.status === 'unhealthy') return 'unhealthy'
    if (health.redis?.redis_enabled && health.redis.status === 'unhealthy') return 'degraded'
    return 'healthy'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/api-docs" className="text-gray-600 hover:text-blue-600 transition-colors">
              API Docs
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Activity className="h-10 w-10 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900">System Health</h1>
            </div>
            <p className="text-lg text-gray-600">Real-time status of VitalCV services</p>
          </div>

          {/* Overall Status */}
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Overall System Status
                  </CardTitle>
                  <CardDescription>
                    Last checked: {health.lastChecked.toLocaleTimeString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(overallStatus())}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkHealth}
                    disabled={loading}
                    aria-label="Refresh health status"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Application Health */}
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-6 w-6 text-blue-600" />
                  <div>
                    <CardTitle>Application Server</CardTitle>
                    <CardDescription>Next.js API and frontend</CardDescription>
                  </div>
                </div>
                {getStatusBadge(health.app?.status)}
              </div>
            </CardHeader>
            <CardContent>
              {health.app ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      Uptime
                    </div>
                    <div className="text-lg font-semibold">{formatUptime(health.app.uptime)}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <div className="text-lg font-semibold capitalize">{health.app.status}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Last Check</div>
                    <div className="text-lg font-semibold">
                      {new Date(health.app.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading application health...</p>
              )}
            </CardContent>
          </Card>

          {/* Redis Health */}
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-green-600" />
                  <div>
                    <CardTitle>Redis Cache</CardTitle>
                    <CardDescription>Session storage and rate limiting</CardDescription>
                  </div>
                </div>
                {health.redis?.redis_enabled ? (
                  getStatusBadge(health.redis?.status)
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {health.redis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Enabled</div>
                    <div className="text-lg font-semibold">
                      {health.redis.redis_enabled ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <div className="text-lg font-semibold capitalize">{health.redis.status}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading Redis health...</p>
              )}
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  About Health Checks
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p>
                  Health checks are performed every 30 seconds. The application health check
                  verifies the Next.js server is running. Redis health checks verify the cache is
                  accessible for session management.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p>
                  For production monitoring, integrate with services like DataDog, New Relic, or
                  CloudWatch. All health endpoints support automated monitoring and alerting.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Link href="/api-docs" className="text-blue-600 hover:underline text-sm">
              View API Documentation →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
