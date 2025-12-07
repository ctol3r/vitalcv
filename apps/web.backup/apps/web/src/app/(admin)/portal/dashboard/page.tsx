'use client';

import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Building2,
  Shield,
  Link2,
  Brain,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { state, refetch } = useAdminDashboard();

  if (state.status === 'loading') {
    return (
      <div className="p-8 space-y-8">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {state.error || 'Failed to load dashboard data'}
            <Button onClick={refetch} variant="outline" size="sm" className="ml-4">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { stats, recentActivity, alerts } = state.data!;

  const chainHealthColor = {
    healthy: 'text-green-600',
    degraded: 'text-yellow-600',
    down: 'text-red-600',
  }[stats.chainHealth];

  const chainHealthIcon = {
    healthy: CheckCircle,
    degraded: AlertCircle,
    down: XCircle,
  }[stats.chainHealth];

  const ChainHealthIcon = chainHealthIcon;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Your internal cockpit for the entire VitalCV platform
          </p>
        </div>
        <Button onClick={refetch} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical Alerts:</strong>{' '}
            {alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length} unacknowledged
            critical alerts require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <Link href="/portal/users">
              <Button variant="link" className="p-0 h-auto mt-2">
                View Directory →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Facilities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFacilities.toLocaleString()}</div>
            <Link href="/portal/facilities">
              <Button variant="link" className="p-0 h-auto mt-2">
                Manage Facilities →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCredentials.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active verifications: {stats.activeVerifications}
            </p>
          </CardContent>
        </Card>

        {/* Chain Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chain Health</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ChainHealthIcon className={`h-5 w-5 ${chainHealthColor}`} />
              <span className={`text-2xl font-bold capitalize ${chainHealthColor}`}>
                {stats.chainHealth}
              </span>
            </div>
            <Link href="/portal/chain">
              <Button variant="link" className="p-0 h-auto mt-2">
                Monitor Chain →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* AI Decisions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Decisions Today</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.aiDecisionsToday.toLocaleString()}</div>
            <Link href="/portal/ai">
              <Button variant="link" className="p-0 h-auto mt-2">
                View AI Logs →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analytics</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/portal/analytics">
              <Button variant="link" className="p-0 h-auto">
                View Platform Analytics →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/portal/users">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Search, manage, and support users across the platform
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/facilities">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Facility Management
              </CardTitle>
              <CardDescription>
                Onboard, monitor, and manage hospital clients
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/chain">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Chain Monitoring
              </CardTitle>
              <CardDescription>
                Monitor multi-chain health and anchor backlogs
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/ai">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Decision Logs
              </CardTitle>
              <CardDescription>
                Review and override AI decisions and anomalies
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/analytics">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics & Reports
              </CardTitle>
              <CardDescription>
                Platform metrics, compliance dashboards, and exports
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/activity">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                View all admin actions and system events
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest admin actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.adminEmail}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.resourceType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/portal/activity">
              <Button variant="link" className="w-full mt-4">
                View All Activity →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

