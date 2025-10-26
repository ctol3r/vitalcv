'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CredentialEvent, getAllEvents } from '@/lib/event-cache';
import { Activity, Calendar, CheckCircle, FileText, TrendingUp, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AnalyticsData {
  totalIssued: number;
  totalVerified: number;
  totalRevoked: number;
  verificationRate: number;
  revocationRate: number;
  recentActivity: CredentialEvent[];
  dailyStats: {
    date: string;
    issued: number;
    verified: number;
    revoked: number;
  }[];
}

export function DashboardAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalIssued: 0,
    totalVerified: 0,
    totalRevoked: 0,
    verificationRate: 0,
    revocationRate: 0,
    recentActivity: [],
    dailyStats: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateAnalytics = () => {
      try {
        const events = getAllEvents();

        // Calculate totals
        const totalIssued = events.filter((e: CredentialEvent) => e.type === 'issued').length;
        const totalVerified = events.filter((e: CredentialEvent) => e.type === 'verified').length;
        const totalRevoked = events.filter((e: CredentialEvent) => e.type === 'revoked').length;

        // Calculate rates
        const verificationRate = totalIssued > 0 ? (totalVerified / totalIssued) * 100 : 0;
        const revocationRate = totalIssued > 0 ? (totalRevoked / totalIssued) * 100 : 0;

        // Get recent activity (last 10 events)
        const recentActivity = events
          .sort(
            (a: CredentialEvent, b: CredentialEvent) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, 10);

        // Calculate daily stats for last 7 days
        const dailyStats = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];

          const dayEvents = events.filter((e: CredentialEvent) => e.timestamp.startsWith(dateStr));

          dailyStats.push({
            date: dateStr,
            issued: dayEvents.filter((e: CredentialEvent) => e.type === 'issued').length,
            verified: dayEvents.filter((e: CredentialEvent) => e.type === 'verified').length,
            revoked: dayEvents.filter((e: CredentialEvent) => e.type === 'revoked').length,
          });
        }

        setAnalytics({
          totalIssued,
          totalVerified,
          totalRevoked,
          verificationRate,
          revocationRate,
          recentActivity,
          dailyStats,
        });
      } catch (err) {
        console.error('Failed to calculate analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    calculateAnalytics();
  }, []);

  const getEventIcon = (type: string, status?: string) => {
    switch (type) {
      case 'issued':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'verified':
        if (status === 'valid') return <CheckCircle className="h-4 w-4 text-green-600" />;
        if (status === 'revoked') return <XCircle className="h-4 w-4 text-red-600" />;
        return <Activity className="h-4 w-4 text-yellow-600" />;
      case 'revoked':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventColor = (type: string, status?: string) => {
    switch (type) {
      case 'issued':
        return 'text-blue-600 bg-blue-50';
      case 'verified':
        if (status === 'valid') return 'text-green-600 bg-green-50';
        if (status === 'revoked') return 'text-red-600 bg-red-50';
        return 'text-yellow-600 bg-yellow-50';
      case 'revoked':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.totalIssued}</div>
            <p className="text-xs text-gray-600 dark:text-gray-300">Credentials issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.totalVerified}</div>
            <p className="text-xs text-gray-600 dark:text-gray-300">Verification events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revoked</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics.totalRevoked}</div>
            <p className="text-xs text-gray-600 dark:text-gray-300">Revocation events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {analytics.verificationRate.toFixed(1)}%
            </div>
            <Progress value={analytics.verificationRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Activity (Last 7 Days)
          </CardTitle>
          <CardDescription>Track credential operations over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.dailyStats.map((day, index) => {
              const total = day.issued + day.verified + day.revoked;
              const maxDay = Math.max(
                ...analytics.dailyStats.map((d) => d.issued + d.verified + d.revoked),
              );
              const height = maxDay > 0 ? (total / maxDay) * 100 : 0;

              return (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-20 text-sm text-gray-600 dark:text-gray-300">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1 flex items-end gap-1 h-8">
                    {day.issued > 0 && (
                      <div
                        className="bg-blue-500 rounded-t"
                        style={{ height: `${(day.issued / maxDay) * 100}%` }}
                        title={`${day.issued} issued`}
                      />
                    )}
                    {day.verified > 0 && (
                      <div
                        className="bg-green-500"
                        style={{ height: `${(day.verified / maxDay) * 100}%` }}
                        title={`${day.verified} verified`}
                      />
                    )}
                    {day.revoked > 0 && (
                      <div
                        className="bg-red-500 rounded-t"
                        style={{ height: `${(day.revoked / maxDay) * 100}%` }}
                        title={`${day.revoked} revoked`}
                      />
                    )}
                    {total === 0 && <div className="w-full h-1 bg-gray-200 rounded" />}
                  </div>
                  <div className="w-16 text-right text-sm text-gray-600 dark:text-gray-300">
                    {total} total
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest credential operations</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No recent activity</p>
              <p className="text-sm">Activity will appear here as you use the system</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.recentActivity.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div
                    className={`p-2 rounded-full ${getEventColor(
                      event.type,
                      event.details?.status,
                    )}`}
                  >
                    {getEventIcon(event.type, event.details?.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="capitalize text-xs">
                        {event.type}
                      </Badge>
                      {event.details?.status && (
                        <Badge
                          variant={event.details.status === 'valid' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {event.details.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{event.credentialId}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
