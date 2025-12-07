'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  GitBranch,
  Package,
  Server,
  Shield,
} from 'lucide-react';
// Note: formatAsMarkdown is server-side only, not imported here

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface StateReport {
  generatedAt: string;
  waveNumber?: number;
  commitHash?: string;
  timestamp: string;
  metadata: {
    monorepo: {
      workspaces: string[];
      rootPackage: { name: string; version: string };
      totalPackages: number;
      totalApps: number;
    };
    api: {
      routes: Array<{ path: string; method: string }>;
      totalRoutes: number;
      middleware: string[];
      services: string[];
    };
    blockchain: {
      pallets: string[];
      runtime: string;
      validators: number;
      chainId?: string;
    };
    services: Array<{ name: string; type: string; path: string }>;
    packages: Array<{ name: string; version: string; path: string }>;
  };
  compliance: {
    redactionApplied: boolean;
    piiDetected: boolean;
    phiDetected: boolean;
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
    pouConstraints: string[];
  };
  architecture?: {
    subsystems: Array<{ name: string; purpose: string; status: string }>;
    pipelines: Array<{ name: string; type: string; status: string }>;
    flows: Array<{ name: string; type: string }>;
    compliancePosture: string;
  };
  narrative?: string;
  version: string;
}

interface Snapshot {
  id: string;
  waveNumber: number | null;
  timestamp: string;
  commitHash: string | null;
  createdAt: string;
}

export default function StateAgentPage() {
  const [report, setReport] = useState<StateReport | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/state-agent/report?format=json&includeNarrative=true`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch state report');
      }

      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch state report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnapshots = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/state-agent/snapshots`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSnapshots(data);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    }
  };

  const generateSnapshot = async (waveNumber?: number) => {
    try {
      setGenerating(true);
      const response = await fetch(`${API_BASE}/api/state-agent/wave/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ waveNumber: waveNumber || Date.now() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate snapshot');
      }

      await fetchReport();
      await fetchSnapshots();
    } catch (error) {
      console.error('Failed to generate snapshot:', error);
      alert('Failed to generate snapshot. Please check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (format: 'json' | 'markdown') => {
    if (!report) return;

    const content = format === 'json'
      ? JSON.stringify(report, null, 2)
      : report.narrative || 'No narrative available';

    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/markdown'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitalcv-state-report-${new Date().toISOString()}.${format === 'json' ? 'json' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchReport();
    fetchSnapshots();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            VitalCV Brain - State Agent
          </h1>
          <p className="text-muted-foreground mt-2">
            System intelligence generator & AI onboarding module
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchReport()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => generateSnapshot()}
            disabled={generating}
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Generate Snapshot
              </>
            )}
          </Button>
        </div>
      </div>

      {report && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
            <TabsTrigger value="narrative">Narrative</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Monorepo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Packages</span>
                      <span className="font-semibold">{report.metadata.monorepo.totalPackages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Apps</span>
                      <span className="font-semibold">{report.metadata.monorepo.totalApps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workspaces</span>
                      <span className="font-semibold">{report.metadata.monorepo.workspaces.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    API
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Routes</span>
                      <span className="font-semibold">{report.metadata.api.totalRoutes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Middleware</span>
                      <span className="font-semibold">{report.metadata.api.middleware.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Services</span>
                      <span className="font-semibold">{report.metadata.api.services.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Blockchain
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Runtime</span>
                      <Badge variant="outline">{report.metadata.blockchain.runtime}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Validators</span>
                      <span className="font-semibold">{report.metadata.blockchain.validators}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pallets</span>
                      <span className="font-semibold">{report.metadata.blockchain.pallets.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Metadata</CardTitle>
                <CardDescription>
                  Generated at {new Date(report.generatedAt).toLocaleString()}
                  {report.waveNumber && ` • Wave ${report.waveNumber}`}
                  {report.commitHash && (
                    <>
                      {' • '}
                      <code className="text-xs">{report.commitHash.substring(0, 7)}</code>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadReport('json')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadReport('markdown')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Markdown
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-4">
            {report.architecture && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Subsystems</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {report.architecture.subsystems.map((subsystem, idx) => (
                        <div key={idx} className="border-l-4 border-primary pl-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{subsystem.name}</h3>
                            <Badge variant={subsystem.status === 'active' ? 'default' : 'secondary'}>
                              {subsystem.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{subsystem.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Active Pipelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.architecture.pipelines.map((pipeline, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{pipeline.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">({pipeline.type})</span>
                          </div>
                          <Badge variant={pipeline.status === 'active' ? 'default' : 'secondary'}>
                            {pipeline.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Redaction Applied</span>
                    {report.compliance.redactionApplied ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PII Detected</span>
                    {report.compliance.piiDetected ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PHI Detected</span>
                    {report.compliance.phiDetected ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>GDPR Compliant</span>
                    {report.compliance.gdprCompliant ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>HIPAA Compliant</span>
                    {report.compliance.hipaaCompliant ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  {report.compliance.pouConstraints.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">POU Constraints:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {report.compliance.pouConstraints.map((constraint, idx) => (
                          <li key={idx}>{constraint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="snapshots" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>State Snapshots</CardTitle>
                <CardDescription>
                  Historical state reports for architecture drift detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.length === 0 ? (
                  <p className="text-muted-foreground">No snapshots available. Generate one to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {snapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted"
                        onClick={() => setSelectedSnapshot(snapshot.id)}
                      >
                        <div>
                          <div className="font-medium">
                            {snapshot.waveNumber ? `Wave ${snapshot.waveNumber}` : 'Snapshot'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(snapshot.timestamp).toLocaleString()}
                            {snapshot.commitHash && (
                              <>
                                {' • '}
                                <code className="text-xs">{snapshot.commitHash.substring(0, 7)}</code>
                              </>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="narrative" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Onboarding Narrative</CardTitle>
                <CardDescription>
                  Coherent system description for new AI agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.narrative ? (
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">{report.narrative}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No narrative available. Generate a report with narrative enabled.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

