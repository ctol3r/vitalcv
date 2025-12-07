'use client';

import { useEffect, useState } from 'react';
import { Globe, Wallet, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface IdentityContinuityData {
  multiWallet: { consistencyScore: number; wallets: any[] };
  crossCountry: { continuityScore: number; countries: string[] };
  credentialLineage: { continuityScore: number; credentials: any[] };
  didRotation: { continuityScore: number; rotations: any[] };
}

export default function ContinuityPage() {
  const [continuity, setContinuity] = useState<IdentityContinuityData | null>(null);
  const [breaches, setBreaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [continuityRes, breachesRes] = await Promise.all([
        fetch(`${API_BASE}/api/identity/continuity/self`),
        fetch(`${API_BASE}/api/identity/continuity/self/breaches`),
      ]);

      if (continuityRes.ok) {
        const data = await continuityRes.json();
        setContinuity(data);
      }
      if (breachesRes.ok) {
        const data = await breachesRes.json();
        setBreaches(data.breaches || []);
      }
    } catch (error) {
      console.error('Failed to fetch continuity data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/identity/continuity/self/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `identity-continuity-${Date.now()}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const overallContinuity = continuity
    ? (continuity.multiWallet.consistencyScore +
        continuity.crossCountry.continuityScore +
        continuity.credentialLineage.continuityScore +
        continuity.didRotation.continuityScore) /
      4
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Global Identity Continuity</h1>
          <p className="text-muted-foreground mt-2">Ensure identity remains continuous across countries, wallets, and systems</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Export Pack
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Continuity Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{(overallContinuity * 100).toFixed(1)}%</span>
              <Badge variant={overallContinuity >= 0.9 ? 'default' : overallContinuity >= 0.7 ? 'secondary' : 'destructive'}>
                {overallContinuity >= 0.9 ? 'Excellent' : overallContinuity >= 0.7 ? 'Good' : 'Needs Attention'}
              </Badge>
            </div>
            <Progress value={overallContinuity * 100} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              Multi-Wallet Continuity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Consistency</span>
                <span className="font-bold">{(continuity?.multiWallet.consistencyScore || 0) * 100}%</span>
              </div>
              <Progress value={(continuity?.multiWallet.consistencyScore || 0) * 100} />
              <p className="text-sm text-muted-foreground">
                {continuity?.multiWallet.wallets.length || 0} wallets tracked
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              Cross-Country Continuity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Continuity</span>
                <span className="font-bold">{(continuity?.crossCountry.continuityScore || 0) * 100}%</span>
              </div>
              <Progress value={(continuity?.crossCountry.continuityScore || 0) * 100} />
              <div className="flex gap-1 mt-2">
                {continuity?.crossCountry.countries.map((country) => (
                  <Badge key={country} variant="outline">
                    {country}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Credential Lineage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Continuity</span>
                <span className="font-bold">{(continuity?.credentialLineage.continuityScore || 0) * 100}%</span>
              </div>
              <Progress value={(continuity?.credentialLineage.continuityScore || 0) * 100} />
              <p className="text-sm text-muted-foreground">
                {continuity?.credentialLineage.credentials.length || 0} credentials tracked
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">DID Rotation Continuity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Continuity</span>
                <span className="font-bold">{(continuity?.didRotation.continuityScore || 0) * 100}%</span>
              </div>
              <Progress value={(continuity?.didRotation.continuityScore || 0) * 100} />
              <p className="text-sm text-muted-foreground">
                {continuity?.didRotation.rotations.length || 0} rotations tracked
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {breaches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Continuity Breaches Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {breaches.map((breach, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={breach.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {breach.severity}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{breach.type}</span>
                  </div>
                  <p className="text-sm">{breach.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

