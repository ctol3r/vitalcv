'use client';

/**
 * B142B-FE-005: In-App Status Banner
 *
 * Displays system status information from status page API
 * Shows either:
 * - "All systems operational" (green)
 * - Incident summary with link to full status page (yellow/red)
 *
 * Auto-refreshes every 60 seconds
 * Dismissible but respects incident severity
 */

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ExternalLink,
  Activity,
} from 'lucide-react';

enum ComponentStatus {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED_PERFORMANCE = 'DEGRADED_PERFORMANCE',
  PARTIAL_OUTAGE = 'PARTIAL_OUTAGE',
  MAJOR_OUTAGE = 'MAJOR_OUTAGE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
}

interface StatusPageData {
  overallStatus: ComponentStatus;
  activeIncidents: ActiveIncident[];
  scheduledMaintenances: ScheduledMaintenance[];
  affectedComponents: string[];
  lastUpdated: string;
}

interface ActiveIncident {
  id: string;
  name: string;
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
  impact: ComponentStatus;
  shortDescription: string;
  affectedComponents: string[];
  createdAt: string;
  statusPageUrl: string;
}

interface ScheduledMaintenance {
  id: string;
  name: string;
  scheduledFor: string;
  duration: string;
  affectedComponents: string[];
}

export function StatusBanner() {
  const [statusData, setStatusData] = useState<StatusPageData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatusData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatusData, 60000);

    return () => clearInterval(interval);
  }, []);

  async function fetchStatusData() {
    try {
      const response = await fetch('/api/status');

      if (!response.ok) throw new Error('Failed to fetch status');

      const data = await response.json();
      setStatusData(data);

      // If there's a new major incident, un-dismiss the banner
      if (data.overallStatus === ComponentStatus.MAJOR_OUTAGE) {
        setDismissed(false);
      }
    } catch (error) {
      console.error('Error fetching status data:', error);
      // Use mock data for demo
      setStatusData(getMockStatusData());
    } finally {
      setLoading(false);
    }
  }

  function getMockStatusData(): StatusPageData {
    // Mock: Simulates operational status (change for testing)
    return {
      overallStatus: ComponentStatus.OPERATIONAL,
      activeIncidents: [],
      scheduledMaintenances: [],
      affectedComponents: [],
      lastUpdated: new Date().toISOString(),
    };

    // Uncomment to test degraded status:
    // return {
    //   overallStatus: ComponentStatus.DEGRADED_PERFORMANCE,
    //   activeIncidents: [
    //     {
    //       id: 'inc-001',
    //       name: 'Elevated API Latency',
    //       status: 'MONITORING',
    //       impact: ComponentStatus.DEGRADED_PERFORMANCE,
    //       shortDescription: 'We are experiencing elevated API response times. Our team is actively working to resolve this.',
    //       affectedComponents: ['API', 'Credential Issuance'],
    //       createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    //       statusPageUrl: 'https://status.example.com/incidents/inc-001',
    //     },
    //   ],
    //   scheduledMaintenances: [],
    //   affectedComponents: ['API', 'Credential Issuance'],
    //   lastUpdated: new Date().toISOString(),
    // };
  }

  function getStatusConfig(status: ComponentStatus) {
    switch (status) {
      case ComponentStatus.OPERATIONAL:
        return {
          icon: CheckCircle2,
          title: 'All Systems Operational',
          description: 'All systems are running normally.',
          variant: 'default' as const,
          className: 'border-green-200 bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100',
          iconClassName: 'text-green-600 dark:text-green-400',
          dismissible: true,
        };
      case ComponentStatus.DEGRADED_PERFORMANCE:
        return {
          icon: Activity,
          title: 'Degraded Performance',
          description: 'Some services are experiencing performance issues.',
          variant: 'default' as const,
          className: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-900 dark:text-yellow-100',
          iconClassName: 'text-yellow-600 dark:text-yellow-400',
          dismissible: true,
        };
      case ComponentStatus.PARTIAL_OUTAGE:
        return {
          icon: AlertTriangle,
          title: 'Partial Service Outage',
          description: 'Some services are currently unavailable.',
          variant: 'default' as const,
          className: 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 text-orange-900 dark:text-orange-100',
          iconClassName: 'text-orange-600 dark:text-orange-400',
          dismissible: false,
        };
      case ComponentStatus.MAJOR_OUTAGE:
        return {
          icon: AlertCircle,
          title: 'Major Service Outage',
          description: 'Multiple critical services are affected.',
          variant: 'destructive' as const,
          className: 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100',
          iconClassName: 'text-red-600 dark:text-red-400',
          dismissible: false,
        };
      case ComponentStatus.UNDER_MAINTENANCE:
        return {
          icon: Activity,
          title: 'Scheduled Maintenance',
          description: 'Planned maintenance is in progress.',
          variant: 'default' as const,
          className: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100',
          iconClassName: 'text-blue-600 dark:text-blue-400',
          dismissible: true,
        };
    }
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  }

  // Don't show banner if dismissed and not a major incident
  if (dismissed && statusData?.overallStatus !== ComponentStatus.MAJOR_OUTAGE) {
    return null;
  }

  // Don't show if operational and no scheduled maintenance
  if (
    statusData?.overallStatus === ComponentStatus.OPERATIONAL &&
    statusData.scheduledMaintenances.length === 0
  ) {
    return null;
  }

  if (loading || !statusData) {
    return null;
  }

  const config = getStatusConfig(statusData.overallStatus);
  const Icon = config.icon;
  const hasActiveIncident = statusData.activeIncidents.length > 0;
  const incident = statusData.activeIncidents[0]; // Show first/most critical incident

  return (
    <div className="border-b">
      <Alert className={`rounded-none border-x-0 border-t-0 ${config.className}`}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 ${config.iconClassName}`} />

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <AlertTitle className="font-semibold">{config.title}</AlertTitle>
                {hasActiveIncident ? (
                  <AlertDescription className="mt-1">
                    <span className="font-medium">{incident.name}</span>
                    {' • '}
                    <span>{incident.shortDescription}</span>
                  </AlertDescription>
                ) : (
                  <AlertDescription className="mt-1">
                    {config.description}
                  </AlertDescription>
                )}
              </div>

              {config.dismissible && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setDismissed(true)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              )}
            </div>

            {/* Incident Details */}
            {hasActiveIncident && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="font-normal">
                  Status: {incident.status}
                </Badge>

                {incident.affectedComponents.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Affected:</span>
                    <span className="font-medium">{incident.affectedComponents.join(', ')}</span>
                  </div>
                )}

                <span className="text-muted-foreground">
                  Started {formatTimeAgo(incident.createdAt)}
                </span>

                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-current underline"
                  onClick={() => window.open(incident.statusPageUrl, '_blank')}
                >
                  View Details
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Scheduled Maintenance */}
            {statusData.scheduledMaintenances.length > 0 && (
              <div className="pt-2 border-t border-current/10">
                <p className="text-sm font-medium mb-1">Upcoming Maintenance:</p>
                {statusData.scheduledMaintenances.map((maintenance) => (
                  <div key={maintenance.id} className="text-sm text-muted-foreground">
                    <span className="font-medium">{maintenance.name}</span>
                    {' - '}
                    <span>{new Date(maintenance.scheduledFor).toLocaleString()}</span>
                    {' '}
                    <span>({maintenance.duration})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Alert>
    </div>
  );
}

/**
 * Compact version for global layout
 * Shows minimal status indicator with click to expand
 */
export function StatusIndicator() {
  const [statusData, setStatusData] = useState<StatusPageData | null>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatusData(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }

  if (!statusData) return null;

  const isOperational = statusData.overallStatus === ComponentStatus.OPERATIONAL;

  return (
    <a
      href="https://status.example.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className={`h-2 w-2 rounded-full ${isOperational ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
      <span>{isOperational ? 'All Systems Operational' : 'System Status'}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

