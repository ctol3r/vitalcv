'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Globe, RefreshCcw, Shield } from 'lucide-react';
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface IdentitySource {
  source: string;
  identifier: string;
  verified: boolean;
  country?: string;
}

interface IdentitySpine {
  npi?: string;
  globalIds: string[];
  passportIds: string[];
  stateBoards: Array<{ state: string; licenseNumber: string; verified: boolean }>;
  internationalIds: Array<{ country: string; type: string; number: string; verified: boolean }>;
}

interface Conflict {
  type: string;
  message: string;
}

export default function IdentitySpinePage() {
  const [spine, setSpine] = useState<IdentitySpine | null>(null);
  const [reliabilityScore, setReliabilityScore] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('');

  useEffect(() => {
    // In real implementation, would get from auth/session
    setClinicianId('demo_clinician_123');
    loadIdentitySpine('demo_clinician_123');
  }, []);

  async function loadIdentitySpine(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/identity-spine/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSpine(data.spine || null);
        setReliabilityScore(data.reliabilityScore || null);
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Failed to load identity spine:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Identity Spine</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Global Identity Spine</h1>
            <p className="text-muted-foreground">
              Canonical identity source spanning countries, boards, and regulators
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadIdentitySpine(clinicianId)}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {conflicts.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
              Identity Conflicts Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {conflicts.map((conflict, idx) => (
                <li key={idx} className="text-sm text-amber-800 dark:text-amber-200">
                  • {conflict.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {reliabilityScore !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Reliability Heat Index</CardTitle>
            <CardDescription>Cross-source reliability score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold">
                {(reliabilityScore * 100).toFixed(1)}%
              </span>
              <Badge variant={reliabilityScore > 0.8 ? 'default' : 'secondary'}>
                {reliabilityScore > 0.8 ? 'High' : reliabilityScore > 0.6 ? 'Medium' : 'Low'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {spine && (
        <div className="grid gap-4 md:grid-cols-2">
          {spine.npi && (
            <Card>
              <CardHeader>
                <CardTitle>NPI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-lg">{spine.npi}</p>
              </CardContent>
            </Card>
          )}

          {spine.globalIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Global IDs</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {spine.globalIds.map((id, idx) => (
                    <li key={idx} className="font-mono text-sm">
                      {id}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {spine.passportIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Passport IDs</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {spine.passportIds.map((id, idx) => (
                    <li key={idx} className="font-mono text-sm">
                      {id}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {spine.stateBoards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>State Boards</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {spine.stateBoards.map((board, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{board.state}</p>
                        <p className="font-mono text-sm text-muted-foreground">
                          {board.licenseNumber}
                        </p>
                      </div>
                      {board.verified ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {spine.internationalIds.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  International IDs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {spine.internationalIds.map((id, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium">{id.country}</p>
                        <p className="text-sm text-muted-foreground">{id.type.toUpperCase()}</p>
                        <p className="font-mono text-sm">{id.number}</p>
                      </div>
                      {id.verified ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

