'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldCheck, PlayCircle } from 'lucide-react';

export default function VerifierPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [clinicianId, setClinicianId] = useState('clinician:alice');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkTrustState = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${backendUrl}/trust-state?clinician_id=${encodeURIComponent(clinicianId)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch trust state');
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setError(e.message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!status?.recognitionId) return;
    setActionLoading(true);
    try {
      const payload = {
        acceptance: {
          recognitionId: status.recognitionId,
          facilityId: 'facility:main',
          acceptedAt: new Date().toISOString(),
        },
      };
      const res = await fetch(`${backendUrl}/acceptances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to accept');
      await checkTrustState(); // Refresh
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!status?.acceptanceId) return;
    setActionLoading(true);
    try {
      const payload = {
        start: {
          acceptanceId: status.acceptanceId,
          attestedAt: new Date().toISOString(),
        },
      };
      const res = await fetch(`${backendUrl}/starts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to attest start');
      await checkTrustState(); // Refresh
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getBandColor = (band: string) => {
      switch(band) {
          case 'GREEN': return 'bg-green-500 hover:bg-green-600';
          case 'YELLOW': return 'bg-yellow-500 hover:bg-yellow-600';
          case 'RED': return 'bg-red-500 hover:bg-red-600';
          default: return 'bg-gray-500';
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center font-sans">
      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Verifier Console
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <Input
              placeholder="Enter Clinician ID (e.g. clinician:alice)"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              className="text-lg font-mono"
            />
            <Button onClick={checkTrustState} disabled={loading} size="lg">
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-100 text-sm font-medium">{error}</div>}

          {status && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Trust State View */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border shadow-sm">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ready to Start</Label>
                      <div className="mt-1 flex items-center gap-2">
                        {status.start_ready ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-lg px-3 py-1">YES</Badge>
                        ) : (
                            <Badge variant="outline" className="text-slate-400 text-lg px-3 py-1">NO</Badge>
                        )}
                      </div>
                  </div>
                   <div className="p-4 bg-white rounded-lg border shadow-sm">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">CRS Score</Label>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-3xl font-bold tracking-tight">{status.crs.score}</span>
                        <Badge className={`${getBandColor(status.crs.band)} text-white`}>{status.crs.band}</Badge>
                      </div>
                  </div>
              </div>

              {status.blocking_reasons && status.blocking_reasons.length > 0 && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Blocking Reasons</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1 mt-1">
                      {status.blocking_reasons.map((r: string, i: number) => (
                          <li key={i} className="text-sm font-medium">{r}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t pt-6 space-y-6">
                  {/* Step 1: Recognition (ReadOnly) */}
                  <div className={`flex items-start gap-4 transition-opacity ${status.recognized ? 'opacity-100' : 'opacity-40'}`}>
                      <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-blue-600" /></div>
                      <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">1. Network Recognition</h3>
                          <p className="text-sm text-slate-500">Subject identified in clinical graph.</p>
                          {status.recognizedAt && (
                              <p className="text-xs text-slate-400 mt-1 font-mono">{new Date(status.recognizedAt).toLocaleString()}</p>
                          )}
                      </div>
                  </div>

                  {/* Step 2: Acceptance (Action) */}
                  <div className={`flex items-start gap-4 ${status.recognized && !status.accepted ? 'opacity-100 ring-2 ring-blue-100 p-4 rounded-lg bg-blue-50/50' : status.accepted ? 'opacity-100' : 'opacity-40'}`}>
                       <div className="mt-1">
                           {status.accepted ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                       </div>
                       <div className="flex-1">
                           <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-slate-900">2. Employer Acceptance</h3>
                                {status.accepted && status.acceptedAt && (
                                    <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-mono">
                                        <Clock className="w-3 h-3" />
                                        {new Date(status.acceptedAt).toLocaleTimeString()}
                                    </div>
                                )}
                           </div>
                           
                           {!status.accepted ? (
                               <div className="mt-3">
                                   <Button 
                                    onClick={handleAccept} 
                                    disabled={!status.recognized || actionLoading} 
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                                   >
                                       {actionLoading ? 'Accepting...' : 'Accept'}
                                   </Button>
                               </div>
                           ) : (
                               <p className="text-sm text-slate-500">Candidate accepted for employment.</p>
                           )}
                       </div>
                  </div>

                  {/* Step 3: Start Attestation (Action) */}
                  <div className={`flex items-start gap-4 ${status.start_ready ? 'opacity-100 ring-2 ring-green-100 p-4 rounded-lg bg-green-50/50' : status.started ? 'opacity-100' : 'opacity-40'}`}>
                       <div className="mt-1">
                           {status.started ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <PlayCircle className="w-5 h-5 text-slate-400" />}
                       </div>
                       <div className="flex-1">
                           <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-slate-900">3. Start Attestation</h3>
                                {status.started && status.attestedAt && (
                                    <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-mono">
                                        <Clock className="w-3 h-3" />
                                        {new Date(status.attestedAt).toLocaleTimeString()}
                                    </div>
                                )}
                           </div>

                           {!status.started ? (
                               <div className="mt-3">
                                   <Button 
                                    onClick={handleStart} 
                                    disabled={!status.start_ready || actionLoading}
                                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                                   >
                                       {actionLoading ? 'Attesting...' : 'Attest Start'}
                                   </Button>
                                   {!status.start_ready && status.accepted && (
                                       <p className="text-xs text-red-500 mt-2">
                                           Cannot start: {status.blocking_reasons.join(', ')}
                                       </p>
                                   )}
                               </div>
                           ) : (
                               <p className="text-sm text-slate-500">Employment start officially attested.</p>
                           )}
                       </div>
                  </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
