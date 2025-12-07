'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllEvents, getRecentEvents } from '@/lib/event-cache';
import {
  Activity,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AnalyticsData {
  total: {
    issued: number;
    verified: number;
    revoked: number;
    total: number;
  };
  recent: {
    issued: number;
    verified: number;
    revoked: number;
    total: number;
  };
  trends: {
    issued: 'up' | 'down' | 'stable';
    verified: 'up' | 'down' | 'stable';
    revoked: 'up' | 'down' | 'stable';
  };
}

export function AnalyticsCard() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    total: { issued: 0, verified: 0, revoked: 0, total: 0 },
    recent: { issued: 0, verified: 0, revoked: 0, total: 0 },
    trends: { issued: 'stable', verified: 'stable', revoked: 'stable' },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = () => {
    setIsLoading(true);
    try {
      const allEvents = getAllEvents();
      const recentEvents = getRecentEvents(24);

      const totalStats = {
        issued: allEvents.filter((e) => e.type === 'issued').length,
        verified: allEvents.filter((e) => e.type === 'verified').length,
        revoked: allEvents.filter((e) => e.type === 'revoked').length,
        total: allEvents.length,
      };

      const recentStats = {
        issued: recentEvents.filter((e) => e.type === 'issued').length,
        verified: recentEvents.filter((e) => e.type === 'verified').length,
        revoked: recentEvents.filter((e) => e.type === 'revoked').length,
        total: recentEvents.length,
      };

      // Simple trend calculation (compare last 24h vs previous 24h)
      const previousEvents = getRecentEvents(48).filter((e) => {
        const eventTime = new Date(e.timestamp);
        const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return eventTime < cutoff24h;
      });

      const trends = {
        issued: calculateTrend(
          recentStats.issued,
          previousEvents.filter((e) => e.type === 'issued').length,
        ),
        verified: calculateTrend(
          recentStats.verified,
          previousEvents.filter((e) => e.type === 'verified').length,
        ),
        revoked: calculateTrend(
          recentStats.revoked,
          previousEvents.filter((e) => e.type === 'revoked').length,
        ),
      };

      setAnalytics({
        total: totalStats,
        recent: recentStats,
        trends,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Activity className="h-3 w-3 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Analytics
          </CardTitle>
          <CardDescription>Loading analytics data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Analytics
            </CardTitle>
            <CardDescription>Credential activity overview</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAnalytics}
            className="h-8 w-8 p-0"
            aria-label="Refresh analytics"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Stats */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">All Time</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Issued</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{analytics.total.issued}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Verified</span>
              </div>
              <span className="text-lg font-bold text-green-600">{analytics.total.verified}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Revoked</span>
              </div>
              <span className="text-lg font-bold text-red-600">{analytics.total.revoked}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <span className="text-lg font-bold text-gray-600">{analytics.total.total}</span>
            </div>
          </div>
        </div>

        {/* Recent Stats */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Last 24 Hours</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Issued</span>
                {getTrendIcon(analytics.trends.issued)}
              </div>
              <span className={`text-lg font-bold ${getTrendColor(analytics.trends.issued)}`}>
                {analytics.recent.issued}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Verified</span>
                {getTrendIcon(analytics.trends.verified)}
              </div>
              <span className={`text-lg font-bold ${getTrendColor(analytics.trends.verified)}`}>
                {analytics.recent.verified}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Revoked</span>
                {getTrendIcon(analytics.trends.revoked)}
              </div>
              <span className={`text-lg font-bold ${getTrendColor(analytics.trends.revoked)}`}>
                {analytics.recent.revoked}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <span className="text-lg font-bold text-gray-600">{analytics.recent.total}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {analytics.recent.total > 0 ? (
                <>{analytics.recent.total} events in last 24h</>
              ) : (
                'No recent activity'
              )}
            </span>
            <div className="flex gap-2">
              <Link href="/wallet/access-log">
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                  View Log
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                  Full Analytics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
