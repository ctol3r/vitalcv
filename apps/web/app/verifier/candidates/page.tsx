'use client';

/**
 * /verifier/candidates — Verified clinician candidate queue
 * Fetches real PersonProfile records from /api/candidates
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Loader2, MapPin, Stethoscope, ShieldCheck, ChevronRight } from 'lucide-react';
import VerifierBreadcrumb from '@/components/ui/VerifierBreadcrumb';

const SPECIALTIES = ['All','Cardiology','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','OB/GYN','Oncology','Orthopedics','Pediatrics','Psychiatry','Radiology','Surgery','Other'];
const STATES = ['All','CA','TX','NY','FL','IL','PA','OH','GA','NC','MI'];

type Candidate = { userId: string; npi: string; firstName: string | null; lastName: string | null; specialty: string | null; stateOfPractice: string | null; completeness: number };

export default function VerifierCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [specialty, setSpecialty] = useState('All');
  const [state, setState] = useState('All');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (specialty !== 'All') params.set('specialty', specialty);
    if (state !== 'All') params.set('state', state);
    fetch(`/api/candidates?${params}`)
      .then(r => r.json())
      .then((d: { candidates?: Candidate[]; total?: number }) => {
        setCandidates(d.candidates ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [specialty, state]);

  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <VerifierBreadcrumb label="Candidates" className="mb-6" />

        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="heading-lg text-white">Verified Candidates</h1>
            <p className="body-sm mt-1 text-vt-neutral-200">
              {loading ? 'Loading…' : `${total} clinician${total !== 1 ? 's' : ''} with verified NPI`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="rounded-full border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-2 text-sm text-vt-neutral-200 focus:outline-none focus:border-vt-info transition">
              {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={state} onChange={e => setState(e.target.value)}
              className="rounded-full border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-2 text-sm text-vt-neutral-200 focus:outline-none focus:border-vt-info transition">
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 text-muted-foreground animate-spin" /></div>
        ) : candidates.length === 0 ? (
          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-14 text-center">
            <Users className="h-10 w-10 text-vt-neutral-800 mx-auto mb-4" />
            <p className="heading-md text-white mb-2">No verified candidates yet</p>
            <p className="body-sm text-vt-neutral-200 max-w-sm mx-auto mb-6">
              Candidates appear here once clinicians verify their NPI through VitalCV.
              Post an opportunity to attract applicants.
            </p>
            <Link href="/verifier/opportunities" className="inline-flex items-center gap-2 rounded-xl bg-vt-info px-5 py-2.5 text-sm font-semibold text-white hover:bg-vt-info/90 transition">
              Post an opportunity <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {candidates.map(c => (
              <div key={c.npi} className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 hover:border-vt-neutral-700 transition group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-white">
                      {c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : `Clinician ${c.npi}`}
                    </p>
                    <p className="text-xs text-vt-neutral-800 font-mono mt-0.5">NPI {c.npi}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-vt-success/10 px-2.5 py-1 ring-1 ring-vt-success/20">
                    <ShieldCheck className="h-3 w-3 text-vt-success" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-vt-success">Verified</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {c.specialty && (
                    <span className="flex items-center gap-1 text-xs text-vt-neutral-200">
                      <Stethoscope className="h-3 w-3" />{c.specialty}
                    </span>
                  )}
                  {c.stateOfPractice && (
                    <span className="flex items-center gap-1 text-xs text-vt-neutral-200">
                      <MapPin className="h-3 w-3" />{c.stateOfPractice}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <div className="flex items-center justify-between text-[10px] text-vt-neutral-800 mb-1">
                      <span>Profile completeness</span>
                      <span className="font-semibold text-vt-neutral-200">{c.completeness}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-vt-surface-ops-base overflow-hidden">
                      <div className="h-full rounded-full bg-vt-success transition-all" style={{ width: `${c.completeness}%` }} />
                    </div>
                  </div>
                  <Link href={`/p/${c.npi}`}
                    className="rounded-lg border border-vt-neutral-800 px-3 py-1.5 text-xs font-medium text-vt-neutral-200 hover:text-white hover:border-vt-neutral-700 transition whitespace-nowrap">
                    View passport →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
