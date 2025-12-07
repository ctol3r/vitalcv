'use client';

import { useEffect, useState } from 'react';
import { FileText, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function NormalizationPage() {
  const [credentialId, setCredentialId] = useState('');
  const [format, setFormat] = useState<'JSON-LD' | 'SD-JWT' | 'BBS+' | 'HL7' | 'CDS' | 'AnonCreds'>('JSON-LD');
  const [region, setRegion] = useState('US');
  const [normalized, setNormalized] = useState<any>(null);
  const [errors, setErrors] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleNormalize = async () => {
    if (!credentialId) return;
    setLoading(true);
    try {
      // Parse credential
      const parseRes = await fetch(`${API_BASE}/api/credential-normalization/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: { id: credentialId, type: 'VerifiableCredential' },
          format,
        }),
      });

      if (!parseRes.ok) throw new Error('Parse failed');

      const { parsed } = await parseRes.json();

      // Map to VitalCV schema
      const mapRes = await fetch(`${API_BASE}/api/credential-normalization/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedCredential: parsed }),
      });

      if (!mapRes.ok) throw new Error('Mapping failed');

      const { normalized: mapped } = await mapRes.json();

      // Normalize by region
      const regionRes = await fetch(`${API_BASE}/api/credential-normalization/normalize-region`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: mapped, region }),
      });

      if (!regionRes.ok) throw new Error('Region normalization failed');

      const { normalized: final } = await regionRes.json();
      setNormalized(final);

      // Detect errors
      const errorRes = await fetch(`${API_BASE}/api/credential-normalization/detect-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalized: final }),
      });

      if (errorRes.ok) {
        const errorData = await errorRes.json();
        setErrors(errorData);
      }
    } catch (error) {
      console.error('Normalization failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!credentialId) return;
    try {
      const res = await fetch(`${API_BASE}/api/credential-normalization/export/${credentialId}`);
      if (res.ok) {
        const pack = await res.json();
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `normalized-${credentialId}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credential Normalization</h1>
        <p className="text-muted-foreground mt-2">
          Normalize ANY credential format into a unified data model
        </p>
      </div>

      <Tabs defaultValue="normalize" className="space-y-4">
        <TabsList>
          <TabsTrigger value="normalize">Normalize</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="normalize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Normalize Credential</CardTitle>
              <CardDescription>Parse and normalize credentials from various formats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Credential ID</Label>
                <Input
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  placeholder="Enter credential ID"
                />
              </div>
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JSON-LD">JSON-LD</SelectItem>
                    <SelectItem value="SD-JWT">SD-JWT</SelectItem>
                    <SelectItem value="BBS+">BBS+</SelectItem>
                    <SelectItem value="HL7">HL7</SelectItem>
                    <SelectItem value="CDS">CDS</SelectItem>
                    <SelectItem value="AnonCreds">AnonCreds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US</SelectItem>
                    <SelectItem value="UK">UK</SelectItem>
                    <SelectItem value="EU">EU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleNormalize} disabled={loading || !credentialId}>
                {loading ? 'Normalizing...' : 'Normalize'}
              </Button>
            </CardContent>
          </Card>

          {normalized && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Normalized Credential
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(normalized, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {errors && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Normalization Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {errors.errors?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="font-semibold text-red-600">Errors:</h4>
                    {errors.errors.map((err: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>{err.field}: {err.issue}</span>
                      </div>
                    ))}
                  </div>
                )}
                {errors.warnings?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-yellow-600">Warnings:</h4>
                    {errors.warnings.map((warn: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span>{warn.field}: {warn.issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Normalized Pack</CardTitle>
              <CardDescription>Export unified VC with chain anchors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Credential ID</Label>
                <Input
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  placeholder="Enter credential ID"
                />
              </div>
              <Button onClick={handleExport} disabled={!credentialId}>
                <Download className="h-4 w-4 mr-2" />
                Export Pack
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}








