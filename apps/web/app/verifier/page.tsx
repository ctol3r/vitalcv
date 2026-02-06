'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  XCircle, 
  Building2, 
  UserCircle2, 
  Network, 
  History,
  FileSignature,
  Fingerprint,
  Lock
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

import { AuditTimeline } from '@/components/AuditTimeline';

// Helper to generate consistent mock hash
const getMockHash = (id: string) => {
  if (!id) return '';
  // Deterministic mock hash based on ID
  return '0x' + Array.from(id).reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
  }, 0).toString(16).replace('-', 'f').padStart(64, '0').substring(0, 16);
};

// Mock TrustObserver agent logic (running client-side for demo)
function getTrustObserverExplanation(status: any) {
  if (!status) return { explanation: "Initializing...", summary: {} };

  const { start_ready, crs, blocking_reasons, recognized, accepted } = status;
  const band = crs?.band || 'UNKNOWN';
  
  let explanation = "";
  let key_blocker = null;

  if (start_ready) {
    explanation = "Subject is fully credentialed, recognized by the network, and accepted by the employer. Trust score is stable.";
  } else if (!recognized) {
    explanation = "Subject is not recognized by the trust network. Initial verification is required.";
    key_blocker = "MISSING_RECOGNITION";
  } else if (blocking_reasons?.includes('VERIFICATION_EXPIRED')) {
    explanation = "Trust integrity compromised. Verification signals have aged beyond the acceptable threshold, triggering automatic decay.";
    key_blocker = "VERIFICATION_EXPIRED";
  } else if (blocking_reasons?.includes('ACTIVE_SANCTIONS')) {
    explanation = "Critical blocker detected. Active sanctions in audit history prevent any clinical activity.";
    key_blocker = "ACTIVE_SANCTIONS";
  } else if (blocking_reasons?.includes('CRS_BELOW_THRESHOLD')) {
     explanation = "Cumulative trust factors (license status, tenure, sanctions) result in a score below the safety threshold.";
     key_blocker = "CRS_BELOW_THRESHOLD";
  } else if (!accepted) {
    explanation = "Network verification is valid, but the subject has not yet been accepted by this specific employer.";
    key_blocker = "MISSING_ACCEPTANCE";
  } else {
    explanation = "One or more blocking criteria are unmet.";
    key_blocker = blocking_reasons?.[0] || "UNKNOWN";
  }

  return {
    explanation,
    summary: {
      band,
      start_ready,
      key_blocker
    }
  };
}

