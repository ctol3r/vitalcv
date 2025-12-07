'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminAIApi } from '@/lib/admin/api';
import { AIDecisionLog } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Eye,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AIDecisionDetailPanel } from '@/components/admin/AIDecisionDetailPanel';

export default function AIDecisionLogsPage() {
  const [logs, setLogs] = useState<AIDecisionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AIDecisionLog | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterReviewed, setFilterReviewed] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: any = { limit: 100 };
      if (filterType !== 'all') filters.type = filterType;
      if (filterReviewed !== 'all') filters.reviewed = filterReviewed === 'reviewed';

      const results = await adminAIApi.getDecisionLogs(filters);
      setLogs(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI decision logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterReviewed]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleOverride = async (decisionId: string, override: 'safe' | 'escalate' | 'ignore', reason: string) => {
    try {
      await adminAIApi.overrideDecision(decisionId, override, reason);
      fetchLogs();
      if (selectedLog?.id === decisionId) {
        setSelectedLog(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to override decision');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credential_anomaly':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'skill_flag':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'compliance_notice':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'fraud_detection':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Decision Logs</h1>
          <p className="text-muted-foreground">
            Review and override AI decisions, anomalies, and compliance notices
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline">
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
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credential_anomaly">Credential Anomaly</SelectItem>
                  <SelectItem value="skill_flag">Skill Flag</SelectItem>
                  <SelectItem value="compliance_notice">Compliance Notice</SelectItem>
                  <SelectItem value="fraud_detection">Fraud Detection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Review Status</label>
              <Select value={filterReviewed} onValueChange={setFilterReviewed}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unreviewed">Unreviewed</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
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

      {/* Results */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Log List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Decision Logs ({logs.length})</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No decision logs found
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card
                  key={log.id}
                  className={`cursor-pointer transition-colors ${
                    selectedLog?.id === log.id ? 'ring-2 ring-primary' : ''
                  } ${!log.reviewed ? 'border-l-4 border-l-yellow-500' : ''}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(log.type)}
                          <span className="font-medium capitalize">
                            {log.type.replace(/_/g, ' ')}
                          </span>
                          {!log.reviewed && (
                            <Badge variant="secondary" className="text-xs">
                              Unreviewed
                            </Badge>
                          )}
                          {log.override && (
                            <Badge variant="outline" className="text-xs">
                              {log.override}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {log.decision}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {log.resourceType}
                          </Badge>
                          <span>Confidence: {Math.round(log.confidence * 100)}%</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div>
          {selectedLog ? (
            <AIDecisionDetailPanel
              log={selectedLog}
              onOverride={handleOverride}
              onClose={() => setSelectedLog(null)}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a decision log to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

