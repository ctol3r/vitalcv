/**
 * Batch 200 - Task 200.5 - Shortage Grid UI
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function ShortageGridPage() {
  const [specialty, setSpecialty] = useState('');
  const [region, setRegion] = useState('');
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | '1y'>('30d');
  const [prediction, setPrediction] = useState<any>(null);
  const [severity, setSeverity] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shortage/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, region, timeframe })
      });
      const data = await res.json();
      setPrediction(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSeverity = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shortage/severity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, region })
      });
      const data = await res.json();
      setSeverity(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nationwide Shortage Response Grid</h1>
        <p className="text-muted-foreground mt-2">
          Predict and route clinicians based on national + regional workforce shortages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shortage Prediction</CardTitle>
          <CardDescription>Predict shortages by specialty and region</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Specialty</Label>
              <Input
                placeholder="e.g., Cardiology"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </div>
            <div>
              <Label>Region</Label>
              <Input
                placeholder="e.g., CA"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
            <div>
              <Label>Timeframe</Label>
              <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="90d">90 Days</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePredict} disabled={loading}>
              Predict Shortage
            </Button>
            <Button onClick={handleCalculateSeverity} disabled={loading} variant="outline">
              Calculate Severity
            </Button>
          </div>
          {prediction && (
            <Alert>
              <AlertDescription>
                <p>Predicted Shortage: {prediction.predictedShortage}</p>
                <p>Confidence: {prediction.confidence}</p>
              </AlertDescription>
            </Alert>
          )}
          {severity && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <p>Severity: {severity.severity}</p>
                  <Badge>{severity.level}</Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