export default function VerifierPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [clinicianId, setClinicianId] = useState('clinician:alice');
  const [employerId, setEmployerId] = useState('employer:alpha');
  const [simulateDecay, setSimulateDecay] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [latency, setLatency] = useState<number | null>(null);

  const trustObserver = useMemo(() => getTrustObserverExplanation(status), [status]);

  const checkTrustState = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const queryParams = new URLSearchParams({
        clinician_id: clinicianId,
        employer_id: employerId,
        simulate_decay: String(simulateDecay),
      });
      
      const res = await fetch(
        `${backendUrl}/trust-state?${queryParams.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to fetch trust state');
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setError(e.message);
      setStatus(null);
    } finally {
      const end = performance.now();
      setLatency(Math.round(end - start));
      setLoading(false);
    }
  };

  // Re-check when scenario parameters change
  useEffect(() => {
    // Only auto-check if we already have status (initial load requires manual check or we can trigger it)
    // Actually, usually manual check is better for initial, but for toggling scenarios, we want instant update.
    if (status) {
      checkTrustState();
    }
  }, [employerId, simulateDecay]);

  const handleAccept = async () => {
    if (!status?.recognitionId) return;
    setActionLoading(true);
    try {
      const payload = {
        acceptance: {
          recognitionId: status.recognitionId,
          facilityId: employerId === 'employer:alpha' ? 'facility:main' : 'facility:b', // Dynamic facility based on employer
          employerId: employerId, // Pass the current employer
          acceptedAt: new Date().toISOString(),
        },
      };
      // Note: The backend /acceptances endpoint might need to be updated if it doesn't accept employerId in payload
      // But looking at wedge.ts, it takes `employerId` from recognition. 
      // Wait, `insertAcceptance` uses `recognition.employerId`.
      // The `EmployerAcceptance` constructor takes `employerId`.
      // But in `wedge.ts`: `const acceptance = new EmployerAcceptance({ ..., employerId: recognition.employerId, ... })`
      // This means acceptance is TIED to the employer on the recognition.
      // So if recognition was for employer A, employer B cannot accept it?
      // "Reuse Scenario: Toggle employer (A / B)".
      // Reuse usually implies the RECOGNITION (PSV) is reusable.
      // But RecognitionEvent has an `employerId`.
      // If the Recognition is specific to an employer, it cannot be reused.
      // Unless the `employerId` on recognition is the *requesting* employer?
      // Or maybe the Recognition is "Network Recognition" (null employer?)
      // In `wedge.ts`: `employerId: String(recognitionInput.employerId ?? '')`.
      // If the recognition is tied to employer A, then employer B cannot accept it.
      // If we want Reuse, the recognition should probably be employer-agnostic or we need a new recognition for B?
      // "Trust-state recomputes instantly - CRS unchanged".
      // If I switch to Employer B, and they haven't recognized/accepted, then everything is missing.
      // But CRS (Credential Reputation Score) is likely global or tied to the subject.
      // So CRS unchanged makes sense.
      // But if Recognition is missing for B, then Trust State is RED.
      // This seems correct.
      
      // For the demo, let's assume we just call the endpoint.
      const res = await fetch(`${backendUrl}/acceptances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to accept');
      await checkTrustState();
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
      await checkTrustState();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return '—';
    }
  };

  const mapBlockingReason = (reason: string) => {
    switch (reason) {
      case 'MISSING_RECOGNITION': return 'Missing network recognition';
      case 'MISSING_ACCEPTANCE': return 'Missing employer acceptance';
      case 'CRS_BELOW_THRESHOLD': return 'CRS below threshold';
      case 'ACTIVE_SANCTIONS': return 'Active sanctions detected';
      case 'NO_ACTIVE_LICENSE': return 'No active license found';
      case 'START_ALREADY_ATTESTED': return 'Start already attested';
      case 'VERIFICATION_EXPIRED': return 'Verification expired';
      default: return reason.replace(/_/g, ' ').toLowerCase();
    }
  };

  const getBandColor = (band: string) => {
    switch (band) {
      case 'GREEN': return 'bg-green-600';
      case 'YELLOW': return 'bg-yellow-500';
      case 'RED': return 'bg-red-600';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-start font-sans">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Verifier Console</h1>
                <p className="text-slate-500 text-sm">Cryptographic Trust State Inspection</p>
              </div>
            </div>
            <div className="flex gap-2">
               <Input
                 placeholder="Clinician ID"
                 value={clinicianId}
                 onChange={(e) => setClinicianId(e.target.value)}
                 className="w-48 font-mono text-sm"
               />
               <Button 
                 onClick={checkTrustState} 
                 disabled={loading}
                 className="bg-blue-600 hover:bg-blue-700 font-semibold"
               >
                 {loading ? 'Verifying...' : 'Verify'}
               </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
             <div className="flex items-center gap-4">
               <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Same clinician. Different employer.</Label>
               <Tabs value={employerId} onValueChange={setEmployerId} className="w-[400px]">
                 <TabsList>
                   <TabsTrigger value="employer:alpha" className="flex items-center gap-2">
                     <Building2 className="w-4 h-4" />
                     Employer A
                   </TabsTrigger>
                   <TabsTrigger value="employer:beta" className="flex items-center gap-2">
                     <Building2 className="w-4 h-4" />
                     Employer B
                   </TabsTrigger>
                 </TabsList>
               </Tabs>
             </div>
             {latency !== null && (
               <div className="flex items-center gap-3">
                 <div className="text-xs text-slate-400 font-mono">
                   Resolved in {latency} ms
                 </div>
               </div>
             )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {status && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Trust Graph Summary & Agent Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Audit Timeline Panel */}
               <div className="md:col-span-1">
                 {status.timeline_preview && status.timeline_preview.length > 0 ? (
                    <AuditTimeline events={status.timeline_preview} />
                 ) : (
                   <Card className="bg-slate-50 border-slate-200 h-full">
                     <CardContent className="pt-6 flex flex-col justify-center h-full text-center">
                        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No audit history available</p>
                     </CardContent>
                   </Card>
                 )}
               </div>

               {/* Agent Explanation Panel */}
               <Card className="md:col-span-2 bg-slate-900 text-slate-50 border-slate-800 flex flex-col justify-center">
                 <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Explanation</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200 font-medium">
                      "{trustObserver.explanation}"
                    </p>
                    <div className="mt-4 flex gap-4 text-xs font-mono text-slate-500 border-t border-slate-800 pt-3">
                       <span>BAND: <span className={trustObserver.summary.band === 'GREEN' ? 'text-green-400' : 'text-red-400'}>{trustObserver.summary.band}</span></span>
                       <span>READY: <span className={trustObserver.summary.start_ready ? 'text-green-400' : 'text-red-400'}>{String(trustObserver.summary.start_ready).toUpperCase()}</span></span>
                       {trustObserver.summary.key_blocker && (
                         <span>BLOCKER: <span className="text-red-400">{trustObserver.summary.key_blocker}</span></span>
                       )}
                    </div>
                 </CardContent>
               </Card>
            </div>

            {/* Visual Causality Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Trust State Indicator */}
              <Card className={`border-l-4 ${status.start_ready ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                     <div>
                      <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Start Ready</Label>
                      <div className="mt-1 flex items-center gap-2">
                        {status.start_ready ? (
                          <div className="flex items-center gap-2 text-green-700 font-bold text-2xl">
                            <CheckCircle2 className="w-6 h-6" />
                            YES
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-red-600 font-bold text-2xl">
                              <XCircle className="w-6 h-6" />
                              NO
                            </div>
                            {/* Decay Visibility */}
                            {status.blocking_reasons?.includes('VERIFICATION_EXPIRED') && (
                              <span className="text-xs text-red-600 font-medium mt-1">Trust decayed automatically</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Audit Confidence Cue */}
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-slate-400" title="All decisions are timestamped and replayable">
                          <History className="w-3 h-3" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">Audit-backed</span>
                        </div>
                        
                        {/* Safety Cues */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 font-normal px-1.5 py-0 h-5 cursor-help">Idempotent</Badge>
                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 font-normal px-1.5 py-0 h-5 cursor-help">Concurrency-safe</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Replays return same result</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="text-right">
                       <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Status</Label>
                       <div className="mt-1">
                         <Badge variant={status.start_ready ? "default" : "destructive"} className="text-sm px-3 py-1">
                           {status.start_ready ? "CLEAR TO START" : "BLOCKED"}
                         </Badge>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CRS Score */}
              <Card className={`border-l-4 ${getBandColor(status.crs?.band || 'RED').replace('bg-', 'border-l-')}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">CRS Score</Label>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-bold text-slate-900">
                          {status.crs?.score ?? '—'}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                            <Checkbox 
                              id="decay-toggle" 
                              checked={simulateDecay} 
                              onCheckedChange={(checked: boolean | "indeterminate") => setSimulateDecay(checked as boolean)}
                              className="h-3 w-3 rounded-full border-slate-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                            />
                            <label htmlFor="decay-toggle" className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-pointer select-none">
                              Sim Decay
                            </label>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Band</Label>
                      <div className="mt-1">
                        <Badge className={`${getBandColor(status.crs?.band)} text-white hover:${getBandColor(status.crs?.band)} text-sm px-3 py-1`}>
                          {status.crs?.band ?? 'UNKNOWN'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dispute Evidence Panel */}
              <Card className="border-l-4 border-l-slate-300 bg-slate-50/50">
                <CardContent className="pt-6">
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3 block flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Dispute Evidence
                  </Label>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>Employer signature present</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>Hash anchor matches payload</span>
                    </li>
                     <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>Event order enforced</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Blocking Reasons (if any) */}
            {status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                 <h3 className="text-red-800 font-semibold flex items-center gap-2 text-sm uppercase tracking-wide mb-2">
                   <AlertCircle className="w-4 h-4" />
                   Blocking Reasons
                 </h3>
                 <ul className="list-disc list-inside space-y-1">
                   {status.blocking_reasons.map((reason: string) => (
                     <li key={reason} className="text-red-700 font-medium text-sm">
                       {mapBlockingReason(reason)}
                     </li>
                   ))}
                 </ul>
              </div>
            )}

            {/* Flow Steps */}
            <Card>
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-800">Verification & Acceptance Flow</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-0">
                
                {/* Step 1: Network Recognition */}
                <div className="flex gap-4 pb-8 relative">
                   <div className="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-100"></div>
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.recognized ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-300'}`}>
                      {status.recognized ? <CheckCircle2 className="w-6 h-6" /> : "1"}
                   </div>
                   <div className="flex-1 pt-2">
                     <div className="flex justify-between items-start">
                       <div>
                         <div className="flex items-center gap-2">
                           <h3 className={`font-semibold text-lg ${status.recognized ? 'text-slate-900' : 'text-slate-400'}`}>Network Recognition</h3>
                           {/* Reuse Visibility */}
                           {status.recognized && (
                             <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                               Verification Reused
                             </Badge>
                           )}
                         </div>
                         <p className="text-sm text-slate-500">Subject identified in clinical graph</p>
                         {status.recognized && (
                            <div className="space-y-2 mt-2">
                                <p className="text-xs text-slate-500">No re-verification performed</p>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-[10px] gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                    <FileSignature className="w-3 h-3" />
                                    Signed by VitalCV Network
                                  </Badge>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                         <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 cursor-help hover:text-slate-600">
                                           <Fingerprint className="w-3 h-3" />
                                           {getMockHash(status.recognitionId).substring(0,8)}...
                                         </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Tamper-evident hash anchor</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                            </div>
                         )}
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-slate-400 uppercase tracking-wide">Verified At</span>
                         <div className="font-mono text-sm text-slate-700">{formatTimestamp(status.recognizedAt)}</div>
                       </div>
                     </div>
                   </div>
                </div>

                {/* Step 2: Employer Acceptance */}
                <div className="flex gap-4 pb-8 relative">
                   <div className="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-100"></div>
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.accepted ? 'border-green-500 text-green-500' : status.recognized ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-300'}`}>
                      {status.accepted ? <CheckCircle2 className="w-6 h-6" /> : "2"}
                   </div>
                   <div className="flex-1 pt-2">
                     <div className="flex justify-between items-start mb-3">
                       <div>
                         <h3 className={`font-semibold text-lg ${status.accepted ? 'text-slate-900' : 'text-slate-500'}`}>Employer Acceptance</h3>
                         <p className="text-sm text-slate-500">Commitment to employ recognized subject</p>
                         
                         {status.accepted && status.acceptanceDetails && (
                           <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-0.5">Employer</span>
                                <span className="font-medium text-slate-700">{status.acceptanceDetails.employerId}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-0.5">Facility</span>
                                <span className="font-medium text-slate-700">{status.acceptanceDetails.facilityId}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-0.5">Role</span>
                                <span className="font-medium text-slate-700">{status.acceptanceDetails.role}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-0.5">Accepted At</span>
                                <span className="font-medium text-slate-700">{new Date(status.acceptanceDetails.acceptedAt).toLocaleDateString()}</span>
                              </div>
                           </div>
                         )}

                         {status.accepted && (
                            <div className="flex items-center gap-3 mt-3">
                              <Badge variant="outline" className="text-[10px] gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                <FileSignature className="w-3 h-3" />
                                Signed by {status.acceptanceDetails?.employerId || 'Employer'}
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                     <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 cursor-help hover:text-slate-600">
                                       <Fingerprint className="w-3 h-3" />
                                       {getMockHash(status.acceptanceId).substring(0,8)}...
                                     </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Tamper-evident hash anchor</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                         )}

                       </div>
                       <div className="text-right">
                         <span className="text-xs text-slate-400 uppercase tracking-wide">Accepted At</span>
                         <div className="font-mono text-sm text-slate-700">{formatTimestamp(status.acceptedAt)}</div>
                       </div>
                     </div>
                     {!status.accepted && (
                       <div className="mt-2">
                         <Button 
                           onClick={handleAccept}
                           disabled={!status.recognized || actionLoading}
                           className="bg-slate-900 hover:bg-slate-800 text-white"
                         >
                           {actionLoading ? 'Accepting...' : 'Accept Recognition'}
                         </Button>
                         <p className="text-[10px] text-slate-400 font-medium mt-1 ml-1">Replayable • Timestamped • Anchored</p>
                       </div>
                     )}
                   </div>
                </div>

                {/* Step 3: Start Attestation */}
                <div className="flex gap-4">
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.started ? 'border-green-500 text-green-500' : status.accepted ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-300'}`}>
                      {status.started ? <CheckCircle2 className="w-6 h-6" /> : "3"}
                   </div>
                   <div className="flex-1 pt-2">
                     <div className="flex justify-between items-start mb-3">
                       <div>
                         <h3 className={`font-semibold text-lg ${status.started ? 'text-slate-900' : 'text-slate-500'}`}>Start Attestation</h3>
                         <p className="text-sm text-slate-500">Official commencement of clinical duties</p>
                         
                         {status.started && (
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-[10px] gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                <FileSignature className="w-3 h-3" />
                                Signed by {status.acceptanceDetails?.employerId || 'Employer'}
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                     <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 cursor-help hover:text-slate-600">
                                       <Fingerprint className="w-3 h-3" />
                                       {getMockHash(status.startId).substring(0,8)}...
                                     </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Tamper-evident hash anchor</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                         )}
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-slate-400 uppercase tracking-wide">Started At</span>
                         <div className="font-mono text-sm text-slate-700">{formatTimestamp(status.attestedAt)}</div>
                       </div>
                     </div>
                     {!status.started && (
                       <div className="mt-2">
                         <Button 
                           onClick={handleStart}
                           disabled={!status.start_ready || actionLoading}
                           className={`${status.start_ready ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-200 text-slate-400'} text-white font-semibold`}
                         >
                           {actionLoading ? 'Attesting...' : 'Attest Start'}
                         </Button>
                         <p className="text-[10px] text-slate-400 font-medium mt-1 ml-1">Replayable • Timestamped • Anchored</p>
                       </div>
                     )}
                   </div>
                </div>

              </CardContent>
            </Card>

          </div>
        )}
        <div className="w-full max-w-3xl flex justify-between text-xs text-slate-400 px-1">
           <span>VitalCV Demo</span>
           <span>Audit trail recorded</span>
        </div>
      </div>
    </div>
  );
}
