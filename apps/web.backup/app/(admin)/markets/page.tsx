'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Anchor } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PredictionMarketsPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const orgId = 'demo-org'; // MVP

  const { data: markets, error } = useSWR(`${backendUrl}/api/markets/${orgId}/list`, fetcher);

  const [newTopic, setNewTopic] = useState('');
  const [closesAt, setClosesAt] = useState('');

  const createMarket = async () => {
      try {
          const res = await fetch(`${backendUrl}/api/markets/open`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  orgId,
                  topic: newTopic,
                  options: ['Yes', 'No'],
                  closesAt: closesAt || new Date(Date.now() + 86400000).toISOString()
              })
          });
          if (res.ok) {
              setNewTopic('');
              mutate(`${backendUrl}/api/markets/${orgId}/list`);
          } else {
            console.error('Failed to create market');
          }
      } catch (e) {
          console.error(e);
      }
  };

  const castVote = async (marketId: string, choice: string) => {
      try {
          const res = await fetch(`${backendUrl}/api/markets/vote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  marketId,
                  voterId: 'user-' + Math.floor(Math.random()*1000), // Mock voter ID
                  choice,
                  weight: 1.0
              })
          });
          if (res.ok) {
              // Optionally show success message
          } else {
            console.error('Failed to cast vote');
          }
      } catch (e) {
          console.error(e);
      }
  };

  if (error) return <div className="p-6">Failed to load markets</div>;
  if (!markets) return <div className="p-6">Loading markets...</div>;

  return (
      <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
              <div>
                  <h1 className="text-3xl font-bold tracking-tight">Prediction Markets</h1>
                  <p className="text-muted-foreground">Internal markets for forecasting workforce trends</p>
              </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2 space-y-4">
                  {markets.map((market: any) => (
                      <Card key={market.id} className="bg-slate-50 dark:bg-slate-900 border">
                          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div>
                                  <h3 className="font-semibold text-lg">{market.topic}</h3>
                                  <div className="text-sm text-muted-foreground flex gap-2 mt-1 items-center">
                                      <span>Closes: {new Date(market.closesAt).toLocaleDateString()}</span>
                                      <Badge variant={market.status === 'open' ? 'default' : 'secondary'}>{market.status}</Badge>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  {market.status === 'open' && (
                                      <>
                                          <Button size="sm" onClick={() => castVote(market.id, 'Yes')} className="bg-green-600 hover:bg-green-700 text-white">Yes</Button>
                                          <Button size="sm" onClick={() => castVote(market.id, 'No')} className="bg-red-600 hover:bg-red-700 text-white">No</Button>
                                      </>
                                  )}
                                  {market.status !== 'open' && <Badge variant="outline">Settled</Badge>}
                              </div>
                          </CardContent>
                      </Card>
                  ))}
                  {markets.length === 0 && <p className="text-muted-foreground">No active markets found.</p>}
              </div>

              <div>
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Market</CardTitle>
                        <CardDescription>Launch a prediction market for the organization.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Topic</Label>
                            <Input
                                placeholder="e.g. Nursing shortage Q3?"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Closes At</Label>
                            <Input
                                type="date"
                                value={closesAt}
                                onChange={(e) => setClosesAt(e.target.value)}
                            />
                        </div>
                        <Button className="w-full" onClick={createMarket} disabled={!newTopic}>
                            <Anchor className="mr-2 h-4 w-4" />
                            Launch Market
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4 border-t pt-4">
                            All markets are anchored on-chain for auditability and transparency.
                        </p>
                    </CardContent>
                </Card>
              </div>
          </div>
      </div>
  );
}

