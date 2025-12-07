'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, AlertTriangle, Download, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function CredVulnerabilitiesPage() {
  const searchParams = useSearchParams();
  const credentialId = searchParams.get('credentialId') || 'cred1';
  const [vulnerability, setVulnerability] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVulnerability();
  }, [credentialId]);

  const fetchVulnerability = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cred-vulnerability/${credentialId}`);
      if (res.ok) {
        const data = await res.json();
        setVulnerability(data.vulnerability);
      }
    } catch (error) {
      console.error('Failed to fetch vulnerability', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cred-vulnerability/${credentialId}/export/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vulnerability-${credentialId}-${Date.now()}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export PDF', error);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cred-vulnerability/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Vulnerability anchored! Digest: ${data.digest}`);
        fetchVulnerability();
      }
    } catch (error) {
      console.error('Failed to anchor vulnerability', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Vulnerability Scanner</h1>
          <p className="text-muted-foreground mt-2">
            Detect potential failure points, risk areas, weak evidence & poor verifiability
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={handleAnchor}>
            <Anchor className="mr-2 h-4 w-4" />
            Anchor
          </Button>
        </div>
      </div>

      {vulnerability && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vulnerability.riskScore?.toFixed(0) || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">0-100 scale</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Evidence Chain Strength</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vulnerability.evidenceChainStrength?.toFixed(0) || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Issuer Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vulnerability.issuerTrustScore?.toFixed(0) || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {vulnerability.weaknesses && vulnerability.weaknesses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Vulnerabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vulnerability.weaknesses.map((w: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{w.type}</span>
                        <Badge
                          variant={
                            w.severity === 'critical' || w.severity === 'high'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {w.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">{w.description}</div>
                      {w.remediation && (
                        <div className="text-sm">
                          <span className="font-medium">Remediation: </span>
                          {w.remediation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {vulnerability.driftScore !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Drift</CardTitle>
                <CardDescription>Change in risk over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vulnerability.driftScore > 0 ? '+' : ''}
                  {vulnerability.driftScore.toFixed(1)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








