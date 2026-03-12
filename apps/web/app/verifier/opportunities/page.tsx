'use client';

/**
 * /verifier/opportunities — Post and manage opportunities
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, AlertCircle, CheckCircle2, Briefcase, ChevronRight } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

const SPECIALTIES = ['Cardiology','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','OB/GYN','Oncology','Orthopedics','Pediatrics','Psychiatry','Radiology','Surgery','Urology','Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const INPUT = 'w-full rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-2.5 text-white placeholder:text-vt-neutral-800 focus:border-vt-info focus:outline-none focus:ring-1 focus:ring-vt-info transition text-sm';

type Opportunity = { id: string; title: string; specialty: string; hiringType: string; state: string; payRange: string | null; requirementLevel: string; remote: boolean; status: string; createdAt: string; organizationName: string };

export default function VerifierOpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hiringType, setHiringType] = useState('locums');
  const [state, setState] = useState('');
  const [payRange, setPayRange] = useState('');
  const [requirementLevel, setRequirementLevel] = useState('L1');
  const [description, setDescription] = useState('');
  const [remote, setRemote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  async function loadOpps() {
    try {
      const res = await fetch('/api/employer/opportunities');
      if (res.ok) {
        const data = await res.json() as { opportunities: Opportunity[] };
        setOpps(data.opportunities ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { void loadOpps(); }, []);

  async function handlePost() {
    if (!title.trim()) { setFormError('Title is required.'); return; }
    if (!specialty) { setFormError('Specialty is required.'); return; }
    if (!state) { setFormError('State is required.'); return; }
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/employer/opportunities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, specialty, hiringType, state, payRange: payRange || undefined, requirementLevel, description: description || undefined, remote }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `Failed (${res.status})`);
      }
      setSaved(true);
      setShowForm(false);
      setTitle(''); setSpecialty(''); setState(''); setPayRange(''); setDescription('');
      setSaved(false);
      await loadOpps();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Post failed.');
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-ops-gradient text-white">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Breadcrumb items={[{ label: 'Employer Dashboard', href: '/verifier/home' }, { label: 'My Opportunities' }]} className="mb-6" />

        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="heading-lg text-white">My Opportunities</h1>
            <p className="body-sm mt-1 text-vt-neutral-200">Posted roles and prequalified candidate pipeline.</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 rounded-xl bg-vt-info px-4 py-2.5 text-sm font-semibold text-white hover:bg-vt-info/90 transition">
            <Plus className="h-4 w-4" /> Post Opportunity
          </button>
        </header>

        {/* Post form */}
        {showForm && (
          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 mb-8 space-y-4">
            <h2 className="heading-sm text-white mb-2">New Opportunity</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Job Title <span className="text-red-400">*</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Locums Hospitalist — Night Shift" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Specialty <span className="text-red-400">*</span></label>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)} className={INPUT}>
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">State <span className="text-red-400">*</span></label>
                <select value={state} onChange={e => setState(e.target.value)} className={INPUT}>
                  <option value="">Select state</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Hiring Type</label>
                <select value={hiringType} onChange={e => setHiringType(e.target.value)} className={INPUT}>
                  {['locums','perm','telehealth','contract','per_diem'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Trust Level Required</label>
                <select value={requirementLevel} onChange={e => setRequirementLevel(e.target.value)} className={INPUT}>
                  <option value="L1">L1 — NPI verified</option>
                  <option value="L2">L2 — License verified</option>
                  <option value="L3">L3 — Full PSV complete</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Pay Range</label>
                <input value={payRange} onChange={e => setPayRange(e.target.value)} placeholder="e.g. $280–$340/hr or $320K–$380K" className={INPUT} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-vt-neutral-200 mb-1.5">Description <span className="text-vt-neutral-800 font-normal">(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Additional context, schedule details, start date…" className={`${INPUT} resize-none`} />
              </div>
              <div className="flex items-center gap-2">
                <input id="remote" type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} className="h-4 w-4 rounded border-vt-neutral-800 bg-vt-surface-ops-base text-vt-success" />
                <label htmlFor="remote" className="text-sm text-vt-neutral-200">Remote / Telehealth eligible</label>
              </div>
            </div>

            {formError && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</div>}
            {saved && <div className="flex items-center gap-2 text-sm text-vt-success"><CheckCircle2 className="h-4 w-4" /> Posted!</div>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-vt-neutral-800 px-5 py-2.5 text-sm text-vt-neutral-200 hover:border-vt-neutral-700 transition">Cancel</button>
              <button onClick={handlePost} disabled={saving} className="rounded-xl bg-vt-success px-6 py-2.5 text-sm font-semibold text-black hover:bg-vt-success/90 disabled:opacity-50 transition flex items-center gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Posting…</> : <>Post Opportunity <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Opportunities list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 text-zinc-600 animate-spin" /></div>
        ) : opps.length === 0 ? (
          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-12 text-center">
            <Briefcase className="h-10 w-10 text-vt-neutral-800 mx-auto mb-4" />
            <p className="heading-md text-white mb-2">No opportunities posted yet</p>
            <p className="body-sm text-vt-neutral-200 max-w-sm mx-auto mb-6">Post your first role to start receiving prequalified clinician candidates.</p>
            {!showForm && (
              <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-vt-info px-5 py-2.5 text-sm font-semibold text-white hover:bg-vt-info/90 transition">
                <Plus className="h-4 w-4" /> Post your first opportunity
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {opps.map(opp => (
              <div key={opp.id} className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{opp.title}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {[opp.specialty, opp.state, opp.hiringType.replace(/_/g,' '), opp.requirementLevel, opp.remote ? 'Remote' : null, opp.payRange].filter(Boolean).map((tag, i) => (
                      <span key={i} className="rounded-full bg-vt-surface-ops-base border border-vt-neutral-800 px-2.5 py-0.5 text-xs text-vt-neutral-200">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${opp.status === 'ACTIVE' ? 'bg-vt-success/10 text-vt-success' : 'bg-vt-neutral-800/30 text-vt-neutral-200'}`}>{opp.status}</span>
                  <Link href="/verifier/candidates" className="rounded-lg border border-vt-neutral-800 px-3 py-1.5 text-xs text-vt-neutral-200 hover:text-white hover:border-vt-neutral-700 transition">
                    View candidates →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {opps.length > 0 && (
          <div className="mt-6 text-center">
            <Link href="/verifier/candidates" className="inline-flex items-center gap-2 text-sm text-vt-info hover:text-vt-info/80 transition">
              View all verified candidates <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
