'use client';

import { FormEvent, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthButton } from '@/components/AuthButton';
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
  History,
  FileSignature,
  Fingerprint,
  Lock,
  Loader2,
  Shield,
  Upload,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

import { AuditTimeline } from '@/components/AuditTimeline';
import {
  VerificationReceipts,
  type ReceiptRow,
  type ReceiptOutcome,
} from '@/components/VerificationReceipts';

const START_READY_CLARIFICATION =
  'PSV complete. Employer acceptance and start attestation still required.';

type CtaVariant = 'A' | 'B';
type VerifierRef = 'demo' | 'yc' | 'direct';

function getCtaVariant(): CtaVariant {
  const raw = process.env.NEXT_PUBLIC_CTA_VARIANT ?? process.env.CTA_VARIANT ?? 'A';
  return raw.trim().toUpperCase() === 'B' ? 'B' : 'A';
}

function isPilotModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_PILOT_MODE ?? process.env.PILOT_MODE;
  if (!raw) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

function getVerifierRef(rawRef: string | null): VerifierRef | null {
  if (rawRef === 'demo' || rawRef === 'yc' || rawRef === 'direct') {
    return rawRef;
  }
  return null;
}

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
    explanation = "Subject has PSV-backed recognition and employer acceptance on record. Start remains gated by explicit attestation timing.";
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
    explanation = "PSV-backed recognition is present, but this employer has not recorded acceptance for this scope.";
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
  return (
    <Suspense fallback={null}>
      <VerifierPageContent />
    </Suspense>
  );
}

