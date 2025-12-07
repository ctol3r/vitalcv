'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Lock, Eye, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityLayerPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [verifierId, setVerifierId] = useState('');

  useEffect(() => {
    if (verifierId) {
      loadData();
    }
  }, [verifierId]);

  async function loadData() {
    if (!verifierId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/verification-identity/${verifierId}`);
      if (res.ok) {
        const identityData = await res.json();
        setData(identityData);
      }
    } catch (error) {
      console.error('Failed to load identity layer:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!verifierId) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Universal Verification Identity Layer</h1>
          <p className="text-muted-foreground mt-2">
            Identity-first verification: who is verifying, what they're allowed to see & why
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Enter Verifier ID</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={verifierId}
              onChange={(e) => setVerifierId(e.target.value)}
              placeholder="Enter verifier ID"
              className="w-full p-2 border rounded"
            />
            <Button onClick={loadData} className="mt-4">
              Load Identity Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const identity = data?.identity || {};
  const verifiers = identity.verifiers || [];
  const accessLogs = identity.accessLogs || [];
  const misuseDetections = identity.misuseDetections || [];

  const currentVerifier = verifiers.find((v: any) => v.verifierId === verifierId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verification Identity Layer</h1>
          <p className="text-muted-foreground mt-2">
            Verifier: {verifierId}
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      {currentVerifier && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity Status</CardTitle>
              <CardDescription>Verification and trust</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Verification Status</span>
                  <Badge variant={currentVerifier.identityProof.verified ? 'default' : 'destructive'}>
                    {currentVerifier.identityProof.verified ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Identity Method</span>
                  <Badge>{currentVerifier.identityProof.method}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Trust Score</span>
                  <Badge>{(currentVerifier.trustScore * 100).toFixed(0)}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tier Level</span>
                  <Badge>Tier {currentVerifier.tier}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Purpose of Use</span>
                  <Badge variant="outline">{currentVerifier.purposeOfUse}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access Permissions</CardTitle>
              <CardDescription>Allowed data fields</CardDescription>
            </CardHeader>
            <CardContent>
              {currentVerifier.allowedFields && currentVerifier.allowedFields.length > 0 ? (
                <div className="space-y-2">
                  {currentVerifier.allowedFields.map((field: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="mr-2">
                      {field}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No specific fields configured</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {misuseDetections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Misuse Detections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {misuseDetections.map((misuse: any, idx: number) => (
                <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="font-semibold text-red-600">{misuse.type}</div>
                  <div className="text-sm text-muted-foreground">
                    Severity: {misuse.severity} | Detected: {new Date(misuse.detectedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {accessLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Access Logs</CardTitle>
            <CardDescription>Recent verification sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accessLogs.slice(-10).map((log: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <div className="font-medium">Credential {log.credentialId}</div>
                    <div className="text-muted-foreground">
                      Purpose: {log.purpose} | {log.fieldsAccessed?.length || 0} fields accessed
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

