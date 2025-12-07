'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, Shield, AlertTriangle, CheckCircle2, RefreshCw, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface DIDState {
  did: string;
  keys: Array<{ id: string; type: string; createdAt: string }>;
  walletSync: Array<{ walletId: string; lastSynced: string; status: string }>;
}

interface DIDAnomaly {
  type: string;
  severity: string;
  description: string;
  detectedAt: string;
}

export default function DIDContinuityPage() {
  const [didState, setDIDState] = useState<DIDState | null>(null);
  const [anomalies, setAnomalies] = useState<DIDAnomaly[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDIDState = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setDIDState(null);
      setAnomalies([]);
    } catch (error) {
      console.error('Failed to fetch DID state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDIDState();
  }, [fetchDIDState]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">DID Continuity</h1>
          <p className="text-muted-foreground mt-2">
            Cryptographically secure vault ensuring DID consistency, rotation safety, and cross-wallet identity continuity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDIDState} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              DID Keys
            </CardTitle>
            <CardDescription>Current DID keys and rotation history</CardDescription>
          </CardHeader>
          <CardContent>
            {didState ? (
              <div className="space-y-2">
                <div className="p-2 border rounded">
                  <p className="text-sm font-mono text-xs break-all">{didState.did}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {didState.keys.length} key(s) active
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No DID state available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Wallet Sync Status
            </CardTitle>
            <CardDescription>Cross-wallet synchronization status</CardDescription>
          </CardHeader>
          <CardContent>
            {didState?.walletSync.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallets synced</p>
            ) : (
              <div className="space-y-2">
                {didState?.walletSync.map((wallet, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{wallet.walletId}</span>
                    <Badge variant={wallet.status === 'synced' ? 'default' : 'destructive'}>
                      {wallet.status === 'synced' ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      )}
                      {wallet.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Anomalies Detected
            </CardTitle>
            <CardDescription>Unauthorized changes or sync failures</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Detected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{anomaly.type}</TableCell>
                    <TableCell>
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                        {anomaly.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{anomaly.description}</TableCell>
                    <TableCell>{new Date(anomaly.detectedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








