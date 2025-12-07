'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

/**
 * Batch 382.4 - Credential Strength UI
 * Task 382.8 - Strength Comparison Matrix
 */

export default function CredentialStrengthPage() {
  const [credentialId, setCredentialId] = useState('');
  const [vector, setVector] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<any[]>([]);

  const fetchStrength = async () => {
    if (!credentialId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/credential-strength/${credentialId}`);
      const data = await res.json();
      setVector(data);
    } catch (error) {
      console.error('Failed to fetch strength vector:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    if (!credentialId) return;
    try {
      const res = await fetch(`/api/credential-strength/compare?credentialIds=${credentialId}`);
      const data = await res.json();
      setComparison(data.vectors || []);
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Credential Strength Vector</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential Strength Analysis</CardTitle>
          <CardDescription>Compute and analyze credential strength attributes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
            />
            <Button onClick={fetchStrength} disabled={loading}>
              Analyze
            </Button>
            <Button variant="outline" onClick={fetchComparison}>
              Compare
            </Button>
          </div>

          {vector && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Quality</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={vector.quality * 100} />
                    <p className="text-2xl font-bold mt-2">{(vector.quality * 100).toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={vector.trust * 100} />
                    <p className="text-2xl font-bold mt-2">{(vector.trust * 100).toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Durability</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={vector.durability * 100} />
                    <p className="text-2xl font-bold mt-2">{(vector.durability * 100).toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Relevance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={vector.relevance * 100} />
                    <p className="text-2xl font-bold mt-2">{(vector.relevance * 100).toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              {vector.features && (
                <Card>
                  <CardHeader>
                    <CardTitle>Strength Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Signature Strength</span>
                        <Badge>{(vector.features.signatureStrength * 100).toFixed(1)}%</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Anchor Recency</span>
                        <Badge>{(vector.features.anchorRecency * 100).toFixed(1)}%</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Issuer Trust</span>
                        <Badge>{(vector.features.issuerTrust * 100).toFixed(1)}%</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Evidence Density</span>
                        <Badge>{(vector.features.evidenceDensity * 100).toFixed(1)}%</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Global Equivalency</span>
                        <Badge>{(vector.features.globalEquivalency * 100).toFixed(1)}%</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {vector.reinforcement && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reinforcement Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {vector.reinforcement.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {comparison.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Strength Comparison Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Credential</th>
                        <th>Quality</th>
                        <th>Trust</th>
                        <th>Durability</th>
                        <th>Relevance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((v: any, i: number) => (
                        <tr key={i}>
                          <td>Credential {i + 1}</td>
                          <td>{(v.quality * 100).toFixed(1)}%</td>
                          <td>{(v.trust * 100).toFixed(1)}%</td>
                          <td>{(v.durability * 100).toFixed(1)}%</td>
                          <td>{(v.relevance * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

