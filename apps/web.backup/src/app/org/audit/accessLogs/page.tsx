'use client';

/**
 * B141B-FE-007: Access log viewer for org admins
 *
 * Displays recent access events including:
 * - Actor (who performed the action)
 * - Timestamp (when the action occurred)
 * - Action type (what was done)
 * - Filters by event type
 * - Links to evidence or related config pages
 * - Screen reader friendly with proper ARIA labels
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Filter, ExternalLink, Eye, RefreshCw } from 'lucide-react';

interface AccessLog {
  id: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
  action: string;
  actionType: 'authentication' | 'access_control' | 'data_access' | 'configuration' | 'api_key';
  resource: string;
  resourceType: string;
  timestamp: string;
  outcome: 'success' | 'failure' | 'partial';
  ipAddress: string;
  userAgent: string;
  relatedLink?: string; // Link to evidence or config page
}

type FilterType = 'all' | 'authentication' | 'access_control' | 'data_access' | 'configuration' | 'api_key';

export default function AccessLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AccessLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccessLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, selectedFilter]);

  async function fetchAccessLogs() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/audit/access-logs');
      if (!response.ok) throw new Error('Failed to fetch access logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setFilteredLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching access logs:', error);
      // Use mock data
      const mockLogs = getMockLogs();
      setLogs(mockLogs);
      setFilteredLogs(mockLogs);
    } finally {
      setLoading(false);
    }
  }

  function getMockLogs(): AccessLog[] {
    return [
      {
        id: '1',
        actor: { id: 'user1', name: 'Alice Johnson', email: 'alice.johnson@example.com' },
        action: 'Logged in successfully',
        actionType: 'authentication',
        resource: 'Auth Service',
        resourceType: 'authentication',
        timestamp: '2025-11-13T14:32:15Z',
        outcome: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      {
        id: '2',
        actor: { id: 'user2', name: 'Bob Smith', email: 'bob.smith@example.com' },
        action: 'Assigned PrivilegeReviewer role to Carol Martinez',
        actionType: 'access_control',
        resource: 'Member: Carol Martinez',
        resourceType: 'member',
        timestamp: '2025-11-13T14:15:42Z',
        outcome: 'success',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        relatedLink: '/org/settings/members',
      },
      {
        id: '3',
        actor: { id: 'user3', name: 'Carol Martinez', email: 'carol.martinez@example.com' },
        action: 'Viewed provider credential for NPI 1234567890',
        actionType: 'data_access',
        resource: 'Credential: NPI 1234567890',
        resourceType: 'credential',
        timestamp: '2025-11-13T13:58:23Z',
        outcome: 'success',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        relatedLink: '/clinician/1234567890',
      },
      {
        id: '4',
        actor: { id: 'user1', name: 'Alice Johnson', email: 'alice.johnson@example.com' },
        action: 'Modified organization 2FA settings',
        actionType: 'configuration',
        resource: 'Organization Settings',
        resourceType: 'config',
        timestamp: '2025-11-13T13:45:10Z',
        outcome: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        relatedLink: '/org/settings',
      },
      {
        id: '5',
        actor: { id: 'user4', name: 'David Lee', email: 'david.lee@example.com' },
        action: 'Failed login attempt - invalid password',
        actionType: 'authentication',
        resource: 'Auth Service',
        resourceType: 'authentication',
        timestamp: '2025-11-13T13:22:55Z',
        outcome: 'failure',
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        id: '6',
        actor: { id: 'api-key-001', name: 'API Key (Partner Integration)', email: 'N/A' },
        action: 'Created API key for partner ATS integration',
        actionType: 'api_key',
        resource: 'API Key: ats-partner-prod',
        resourceType: 'api_key',
        timestamp: '2025-11-13T12:45:30Z',
        outcome: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Internal API',
      },
      {
        id: '7',
        actor: { id: 'user2', name: 'Bob Smith', email: 'bob.smith@example.com' },
        action: 'Updated role permissions for CredentialVerifier',
        actionType: 'access_control',
        resource: 'Role: CredentialVerifier',
        resourceType: 'role',
        timestamp: '2025-11-13T11:30:18Z',
        outcome: 'success',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        relatedLink: '/org/settings/roles/4',
      },
    ];
  }

  function applyFilters() {
    let filtered = logs;

    // Apply type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(log => log.actionType === selectedFilter);
    }

    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        log =>
          log.actor.name.toLowerCase().includes(query) ||
          log.actor.email.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.resource.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }

  function getOutcomeBadgeVariant(outcome: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (outcome) {
      case 'success':
        return 'default';
      case 'failure':
        return 'destructive';
      case 'partial':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getActionTypeBadgeVariant(actionType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (actionType) {
      case 'authentication':
        return 'outline';
      case 'access_control':
        return 'secondary';
      case 'data_access':
        return 'default';
      case 'configuration':
        return 'secondary';
      case 'api_key':
        return 'outline';
      default:
        return 'outline';
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function getFilterLabel(filter: FilterType): string {
    const labels: Record<FilterType, string> = {
      all: 'All Events',
      authentication: 'Authentication',
      access_control: 'Access Control',
      data_access: 'Data Access',
      configuration: 'Configuration',
      api_key: 'API Keys',
    };
    return labels[filter];
  }

  const filters: FilterType[] = ['all', 'authentication', 'access_control', 'data_access', 'configuration', 'api_key'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="h-8 w-8" />
            Access Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor user activity, logins, role changes, and API key usage
          </p>
        </div>
        <Button onClick={fetchAccessLogs} disabled={loading} size="default">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter
          </CardTitle>
          <CardDescription>
            Filter logs by type and search by actor, action, or resource
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by actor name, email, action, or resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search access logs"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                aria-label={`Filter by ${getFilterLabel(filter)}`}
              >
                {getFilterLabel(filter)}
              </Button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} events
          </p>
        </CardContent>
      </Card>

      {/* Access Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading access logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No access logs found matching your criteria
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Outcome</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-sm font-mono">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{log.actor.name}</p>
                        <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm">{log.action}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{log.resource}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getActionTypeBadgeVariant(log.actionType)} className="text-xs">
                        {log.actionType.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getOutcomeBadgeVariant(log.outcome)} className="text-xs">
                        {log.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {log.relatedLink && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(log.relatedLink!)}
                          aria-label={`View details for ${log.resource}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Eye className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About Access Logs</p>
              <p>
                Access logs track all significant actions performed within your organization, including authentication
                events, role assignments, data access, configuration changes, and API key usage.
              </p>
              <p>
                Use the filters to narrow down specific types of events, or search by actor name, action, or resource.
                Click the link icon to navigate to related pages for more context.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

