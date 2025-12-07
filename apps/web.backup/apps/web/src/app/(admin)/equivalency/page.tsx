/**
 * Batch 197 - Task 197.5 - Equivalency Selector UI
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function EquivalencyPage() {
  const [sourceCountry, setSourceCountry] = useState('');
  const [sourceTraining, setSourceTraining] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleMapTraining = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/equivalency/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCountry, sourceTraining, targetCountry })
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Credential Equivalency Map</h1>
        <p className="text-muted-foreground mt-2">
          Map global training, licensure, certification equivalencies across countries
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training Equivalency Mapper</CardTitle>
          <CardDescription>Map training programs across countries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Source Country</Label>
              <Select value={sourceCountry} onValueChange={setSourceCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source Training</Label>
              <Input
                placeholder="e.g., PGY1, FY2"
                value={sourceTraining}
                onChange={(e) => setSourceTraining(e.target.value)}
              />
            </div>
            <div>
              <Label>Target Country</Label>
              <Select value={targetCountry} onValueChange={setTargetCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleMapTraining} disabled={loading}>
            Map Equivalency
          </Button>
          {result && (
            <Alert>
              <AlertDescription>
                Equivalency: {result.equivalency || 'Not found'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

