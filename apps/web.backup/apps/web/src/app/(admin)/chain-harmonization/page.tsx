'use client';

import { useEffect, useState } from 'react';
import { Link, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ChainHarmonizationPage() {
  const [chains, setChains] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [driftCorrections, setDriftCorrections] = useState<any[]>([]);
  const [blockEquivalence, setBlockEquivalence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch harmonized chains
      const chainsRes = await fetch(`${API_BASE}/api/chain-harmonization/harmonize`, {
        method: 'POST',
      });
      if (chainsRes.ok) {
        const chainsData = await chainsRes.json();
        setChains(chainsData.chains || []);
      }

      // Fetch validation results
      const validateRes = await fetch(`${API_BASE}/api/chain-harmonization/validate/test_credential`);
      if (validateRes.ok) {
        const validateData = await validateRes.json();
        setValidationResults(validateData.results || []);
      }

      // Fetch drift corrections
      const driftRes = await fetch(`${API_BASE}/api/chain-harmonization/correct-drift`, {
        method: 'POST',
      });
      if (driftRes.ok) {
        const driftData = await driftRes.json();
        setDriftCorrections(driftData.corrections || []);
      }

      // Fetch block equivalence
      const blockRes = await fetch(`${API_BASE}/api/chain-harmonization/blocks/Substrate/12345`);
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        setBlockEquivalence(blockData.equivalence || []);
      }
    } catch (error) {
      console.error('Failed to fetch harmonization data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chain Harmonization Fabric</h1>
          <p className="text-muted-foreground mt-2">
            Ensure consistency across Substrate, EVM, Cosmos, and future blockchain networks
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="chains" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chains">Chains</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="drift">Drift Correction</TabsTrigger>
          <TabsTrigger value="blocks">Block Equivalence</TabsTrigger>
        </TabsList>

        <TabsContent value="chains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Chain Anchor States</CardTitle>
              <CardDescription>Aligned anchor states across all connected chains</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chains.map((chain, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{chain.name}</span>
                      <Badge variant="outline">Block #{chain.anchorState.blockNumber}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Tx Hash: {chain.anchorState.txHash}</div>
                      <div>Timestamp: {new Date(chain.anchorState.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Chain Validation</CardTitle>
              <CardDescription>Validate credential proofs across chains</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validationResults.map((result, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{result.chain}</span>
                      {result.valid ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Invalid
                        </Badge>
                      )}
                    </div>
                    {result.errors?.length > 0 && (
                      <div className="text-sm text-red-600 mt-2">
                        Errors: {result.errors.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drift Corrections</CardTitle>
              <CardDescription>Fix diverging chain anchors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {driftCorrections.map((correction, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{correction.chain}</span>
                      <Badge variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Corrected
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Issue: {correction.issue}</div>
                      <div>Correction: {correction.correction}</div>
                      <div>Timestamp: {new Date(correction.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Block Equivalence</CardTitle>
              <CardDescription>Show block equivalence across chains</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {blockEquivalence.map((equiv, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">
                        {equiv.chain} Block #{equiv.blockNumber}
                      </span>
                      <Badge variant="outline">
                        <Link className="h-3 w-3 mr-1" />
                        {equiv.equivalentBlocks.length} equivalents
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      <div>Equivalent blocks:</div>
                      <ul className="list-disc list-inside mt-1">
                        {equiv.equivalentBlocks.map((block: any, bidx: number) => (
                          <li key={bidx}>
                            {block.chain} Block #{block.blockNumber}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}








