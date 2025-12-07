'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link2, Shield, AlertCircle, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CrossChainMemoryPage() {
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo-clinician-1'); // In production, get from auth
  const [anchors, setAnchors] = useState<any[]>([]);
  const [coherence, setCoherence] = useState<any>(null);
  const [trust, setTrust] = useState<number | null>(null);
  const [degradation, setDegradation] = useState<any>(null);

  useEffect(() => {
    loadMemory();
  }, [clinicianId]);

  async function loadMemory() {
    try {
      setLoading(true);
      const [memoryRes, coherenceRes, trustRes, degradationRes] = await Promise.all([
        fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}`),
        fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}/coherence`),
        fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}/trust`),
        fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}/degradation`),
      ]);

      const memoryData = await memoryRes.json();
      if (memoryData.success) {
        setAnchors(memoryData.anchors || []);
      }

      const coherenceData = await coherenceRes.json();
      if (coherenceData.success) {
        setCoherence(coherenceData.coherence);
      }

      const trustData = await trustRes.json();
      if (trustData.success) {
        setTrust(trustData.trust);
      }

      const degradationData = await degradationRes.json();
      if (degradationData.success) {
        setDegradation(degradationData.prediction);
      }
    } catch (error) {
      console.error('Failed to load memory:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConsolidate() {
    try {
      const res = await fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}/consolidate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await loadMemory();
      }
    } catch (error) {
      console.error('Failed to consolidate:', error);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cross-Chain Credential Memory</h1>
        <p className="text-muted-foreground mt-2">
          Ensure credential memory is consistent across Substrate, EVM, Cosmos, EUDI & off-chain stores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Chain Anchors
            </CardTitle>
            <CardDescription>Anchors from all supported chains</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anchors.map((anchor, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <Badge variant="outline">{anchor.chain}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {anchor.blockHeight ? `Block ${anchor.blockHeight}` : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Memory Coherence
            </CardTitle>
            <CardDescription>Consistency across networks</CardDescription>
          </CardHeader>
          <CardContent>
            {coherence && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-bold">
                    {coherence.coherent ? '✓' : '✗'}
                  </span>
                  <Badge variant={coherence.coherent ? 'default' : 'destructive'}>
                    {coherence.coherent ? 'Coherent' : 'Incoherent'}
                  </Badge>
                </div>
                <Progress value={coherence.score * 100} className="mt-4" />
                {coherence.issues.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {coherence.issues.map((issue: string, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground">
                        • {issue}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Chain-Weighted Trust
            </CardTitle>
            <CardDescription>Blended trust across chains</CardDescription>
          </CardHeader>
          <CardContent>
            {trust !== null && (
              <>
                <div className="text-3xl font-bold mb-2">{trust.toFixed(1)}/1.0</div>
                <Progress value={trust * 100} className="mt-4" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Degradation Prediction
            </CardTitle>
            <CardDescription>Predicted memory degradation areas</CardDescription>
          </CardHeader>
          <CardContent>
            {degradation && (
              <div className="space-y-2">
                {degradation.riskAreas.length > 0 ? (
                  degradation.riskAreas.map((area: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{area}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No degradation risks detected</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleConsolidate}>Consolidate Memory</Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const res = await fetch(`${API_BASE}/api/cross-chain-memory/${clinicianId}/correct-drift`, {
                method: 'POST',
              });
              const data = await res.json();
              if (data.success) {
                await loadMemory();
              }
            } catch (error) {
              console.error('Failed to correct drift:', error);
            }
          }}
        >
          Correct Drift
        </Button>
      </div>
    </div>
  );
}

