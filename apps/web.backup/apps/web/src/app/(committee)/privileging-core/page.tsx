'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCcw, Shield, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface Privilege {
  code: string;
  name: string;
  category: string;
  level: string;
}

interface Eligibility {
  privilege: Privilege;
  eligible: boolean;
  score: number;
  reasons: string[];
  blockers: string[];
}

export default function PrivilegingCorePage() {
  const [eligibility, setEligibility] = useState<Eligibility[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Privilege[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadPrivilegingData();
  }, []);

  async function loadPrivilegingData() {
    setLoading(true);
    try {
      const [eligibilityRes, scoresRes, conflictsRes, recommendationsRes] = await Promise.all([
        fetch(`${API_BASE}/api/privileging-core/${clinicianId}/eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privileges: [
              { code: 'SURG_001', name: 'General Surgery', category: 'surgery', level: 'standard' },
            ],
          }),
        }),
        fetch(`${API_BASE}/api/privileging-core/${clinicianId}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privileges: [
              { code: 'SURG_001', name: 'General Surgery', category: 'surgery', level: 'standard' },
            ],
          }),
        }),
        fetch(`${API_BASE}/api/privileging-core/${clinicianId}/conflicts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privileges: [
              { code: 'SURG_001', name: 'General Surgery', category: 'surgery', level: 'standard' },
            ],
          }),
        }),
        fetch(`${API_BASE}/api/privileging-core/${clinicianId}/recommendations`),
      ]);

      if (eligibilityRes.ok) {
        const data = await eligibilityRes.json();
        setEligibility(data.eligibility || []);
      }
      if (scoresRes.ok) {
        const data = await scoresRes.json();
        setScores(data.scores || []);
      }
      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }
      if (recommendationsRes.ok) {
        const data = await recommendationsRes.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to load privileging data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Committee · Privileging Core</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Autonomous Privileging Core</h1>
            <p className="text-muted-foreground">
              AI-driven privileging automation with safety, competency, and performance signals
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadPrivilegingData()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {eligibility.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Eligibility</CardTitle>
            <CardDescription>Eligibility status for each requested privilege</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {eligibility.map((item, idx) => (
              <div key={idx} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {item.eligible ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                      <span className="font-medium">{item.privilege.name}</span>
                      <Badge variant={item.eligible ? 'default' : 'destructive'}>
                        {item.eligible ? 'Eligible' : 'Not Eligible'}
                      </Badge>
                    </div>
                    <Progress value={item.score} className="mb-2" />
                    <p className="text-sm text-muted-foreground">Score: {item.score}/100</p>
                    {item.reasons.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-green-700">Reasons:</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {item.reasons.map((reason, rIdx) => (
                            <li key={rIdx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.blockers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Blockers:</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {item.blockers.map((blocker, bIdx) => (
                            <li key={bIdx}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Suggested privileges based on credentials and training</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((priv, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded border">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{priv.name}</span>
                <Badge variant="outline">{priv.category}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Conflicts</CardTitle>
            <CardDescription>Contradictory privilege sets detected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflicts.map((conflict, idx) => (
              <div key={idx} className="p-3 rounded border border-amber-500 bg-amber-50">
                <p className="font-medium text-amber-900">{conflict.conflict}</p>
                <p className="text-sm text-amber-700">Severity: {conflict.severity}/100</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}