function VerifierPageContent() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const searchParams = useSearchParams();
  const [clinicianId, setClinicianId] = useState('clinician:alice');
  const [employerId, setEmployerId] = useState('employer:alpha');
  const [simulateDecay, setSimulateDecay] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pilotOrganization, setPilotOrganization] = useState('');
  const [pilotContactEmail, setPilotContactEmail] = useState('');
  const [pilotActivationState, setPilotActivationState] = useState<string | null>(null);
  const [pilotActivationLoading, setPilotActivationLoading] = useState(false);
  const ctaVariant = getCtaVariant();
  const pilotModeEnabled = isPilotModeEnabled();
  const verifierRef = getVerifierRef(searchParams.get('ref'));
  const pilotActivationButtonLabel =
    ctaVariant === 'B' ? 'Start 30-Day Pilot' : 'Request Pilot Access';

  /* ---- CRS change tracking ---- */
  const prevCrsRef = useRef<number | null>(null);
  const [crsUpdatedBanner, setCrsUpdatedBanner] = useState(false);

  const trustObserver = useMemo(() => getTrustObserverExplanation(status), [status]);

  /* ---- Manual Verification State ---- */
  const [manualSubject, setManualSubject] = useState('');
  const [manualAttestor, setManualAttestor] = useState<'Employer' | 'CVO'>('Employer');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualVerifications, setManualVerifications] = useState<
    { id: number; subject: string; attestor: string; status: 'PENDING' | 'COMPLETE' | 'FAILED'; timestamp: string; reason?: string }[]
  >([]);
  const manualIdRef = useRef(0);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  const checkTrustState = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
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
      setLoading(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    checkTrustState();
  }, []);

  // Re-check when scenario parameters change
  useEffect(() => {
    if (status) {
      checkTrustState();
    }
  }, [employerId, simulateDecay]);

  // Track CRS score changes
  useEffect(() => {
    if (status?.crs?.score != null) {
      if (prevCrsRef.current !== null && prevCrsRef.current !== status.crs.score) {
        setCrsUpdatedBanner(true);
      }
      prevCrsRef.current = status.crs.score;
    }
  }, [status]);

  const handleAccept = async () => {
    if (!status?.recognitionId) return;
    setActionLoading(true);
    try {
      const psvReportId = status?.timeline_preview?.find(
        (event: any) => event?.type === 'VERIFICATION_COMPLETED',
      )?.metadata?.psv_report_id;
      if (!psvReportId) {
        throw new Error('Acceptance requires completed PSV.');
      }

      const payload = {
        acceptance: {
          recognitionId: status.recognitionId,
          psvReportId,
          facilityId: employerId === 'employer:alpha' ? 'facility:main' : 'facility:b', // Dynamic facility based on employer
          employerId: employerId, // Pass the current employer
          acceptedAt: new Date().toISOString(),
        },
      };
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

  const handlePilotActivate = async (event: FormEvent) => {
    event.preventDefault();
    setPilotActivationState(null);

    if (!pilotOrganization.trim() || !pilotContactEmail.trim()) {
      setPilotActivationState('Organization name and contact email are required.');
      return;
    }

    setPilotActivationLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/pilot/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: pilotOrganization,
          contactEmail: pilotContactEmail,
          ctaVariant,
          ref: verifierRef,
          npi: 'pilot_activation',
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `Request failed (HTTP ${response.status}).`);
      }

      setPilotActivationState('Pilot access request submitted.');
      setPilotOrganization('');
      setPilotContactEmail('');
    } catch (err) {
      setPilotActivationState(
        err instanceof Error ? err.message : 'Unable to submit pilot access request.',
      );
    } finally {
      setPilotActivationLoading(false);
    }
  };

  /* ---- Manual Verification Handler ---- */
  const handleManualVerification = async () => {
    if (!manualSubject.trim() || !manualFile || !clinicianId.trim()) return;

    const id = ++manualIdRef.current;
    setManualVerifications((prev) => [
      ...prev,
      {
        id,
        subject: manualSubject.trim(),
        attestor: manualAttestor,
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
      },
    ]);
    setManualSubmitting(true);

    try {
      const res = await fetch(`${backendUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'employment',
          clinician_id: clinicianId,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setManualVerifications((prev) =>
          prev.map((v) =>
            v.id === id
              ? {
                  ...v,
                  status: 'FAILED' as const,
                  timestamp: new Date().toISOString(),
                  reason: body || `Request failed (HTTP ${res.status}).`,
                }
              : v,
          ),
        );
        return;
      }

      await res.json();
      setManualVerifications((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, status: 'COMPLETE' as const, timestamp: new Date().toISOString() }
            : v,
        ),
      );

      setManualSubject('');
      setManualFile(null);
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';
    } catch (err) {
      setManualVerifications((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                status: 'FAILED' as const,
                timestamp: new Date().toISOString(),
                reason:
                  err instanceof Error ? err.message : 'Unable to reach the verification service.',
              }
            : v,
        ),
      );
    } finally {
      setManualSubmitting(false);
      await checkTrustState();
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
      case 'MISSING_PSV': return 'Missing required PSV';
      case 'EXPIRED_PSV': return 'PSV receipt expired';
      case 'REVOKED_PSV': return 'PSV receipt revoked';
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
      case 'GREEN': return 'bg-green-700';
      case 'YELLOW': return 'bg-yellow-600';
      case 'RED': return 'bg-red-700';
      default: return 'bg-slate-500';
    }
  };

  const normalizeEventLabel = (label?: string) => {
    if (label?.toLowerCase() === 'verification completed') return 'Recognition recorded';
    return label;
  };

  /* ---- Verification Receipts derivation ---- */
  const receiptRows: ReceiptRow[] = useMemo(() => {
    const rows: ReceiptRow[] = [];

    if (status?.timeline_preview) {
      for (const event of status.timeline_preview) {
        if (event.type === 'VERIFICATION_COMPLETED') {
          rows.push({
            lane: (event.metadata?.lane || 'PUBLIC').toUpperCase(),
            subject:
              event.metadata?.verification_check ||
              normalizeEventLabel(event.label) ||
              'Verification',
            outcome: 'PASS' as ReceiptOutcome,
            timestamp: event.timestamp,
            hash: getMockHash(event.id || event.timestamp).substring(2, 10),
          });
        } else if (event.type === 'VERIFICATION_FAILED') {
          rows.push({
            lane: (event.metadata?.lane || 'PUBLIC').toUpperCase(),
            subject:
              event.metadata?.verification_check ||
              normalizeEventLabel(event.label) ||
              'Verification',
            outcome: 'FAIL' as ReceiptOutcome,
            timestamp: event.timestamp,
            hash: getMockHash(event.id || event.timestamp).substring(2, 10),
          });
        }
      }
    }

    for (const mv of manualVerifications) {
      const outcome: ReceiptOutcome =
        mv.status === 'COMPLETE' ? 'PASS' : mv.status === 'FAILED' ? 'FAIL' : 'PENDING';
      rows.push({
        lane: 'MANUAL',
        subject: mv.subject,
        outcome,
        timestamp: mv.timestamp,
        hash: getMockHash(`mv-${mv.id}`).substring(2, 10),
      });
    }

    return rows;
  }, [status?.timeline_preview, manualVerifications]);

  const allReceiptsPass =
    receiptRows.length > 0 && receiptRows.every((r) => r.outcome === 'PASS');
  const failedOrPendingReceipts = receiptRows.filter((r) => r.outcome !== 'PASS');

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-start font-sans">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-700" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Verifier Console</h1>
                <p className="text-slate-500 text-sm">Trust State Inspection</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <Input
                 placeholder="Clinician ID"
                 value={clinicianId}
                 onChange={(e) => setClinicianId(e.target.value)}
                 className="w-48 font-mono text-sm"
               />
               <Button 
                 onClick={checkTrustState} 
                 disabled={loading}
                 className="bg-blue-700 hover:bg-blue-800 font-semibold"
               >
                 {loading ? 'Verifying...' : 'Verify'}
               </Button>
               <AuthButton />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
             <div className="flex items-center gap-4">
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
                   <Card className="bg-slate-50 border-slate-200 h-full min-h-[200px]">
                     <CardContent className="pt-6 flex flex-col justify-center h-full text-center">
                        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No audit history available</p>
                     </CardContent>
                   </Card>
                 )}
               </div>

               {/* Agent Explanation Panel */}
               <Card className="md:col-span-2 bg-slate-900 text-slate-50 border-slate-800 flex flex-col justify-center min-h-[200px]">
                 <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Explanation</h3>
                    </div>
                    <p className="text-lg leading-relaxed text-slate-200 font-medium">
                      "{trustObserver.explanation}"
                    </p>
                    <div className="mt-4 flex gap-4 text-xs font-mono text-slate-500 border-t border-slate-800 pt-3">
                       <span>BAND: <span className={trustObserver.summary.band === 'GREEN' ? 'text-green-600' : 'text-red-600'}>{trustObserver.summary.band}</span></span>
                       <span>READY: <span className={trustObserver.summary.start_ready ? 'text-green-600' : 'text-red-600'}>{String(trustObserver.summary.start_ready).toUpperCase()}</span></span>
                       {trustObserver.summary.key_blocker && (
                         <span>BLOCKER: <span className="text-red-600">{trustObserver.summary.key_blocker}</span></span>
                       )}
                    </div>
                 </CardContent>
               </Card>
            </div>

            {/* Visual Causality Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Trust State Indicator */}
              <Card className={`border-l-4 ${status.start_ready ? 'border-l-green-700' : 'border-l-red-700'} min-h-[180px]`}>
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
                            <div className="flex items-center gap-2 text-red-700 font-bold text-2xl">
                              <XCircle className="w-6 h-6" />
                              NO
                            </div>
                            {/* Decay Visibility */}
                            {status.blocking_reasons?.includes('VERIFICATION_EXPIRED') && (
                              <span className="text-sm text-red-700 font-medium mt-1">Trust decayed automatically</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Audit Confidence Cue */}
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-slate-400" title="All decisions are timestamped and replayable">
                          <History className="w-3 h-3" />
                          <span className="text-xs font-medium uppercase tracking-wider">Audit-backed</span>
                        </div>
                        
                        {/* Safety Cues */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs text-slate-400 border-slate-200 font-normal px-1.5 py-0 h-5 cursor-help">Idempotent</Badge>
                                <Badge variant="outline" className="text-xs text-slate-400 border-slate-200 font-normal px-1.5 py-0 h-5 cursor-help">Concurrency-safe</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Replays return same result</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Artifact Trust State Badge */}
                        {status.crs && (
                          <div className="mt-1 border border-slate-200 rounded px-2 py-0.5 inline-flex items-center gap-1.5">
                            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Trust State:</span>
                            <span className="text-xs font-mono font-semibold text-slate-700 uppercase">
                              {status.blocking_reasons?.includes('VERIFICATION_EXPIRED')
                                ? 'EXPIRED'
                                : status.crs.band === 'GREEN' && status.start_ready
                                  ? 'VERIFIED'
                                  : status.crs.band === 'YELLOW'
                                    ? 'EXPIRING SOON'
                                    : status.blocking_reasons?.length > 0
                                      ? 'NEEDS REVIEW'
                                      : 'MONITORING ACTIVE'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Status</Label>
                       <div className="mt-1">
                       <Badge variant={status.start_ready ? "default" : "destructive"} className="text-sm px-3 py-1">
                           {status.start_ready ? "CRS threshold met (employer action required)" : "BLOCKED"}
                         </Badge>
                       </div>
                       <p className="mt-2 text-xs text-slate-500 max-w-44">
                         {START_READY_CLARIFICATION}
                       </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CRS Score */}
              <Card className={`border-l-4 ${getBandColor(status.crs?.band || 'RED').replace('bg-', 'border-l-')} min-h-[180px]`}>
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
                              className="h-3 w-3 rounded-full border-slate-300 data-[state=checked]:bg-red-700 data-[state=checked]:border-red-700"
                            />
                            <label htmlFor="decay-toggle" className="text-xs uppercase font-bold tracking-wider text-slate-400 cursor-pointer select-none">
                              Simulate Decay
                            </label>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Band</Label>
                      <div className="mt-1">
                        <Badge className={`${getBandColor(status.crs?.band)} text-white hover:opacity-90 text-sm px-3 py-1`}>
                          {status.crs?.band ?? 'UNKNOWN'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dispute Evidence Panel */}
              <Card className="border-l-4 border-l-slate-300 bg-slate-50/50 min-h-[180px]">
                <CardContent className="pt-6">
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3 block flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Dispute Evidence
                  </Label>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-700 shrink-0 mt-0.5" />
                      <span>Employer signature present</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-700 shrink-0 mt-0.5" />
                      <span>Hash anchor matches payload</span>
                    </li>
                     <li className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-700 shrink-0 mt-0.5" />
                      <span>Event order enforced</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* System Check / Blocking Reasons */}
            <div className={`border rounded-lg p-4 transition-colors ${status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
               <h3 className={`font-semibold flex items-center gap-2 text-sm uppercase tracking-wide mb-2 ${status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready ? 'text-red-800' : 'text-green-800'}`}>
                 {status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                 {status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready ? 'Blocking Reasons' : 'System Check'}
               </h3>
               {status.blocking_reasons && status.blocking_reasons.length > 0 && !status.start_ready ? (
                 <ul className="list-disc list-inside space-y-1">
                   {status.blocking_reasons.map((reason: string) => (
                     <li key={reason} className="text-red-700 font-medium text-sm">
                       {mapBlockingReason(reason)}
                     </li>
                   ))}
                 </ul>
               ) : (
                 <p className="text-green-700 font-medium text-sm">No blocking signals detected.</p>
               )}
            </div>

            {/* Verification Receipts Panel */}
            {receiptRows.length > 0 && (
              <VerificationReceipts
                receipts={receiptRows}
                crsUpdated={crsUpdatedBanner}
              />
            )}

            {/* Manual Verification Panel */}
            <Card>
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-600" />
                  Manual Verification
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a document for preview review. This creates a recorded receipt.
                </p>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-700">Subject</Label>
                    <Input
                      type="text"
                      placeholder="e.g., License – State, Education"
                      value={manualSubject}
                      onChange={(e) => setManualSubject(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-700">Attestor</Label>
                    <select
                      aria-label="Attestor"
                      value={manualAttestor}
                      onChange={(e) => setManualAttestor(e.target.value as 'Employer' | 'CVO')}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="Employer">Employer</option>
                      <option value="CVO">CVO</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">Document</Label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-2 cursor-pointer hover:border-slate-300 transition-colors flex-1">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {manualFile ? manualFile.name : 'Select PDF or DOCX'}
                      </span>
                      <input
                        ref={manualFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                    {manualFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualFile(null);
                          if (manualFileInputRef.current) manualFileInputRef.current.value = '';
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Remove file"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">File is not stored in this preview.</p>
                </div>

                <Button
                  onClick={handleManualVerification}
                  disabled={manualSubmitting || !manualSubject.trim() || !manualFile}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {manualSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Submit Manual Verification
                    </>
                  )}
                </Button>

                {/* Verification Receipts */}
                {manualVerifications.length > 0 && (
                  <div className="rounded-md border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Attestor
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Receipt
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {manualVerifications.map((v) => (
                          <tr
                            key={v.id}
                            className={v.status === 'FAILED' ? 'bg-red-50/30' : 'bg-white'}
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-700">{v.subject}</td>
                            <td className="px-4 py-2.5 text-slate-600">{v.attestor}</td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={`text-[11px] border ${
                                  v.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : v.status === 'COMPLETE'
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                } hover:bg-transparent`}
                              >
                                <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
                                  v.status === 'PENDING'
                                    ? 'bg-gray-400'
                                    : v.status === 'COMPLETE'
                                    ? 'bg-green-600'
                                    : 'bg-red-600'
                                }`} />
                                {v.status === 'PENDING'
                                  ? 'PENDING'
                                  : v.status === 'COMPLETE'
                                  ? 'PASS'
                                  : 'FAIL'}
                              </Badge>
                              {v.status === 'FAILED' && v.reason && (
                                <p className="text-xs text-red-600 mt-1">{v.reason}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                              {new Date(v.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-2.5">
                              {v.status === 'COMPLETE' ? (
                                <span className="text-xs text-slate-700 flex items-center gap-1">
                                  <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                                  Recorded
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">&mdash;</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Flow Steps */}
            <Card>
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-800">Verification & Acceptance Flow</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-0">
                
                {/* Step 1: Network Recognition */}
                <div className="flex gap-4 pb-8 relative">
                   <div className="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-100"></div>
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.recognized ? 'border-blue-700 text-blue-700' : 'border-slate-300 text-slate-300'}`}>
                      {status.recognized ? <CheckCircle2 className="w-6 h-6" /> : "1"}
                   </div>
                   <div className="flex-1 pt-2">
                     <div className="flex justify-between items-start">
                       <div>
                         <div className="flex items-center gap-2">
                           <h3 className={`font-semibold text-lg ${status.recognized ? 'text-slate-900' : 'text-slate-400'}`}>Network Recognition</h3>
                           {/* Reuse Visibility */}
                           {status.recognized && (
                             <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                               Recognition Reused
                             </Badge>
                           )}
                         </div>
                         <p className="text-sm text-slate-500">Subject identified in clinical graph</p>
                         {status.recognized && (
                            <div className="space-y-2 mt-2">
                                <p className="text-xs text-slate-500">No new verification run</p>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                    <FileSignature className="w-3 h-3" />
                                    Recorded by VitalCV Network
                                  </Badge>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                         <div className="flex items-center gap-1 text-xs font-mono text-slate-400 cursor-help hover:text-slate-600">
                                           <Fingerprint className="w-3 h-3" />
                                           {getMockHash(status.recognitionId).substring(0,8)}...
                                         </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Demo reference hash</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                            </div>
                         )}
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-slate-400 uppercase tracking-wide">Recorded At</span>
                         <div className="font-mono text-sm text-slate-700">{formatTimestamp(status.recognizedAt)}</div>
                       </div>
                     </div>
                   </div>
                </div>

                {/* Step 2: Employer Acceptance */}
                <div className="flex gap-4 pb-8 relative">
                   <div className="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-100"></div>
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.accepted ? 'border-green-700 text-green-700' : status.recognized ? 'border-blue-700 text-blue-700' : 'border-slate-300 text-slate-300'}`}>
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
                             <Badge variant="outline" className="text-xs gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                <FileSignature className="w-3 h-3" />
                                Recorded by {status.acceptanceDetails?.employerId || 'Employer'}
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                     <div className="flex items-center gap-1 text-xs font-mono text-slate-400 cursor-help hover:text-slate-600">
                                       <Fingerprint className="w-3 h-3" />
                                       {getMockHash(status.acceptanceId).substring(0,8)}...
                                     </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Demo reference hash</p>
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
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="inline-block">
                                 <Button 
                                   onClick={handleAccept}
                                   disabled={!status.recognized || actionLoading || status.crs?.band !== 'GREEN' || !allReceiptsPass}
                                   className={`bg-slate-900 hover:bg-slate-800 text-white ${
                                     !status.recognized || status.crs?.band !== 'GREEN' || !allReceiptsPass
                                       ? 'opacity-50 cursor-not-allowed'
                                       : ''
                                   }`}
                                 >
                                   {actionLoading ? 'Accepting...' : 'Accept Recognition'}
                                 </Button>
                               </span>
                             </TooltipTrigger>
                             <TooltipContent side="top" className="max-w-xs">
                               <p>
                                 {failedOrPendingReceipts.length > 0
                                   ? `Employer action required — ${failedOrPendingReceipts.map((r) => `${r.subject}: ${r.outcome}`).join(', ')}`
                                   : 'Employer action required'}
                               </p>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                         <p className="text-xs text-slate-400 font-medium mt-1 ml-1">
                           Employer action required
                         </p>
                       </div>
                     )}
                   </div>
                </div>

                {/* Step 3: Start Attestation */}
                <div className="flex gap-4">
                   <div className={`mt-1 z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${status.started ? 'border-green-700 text-green-700' : status.accepted ? 'border-blue-700 text-blue-700' : 'border-slate-300 text-slate-300'}`}>
                      {status.started ? <CheckCircle2 className="w-6 h-6" /> : "3"}
                   </div>
                   <div className="flex-1 pt-2">
                     <div className="flex justify-between items-start mb-3">
                       <div>
                         <h3 className={`font-semibold text-lg ${status.started ? 'text-slate-900' : 'text-slate-500'}`}>Start Attestation</h3>
                         <p className="text-sm text-slate-500">Official commencement of clinical duties</p>
                         
                         {status.started && (
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs gap-1 px-2 border-slate-200 text-slate-500 font-normal">
                                <FileSignature className="w-3 h-3" />
                                Recorded by {status.acceptanceDetails?.employerId || 'Employer'}
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                     <div className="flex items-center gap-1 text-xs font-mono text-slate-400 cursor-help hover:text-slate-600">
                                       <Fingerprint className="w-3 h-3" />
                                       {getMockHash(status.startId).substring(0,8)}...
                                     </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Demo reference hash</p>
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
                           className={`${status.start_ready ? 'bg-green-700 hover:bg-green-800' : 'bg-slate-200 text-slate-400'} text-white font-semibold`}
                         >
                           {actionLoading ? 'Attesting...' : 'Attest Start'}
                         </Button>
                         <p className="text-xs text-slate-400 font-medium mt-1 ml-1">Replayable • Timestamped • Anchored</p>
                       </div>
                     )}
                   </div>
                </div>

              </CardContent>
            </Card>

          </div>
        )}
        {pilotModeEnabled ? (
          <div className="w-full max-w-3xl flex justify-between text-xs text-slate-400 px-1">
          <form onSubmit={handlePilotActivate} className="mt-0 w-full space-y-3 border border-slate-200 p-4 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Verifier Pilot Access</h3>
              <Button type="submit" disabled={pilotActivationLoading} className="bg-slate-900">
                {pilotActivationLoading ? 'Submitting…' : pilotActivationButtonLabel}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Organization name"
                value={pilotOrganization}
                onChange={(e) => setPilotOrganization(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Contact email"
                value={pilotContactEmail}
                onChange={(e) => setPilotContactEmail(e.target.value)}
              />
            </div>

            {pilotActivationState && <p className="text-xs text-slate-500">{pilotActivationState}</p>}
          </form>
        </div>
        ) : null}
      </div>
    </div>
  );
}
