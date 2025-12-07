'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Smartphone, Monitor, HardDrive } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function SelectiveDisclosurePage() {
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [schemasRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/api/selective-disclosure/schemas`),
        fetch(`${API_BASE}/api/selective-disclosure/analytics`),
      ]);

      if (schemasRes.ok) {
        const schemasData = await schemasRes.json();
        setSchemas(schemasData);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Failed to load selective disclosure data:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold">Multi-Wallet Selective Disclosure Engine</h1>
        <p className="text-muted-foreground mt-2">
          Support SD-JWT, BBS+, EUDI selective disclosure across all wallets & platforms
        </p>
      </div>

      {schemas && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>SD-JWT</CardTitle>
              <CardDescription>Selective Disclosure JWT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {schemas.sdJwt?.templates?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground mt-2">Templates</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>BBS+</CardTitle>
              <CardDescription>BBS+ Signature Suite</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={schemas.bbsPlus?.enabled ? 'default' : 'secondary'}>
                {schemas.bbsPlus?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <div className="text-sm text-muted-foreground mt-2">
                Suite: {schemas.bbsPlus?.signatureSuite || 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>EUDI</CardTitle>
              <CardDescription>EU Digital Identity Wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={schemas.eudi?.enabled ? 'default' : 'secondary'}>
                {schemas.eudi?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle>Disclosure Analytics</CardTitle>
            <CardDescription>Proof usage statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-bold">{analytics.totalDisclosures?.toLocaleString() || 0}</div>
              <div className="text-sm text-muted-foreground">Total Disclosures</div>
            </div>

            {analytics.byFormat && (
              <div>
                <div className="font-medium mb-2">By Format</div>
                <div className="space-y-2">
                  {Object.entries(analytics.byFormat).map(([format, count]: [string, any]) => (
                    <div key={format} className="flex items-center justify-between">
                      <span className="text-sm">{format.toUpperCase()}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics.byWallet && (
              <div>
                <div className="font-medium mb-2">By Wallet Type</div>
                <div className="space-y-2">
                  {Object.entries(analytics.byWallet).map(([wallet, count]: [string, any]) => (
                    <div key={wallet} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {wallet === 'mobile' && <Smartphone className="h-4 w-4" />}
                        {wallet === 'desktop' && <Monitor className="h-4 w-4" />}
                        {wallet === 'hardware' && <HardDrive className="h-4 w-4" />}
                        <span className="text-sm capitalize">{wallet}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Avg Latency</div>
                <div className="text-lg font-semibold">{analytics.avgLatency || 0}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
                <div className="text-lg font-semibold">
                  {((analytics.successRate || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

