'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminActivityApi } from '@/lib/admin/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  Filter,
  Download,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string>('all');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: any = { limit: 100 };
      if (filterResourceType !== 'all') {
        filters.resourceType = filterResourceType;
      }

      const results = await adminActivityApi.getActivityLogs(filters);
      setActivities(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity logs');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [filterResourceType]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground">
            View all admin actions and system events across the platform
          </p>
        </div>
        <Button onClick={fetchActivities} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Resource Type</label>
              <Select value={filterResourceType} onValueChange={setFilterResourceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                  <SelectItem value="credential">Credential</SelectItem>
                  <SelectItem value="chain">Chain</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({activities.length})</CardTitle>
          <CardDescription>
            All admin actions are logged for audit and compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{activity.adminEmail || 'System'}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.resourceType}
                      </Badge>
                      {activity.resourceId && (
                        <span className="text-xs text-muted-foreground">
                          ID: {activity.resourceId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{activity.action}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right ml-4">
                    <div>{new Date(activity.timestamp).toLocaleString()}</div>
                    {activity.ipAddress && (
                      <div className="mt-1 text-xs">{activity.ipAddress}</div>
                    )}
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

