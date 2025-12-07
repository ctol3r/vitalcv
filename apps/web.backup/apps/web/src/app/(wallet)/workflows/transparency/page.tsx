/**
 * Batch Bundle #56 - ROUTE-005: Workflow Transparency Panel
 *
 * Let employers/clinicians see which workflow stages are running,
 * their status, logs, and dependencies.
 */

'use client';

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  GitBranch,
  PlayCircle,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  '';

interface WorkflowRoute {
  workflowId: string;
  pipeline: 'psv' | 'sanctions' | 'board_verification' | 'telehealth_eligibility' | 'compliance' | 'standard';
  priority: 'high' | 'medium' | 'low';
  steps: string[];
  estimatedDuration?: number;
  dependencies?: string[];
}

interface WorkflowStatus {
  credentialId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  completedSteps: string[];
  pendingSteps: string[];
  estimatedCompletion?: string;
  routes?: WorkflowRoute[];
}

interface WorkflowNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  duration?: number;
}

interface WorkflowExecution {
  id: string;
  dagId: string;
  credentialId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentNode?: string;
  nodes: WorkflowNode[];
  startedAt: string;
  completedAt?: string;
}

export default function WorkflowTransparencyPage() {
  const [credentialId, setCredentialId] = useState<string>('');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowExecution, setWorkflowExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (autoRefresh && credentialId) {
      const interval = setInterval(() => {
        fetchWorkflowStatus(credentialId);
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, credentialId]);

  const fetchWorkflowStatus = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/workflow/status/${id}`);
      if (!response.ok) throw new Error('Failed to fetch workflow status');

      const data = await response.json();
      setWorkflowStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow status');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowExecution = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/workflow/execution/${id}`);
      if (!response.ok) throw new Error('Failed to fetch workflow execution');

      const data = await response.json();
      setWorkflowExecution(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow execution');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (credentialId.trim()) {
      fetchWorkflowStatus(credentialId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getPipelineColor = (pipeline: string) => {
    switch (pipeline) {
      case 'psv':
        return 'bg-blue-100 text-blue-800';
      case 'sanctions':
        return 'bg-red-100 text-red-800';
      case 'board_verification':
        return 'bg-purple-100 text-purple-800';
      case 'telehealth_eligibility':
        return 'bg-green-100 text-green-800';
      case 'compliance':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = () => {
    if (!workflowStatus) return 0;
    const total = workflowStatus.completedSteps.length + workflowStatus.pendingSteps.length;
    if (total === 0) return 0;
    return (workflowStatus.completedSteps.length / total) * 100;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Transparency Panel</h1>
          <p className="text-muted-foreground mt-2">
            Monitor credential workflow stages, status, logs, and dependencies
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Workflow</CardTitle>
          <CardDescription>Enter a credential ID to view its workflow status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Enter credential ID..."
              className="flex-1 px-4 py-2 border rounded-md"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading || !credentialId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAutoRefresh(!autoRefresh)}
              disabled={!workflowStatus}
            >
              {autoRefresh ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !workflowStatus && (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {workflowStatus && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Status</CardTitle>
                <CardDescription>Current status and progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(workflowStatus.status)}
                    <span className="font-semibold capitalize">{workflowStatus.status}</span>
                  </div>
                  <Badge variant="outline">Credential: {workflowStatus.credentialId}</Badge>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>
                      {workflowStatus.completedSteps.length} /{' '}
                      {workflowStatus.completedSteps.length + workflowStatus.pendingSteps.length} steps
                    </span>
                  </div>
                  <Progress value={calculateProgress()} />
                </div>

                {workflowStatus.currentStep && (
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span>Current Step: {workflowStatus.currentStep}</span>
                  </div>
                )}

                {workflowStatus.estimatedCompletion && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Estimated completion: {new Date(workflowStatus.estimatedCompletion).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Completed Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {workflowStatus.completedSteps.map((step, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{step}</span>
                      </li>
                    ))}
                    {workflowStatus.completedSteps.length === 0 && (
                      <li className="text-sm text-muted-foreground">No completed steps</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pending Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {workflowStatus.pendingSteps.map((step, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{step}</span>
                      </li>
                    ))}
                    {workflowStatus.pendingSteps.length === 0 && (
                      <li className="text-sm text-muted-foreground">No pending steps</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            {workflowStatus.routes && workflowStatus.routes.length > 0 ? (
              <div className="space-y-4">
                {workflowStatus.routes.map((route) => (
                  <Card key={route.workflowId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{route.workflowId}</CardTitle>
                        <div className="flex gap-2">
                          <Badge className={getPipelineColor(route.pipeline)}>{route.pipeline}</Badge>
                          <Badge variant="outline">{route.priority} priority</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Steps</h4>
                        <div className="flex flex-wrap gap-2">
                          {route.steps.map((step, idx) => (
                            <Badge key={idx} variant="secondary">
                              {step}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {route.dependencies && route.dependencies.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Dependencies
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {route.dependencies.map((dep, idx) => (
                              <Badge key={idx} variant="outline">
                                {dep}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {route.estimatedDuration && (
                        <div className="text-sm text-muted-foreground">
                          Estimated duration: {Math.round(route.estimatedDuration / (60 * 60 * 1000))} hours
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No routes available
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="execution" className="space-y-4">
            {workflowExecution ? (
              <Card>
                <CardHeader>
                  <CardTitle>Execution Details</CardTitle>
                  <CardDescription>Workflow execution timeline and node status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflowExecution.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn('w-3 h-3 rounded-full', getStatusColor(node.status))} />
                          <div>
                            <div className="font-semibold">{node.name}</div>
                            <div className="text-sm text-muted-foreground">{node.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {node.startedAt && (
                            <div className="text-sm text-muted-foreground">
                              Started: {new Date(node.startedAt).toLocaleString()}
                            </div>
                          )}
                          {node.completedAt && (
                            <div className="text-sm text-muted-foreground">
                              Completed: {new Date(node.completedAt).toLocaleString()}
                            </div>
                          )}
                          {node.duration && (
                            <div className="text-sm text-muted-foreground">
                              Duration: {Math.round(node.duration / 1000)}s
                            </div>
                          )}
                          <Badge variant="outline" className="capitalize">
                            {node.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No execution data available. Click "Load Execution" to fetch details.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Detailed execution logs and events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Logs will be displayed here when execution data is loaded.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

