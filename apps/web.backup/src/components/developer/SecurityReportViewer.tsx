/**
 * SecurityReport Viewer
 *
 * Shows the vulnerability scan report for each module, broken down by severity.
 * Provides remediation recommendations and links to docs.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface SecurityReportViewerProps {
  moduleId: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Vulnerability {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  cve?: string;
  package?: string;
  version?: string;
  fixedVersion?: string;
  remediation?: string;
  documentationUrl?: string;
  affectedFiles?: string[];
}

interface SecurityReport {
  moduleId: string;
  scanDate: string;
  status: 'pending' | 'passed' | 'failed';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  vulnerabilities: Vulnerability[];
}

export default function SecurityReportViewer({ moduleId }: SecurityReportViewerProps) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');

  useEffect(() => {
    fetchSecurityReport();
  }, [moduleId]);

  async function fetchSecurityReport() {
    try {
      const res = await fetch(`/api/demo/developer/modules/${moduleId}/security`);
      if (!res.ok) throw new Error('Failed to fetch security report');
      const data = await res.json();
      setReport(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch security report:', err);
      setLoading(false);
    }
  }

  function getSeverityBadge(severity: Severity) {
    const variants: Record<Severity, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'outline',
      low: 'secondary',
      info: 'outline',
    };

    const colors: Record<Severity, string> = {
      critical: 'bg-red-600',
      high: 'bg-orange-600',
      medium: 'bg-yellow-600',
      low: 'bg-blue-600',
      info: 'bg-gray-600',
    };

    return (
      <Badge
        variant={variants[severity]}
        className={severity === 'critical' || severity === 'high' ? '' : ''}
      >
        {severity.toUpperCase()}
      </Badge>
    );
  }

  function getSeverityCount(severity: Severity): number {
    if (!report) return 0;
    return report.summary[severity];
  }

  function getFilteredVulnerabilities(): Vulnerability[] {
    if (!report) return [];
    if (selectedSeverity === 'all') return report.vulnerabilities;
    return report.vulnerabilities.filter(v => v.severity === selectedSeverity);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">Loading security report...</div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">No security report available</div>
        </CardContent>
      </Card>
    );
  }

  const filteredVulns = getFilteredVulnerabilities();
  const hasIssues = report.summary.total > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Security Scan Report</CardTitle>
            <CardDescription>
              Scanned on {new Date(report.scanDate).toLocaleString()}
            </CardDescription>
          </div>
          <Badge variant={report.status === 'passed' ? 'default' : 'destructive'}>
            {report.status === 'passed' ? 'Passed' : 'Issues Found'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium mb-2">Summary</h4>
          <div className="grid grid-cols-5 gap-2">
            <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded-md">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {getSeverityCount('critical')}
              </div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
            <div className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded-md">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {getSeverityCount('high')}
              </div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {getSeverityCount('medium')}
              </div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {getSeverityCount('low')}
              </div>
              <div className="text-xs text-muted-foreground">Low</div>
            </div>
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-950 rounded-md">
              <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                {getSeverityCount('info')}
              </div>
              <div className="text-xs text-muted-foreground">Info</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        {hasIssues && (
          <Tabs value={selectedSeverity} onValueChange={(v) => setSelectedSeverity(v as Severity | 'all')}>
            <TabsList>
              <TabsTrigger value="all">All ({report.summary.total})</TabsTrigger>
              {getSeverityCount('critical') > 0 && (
                <TabsTrigger value="critical">
                  Critical ({getSeverityCount('critical')})
                </TabsTrigger>
              )}
              {getSeverityCount('high') > 0 && (
                <TabsTrigger value="high">
                  High ({getSeverityCount('high')})
                </TabsTrigger>
              )}
              {getSeverityCount('medium') > 0 && (
                <TabsTrigger value="medium">
                  Medium ({getSeverityCount('medium')})
                </TabsTrigger>
              )}
              {getSeverityCount('low') > 0 && (
                <TabsTrigger value="low">
                  Low ({getSeverityCount('low')})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value={selectedSeverity} className="mt-4">
              {filteredVulns.length > 0 ? (
                <div className="space-y-4">
                  {filteredVulns.map((vuln) => (
                    <VulnerabilityCard key={vuln.id} vulnerability={vuln} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No vulnerabilities found in this category
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Success State */}
        {!hasIssues && (
          <div className="text-center py-8">
            <div className="text-lg font-medium mb-2">✅ No vulnerabilities found</div>
            <div className="text-sm text-muted-foreground">
              Your module passed all security checks
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSecurityReport}
          >
            Refresh Scan
          </Button>
          <Link href="/docs/security" target="_blank">
            <Button variant="outline" size="sm">
              Security Docs
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Vulnerability Card Component
function VulnerabilityCard({ vulnerability }: { vulnerability: Vulnerability }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-l-4 border-l-destructive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {vulnerability.severity === 'critical' || vulnerability.severity === 'high' ? (
                <Badge variant="destructive">{vulnerability.severity.toUpperCase()}</Badge>
              ) : (
                <Badge variant="outline">{vulnerability.severity.toUpperCase()}</Badge>
              )}
              <CardTitle className="text-base">{vulnerability.title}</CardTitle>
            </div>
            {vulnerability.cve && (
              <div className="text-xs text-muted-foreground mb-1">
                CVE: {vulnerability.cve}
              </div>
            )}
            {vulnerability.package && (
              <div className="text-xs text-muted-foreground">
                Package: <code className="bg-muted px-1 rounded">{vulnerability.package}</code>
                {vulnerability.version && (
                  <>
                    {' '}v{vulnerability.version}
                    {vulnerability.fixedVersion && (
                      <span className="text-green-600 dark:text-green-400">
                        {' '}→ v{vulnerability.fixedVersion}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div>
            <h5 className="text-sm font-medium mb-1">Description</h5>
            <p className="text-sm text-muted-foreground">{vulnerability.description}</p>
          </div>

          {vulnerability.remediation && (
            <div>
              <h5 className="text-sm font-medium mb-1">Remediation</h5>
              <p className="text-sm text-muted-foreground">{vulnerability.remediation}</p>
              {vulnerability.fixedVersion && (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                    Update to v{vulnerability.fixedVersion}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {vulnerability.affectedFiles && vulnerability.affectedFiles.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-1">Affected Files</h5>
              <div className="space-y-1">
                {vulnerability.affectedFiles.map((file, idx) => (
                  <code key={idx} className="text-xs bg-muted px-2 py-1 rounded block">
                    {file}
                  </code>
                ))}
              </div>
            </div>
          )}

          {vulnerability.documentationUrl && (
            <div>
              <Link href={vulnerability.documentationUrl} target="_blank">
                <Button variant="outline" size="sm">
                  View Documentation
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

