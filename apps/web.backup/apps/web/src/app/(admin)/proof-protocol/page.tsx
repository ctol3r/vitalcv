'use client';

import { useCallback, useState } from 'react';
import { Shield, FileDown, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

const REGULATORS = ['NCQA', 'JC', 'CMS', 'DEA', 'EU', 'UK', 'AU'];

export default function ProofProtocolPage() {
  const [region, setRegion] = useState('');
  const [clinicianId, setClinicianId] = useState('');
  const [regulator, setRegulator] = useState('');
  const [protocol, setProtocol] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProtocol = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/proofing-protocol/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load protocol (${response.status})`);
      }
      const data = await response.json();
      setProtocol(data);
    } catch (err) {
      console.error('Failed to fetch protocol', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const verifyCompliance = useCallback(async () => {
    if (!clinicianId || !regulator) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/proofing-protocol/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId, regulator }),
      });
      const data = await response.json();
      setCompliance(data);
    } catch (err) {
      console.error('Failed to verify compliance', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId, regulator]);

  const exportPack = useCallback(async () => {
    if (!clinicianId || !regulator) return;
    try {
      const response = await fetch(`${API_BASE}/api/proofing-protocol/export/${clinicianId}/${regulator}`);
      const data = await response.json();
      window.open(data.packUrl, '_blank');
    } catch (err) {
      console.error('Failed to export pack', err);
    }
  }, [clinicianId, regulator]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regulatory Proofing Protocol</h1>
          <p className="text-muted-foreground">
            A universal protocol proving compliance with any regulator, anywhere
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Proofing Protocol</CardTitle>
          <CardDescription>Enter a region to view protocol configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (e.g., US, EU, UK)"
              className="flex-1"
            />
            <Button onClick={fetchProtocol} disabled={!region || loading}>
              View Protocol
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading protocol...</p>}

          {protocol && protocol.protocol && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Protocol Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Regulator</span>
                      <Badge>{protocol.protocol.regulator}</Badge>
                    </div>
                    {protocol.protocol.proofFormats && (
                      <div>
                        <span className="text-sm font-medium">Proof Formats:</span>
                        <div className="flex gap-2 mt-2">
                          {protocol.protocol.proofFormats.vc && <Badge>VC</Badge>}
                          {protocol.protocol.proofFormats.sdJwt && <Badge>SD-JWT</Badge>}
                          {protocol.protocol.proofFormats.bbsPlus && <Badge>BBS+</Badge>}
                          {protocol.protocol.proofFormats.chainAnchors && <Badge>Chain Anchors</Badge>}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verify Compliance</CardTitle>
          <CardDescription>Check clinician compliance with regulatory requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Select value={regulator} onValueChange={setRegulator}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Regulator" />
              </SelectTrigger>
              <SelectContent>
                {REGULATORS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={verifyCompliance} disabled={!clinicianId || !regulator || loading}>
              Verify
            </Button>
            <Button onClick={exportPack} variant="outline" disabled={!clinicianId || !regulator}>
              <FileDown className="h-4 w-4 mr-2" />
              Export Pack
            </Button>
          </div>

          {compliance && compliance.compliance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Compliance Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {compliance.compliance.map((rule: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{rule.rule}</span>
                    {rule.verified ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

