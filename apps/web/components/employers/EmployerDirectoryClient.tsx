'use client';
/**
 * Wave 186 — Employer Knowledge Layer
 * EmployerDirectoryClient — filters, cards, compare mode
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, MapPin, Users, ShieldCheck, Zap, Star,
  DollarSign, Clock, GitCompare, X, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: string;
  timeToStart: string;
  verified: boolean;
}

// ── Stub data (rendered client-side; Wave 187+ proxies real API) ──────────────

const STUB_EMPLOYERS: EmployerSummary[] = [
  {
    id: 'bay-area-cardiac-group',
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    facilityType: 'Specialty Practice',
    tagline: "The Bay Area's premier interventional cardiology group.",
    specialties: ['Cardiology', 'Electrophysiology'],
    states: ['CA'],
    openRoles: 4,
    trustScore: 94,
    hiringStatus: 'HIRING_NOW',
    timeToStart: '2–3 weeks',
    verified: true,
  },
  {
    id: 'mindbridge-health',
    slug: 'mindbridge-health',
    name: 'MindBridge Health',
    facilityType: 'Telehealth Platform',
    tagline: 'Mental healthcare without geographic limits.',
    specialties: ['Psychiatry', 'Behavioral Health'],
    states: ['CA', 'TX', 'FL', 'NY'],
    openRoles: 12,
    trustScore: 91,
    hiringStatus: 'HIRING_NOW',
    timeToStart: 'Flexible',
    verified: true,
  },
  {
    id: 'sacramento-medical-center',
    slug: 'sacramento-medical-center',
    name: 'Sacramento Medical Center',
    facilityType: 'Hospital System',
    tagline: 'Northern California critical care — excellence without compromise.',
    specialties: ['Critical Care', 'Emergency Medicine', 'Internal Medicine'],
    states: ['CA'],
    openRoles: 7,
    trustScore: 88,
    hiringStatus: 'HIRING_NOW',
    timeToStart: 'Immediate',
    verified: true,
  },
  {
    id: 'northwest-locums-alliance',
    slug: 'northwest-locums-alliance',
    name: 'Northwest Locums Alliance',
    facilityType: 'Locums Agency',
    tagline: 'Rapid placement in Pacific Northwest facilities.',
    specialties: ['Family Medicine', 'Internal Medicine', 'Emergency Medicine'],
    states: ['WA', 'OR', 'ID', 'MT'],
    openRoles: 19,
    trustScore: 85,
    hiringStatus: 'ACTIVELY_HIRING',
    timeToStart: '1–2 weeks',
    verified: true,
  },
  {
    id: 'kaiser-permanente-northern-california',
    slug: 'kaiser-permanente-northern-california',
    name: 'Kaiser Permanente Northern California',
    facilityType: 'Integrated Health System',
    tagline: 'Delivering total health for 4.5 million members.',
    specialties: ['All Specialties', 'Primary Care', 'Oncology', 'Surgery'],
    states: ['CA'],
    openRoles: 38,
    trustScore: 97,
    hiringStatus: 'ACTIVELY_HIRING',
    timeToStart: '4–8 weeks',
    verified: true,
  },
];

const ALL_SPECIALTIES = Array.from(
  new Set(STUB_EMPLOYERS.flatMap(e => e.specialties)),
).filter(s => s !== 'All Specialties').sort();

const ALL_STATES = Array.from(new Set(STUB_EMPLOYERS.flatMap(e => e.states))).sort();

const HIRING_STATUS_LABELS: Record<string, string> = {
  HIRING_NOW: 'Hiring Now',
  ACTIVELY_HIRING: 'Actively Hiring',
  ACCEPTING_APPLICATIONS: 'Accepting Applications',
  NOT_HIRING: 'Not Hiring',
};

const HIRING_STATUS_COLORS: Record<string, string> = {
  HIRING_NOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  ACTIVELY_HIRING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ACCEPTING_APPLICATIONS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  NOT_HIRING: 'bg-muted text-muted-foreground border-border',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmployerDirectoryClient() {
  const [specialty, setSpecialty] = useState('');
  const [state, setState] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const filtered = STUB_EMPLOYERS.filter(e => {
    if (specialty && !e.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))) return false;
    if (state && !e.states.includes(state)) return false;
    if (statusFilter && e.hiringStatus !== statusFilter) return false;
    return true;
  });

  const toggleCompare = useCallback((slug: string) => {
    setCompareList(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 4) return prev;
      return [...prev, slug];
    });
  }, []);

  const compareEmployers = filtered.filter(e => compareList.includes(e.slug));

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={specialty}
          onChange={e => setSpecialty(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground/80 focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All Specialties</option>
          {ALL_SPECIALTIES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={state}
          onChange={e => setState(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground/80 focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All States</option>
          {ALL_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground/80 focus:outline-none focus:border-blue-500/50"
        >
          <option value="">All Statuses</option>
          <option value="HIRING_NOW">Hiring Now</option>
          <option value="ACTIVELY_HIRING">Actively Hiring</option>
          <option value="ACCEPTING_APPLICATIONS">Accepting Applications</option>
        </select>

        {(specialty || state || statusFilter) && (
          <button
            onClick={() => { setSpecialty(''); setState(''); setStatusFilter(''); }}
            className="px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <div className="ml-auto text-sm text-muted-foreground self-center">
          {filtered.length} employer{filtered.length !== 1 ? 's' : ''}
          {compareList.length > 0 && (
            <button
              onClick={() => setShowCompare(true)}
              className="ml-3 px-3 py-1 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:bg-blue-600/50 transition-colors flex items-center gap-1 inline-flex"
            >
              <GitCompare className="w-3 h-3" />
              Compare ({compareList.length})
            </button>
          )}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No employers match your filters.</p>
          <button
            onClick={() => { setSpecialty(''); setState(''); setStatusFilter(''); }}
            className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(employer => (
            <EmployerCard
              key={employer.slug}
              employer={employer}
              selected={compareList.includes(employer.slug)}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareEmployers.length >= 2 && (
        <CompareModal
          employers={compareEmployers}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

// ── Employer Card ─────────────────────────────────────────────────────────────

function EmployerCard({
  employer,
  selected,
  onToggleCompare,
}: {
  employer: EmployerSummary;
  selected: boolean;
  onToggleCompare: (slug: string) => void;
}) {
  return (
    <div className={`relative rounded-xl border p-5 flex flex-col gap-4 transition-all ${
      selected
        ? 'border-blue-500/60 bg-blue-900/20'
        : 'border-border bg-white/[0.03] hover:border-border hover:bg-white/[0.06]'
    }`}>
      {/* Trust badge */}
      {employer.verified && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs">
          <ShieldCheck className="w-3 h-3" />
          <span>{employer.trustScore}</span>
        </div>
      )}

      {/* Header */}
      <div className="pr-16">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground leading-tight">{employer.name}</h3>
            <p className="text-xs text-foreground/70 mt-0.5">{employer.facilityType}</p>
          </div>
        </div>
        <p className="text-sm text-foreground mt-3 leading-relaxed">{employer.tagline}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs border ${HIRING_STATUS_COLORS[employer.hiringStatus] ?? 'bg-muted text-muted-foreground'}`}>
          {HIRING_STATUS_LABELS[employer.hiringStatus] ?? employer.hiringStatus}
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground/70">
          <Users className="w-3 h-3" /> {employer.openRoles} open
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground/70">
          <Clock className="w-3 h-3" /> {employer.timeToStart}
        </span>
      </div>

      {/* States + Specialties */}
      <div className="flex flex-wrap gap-1">
        {employer.states.slice(0, 5).map(s => (
          <span key={s} className="px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">{s}</span>
        ))}
        {employer.states.length > 5 && (
          <span className="text-xs text-muted-foreground/60">+{employer.states.length - 5}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {employer.specialties.slice(0, 3).map(s => (
          <span key={s} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">{s}</span>
        ))}
        {employer.specialties.length > 3 && (
          <span className="text-xs text-muted-foreground/60 self-center">+{employer.specialties.length - 3}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
        <Link
          href={`/employers/${employer.slug}`}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-muted hover:bg-muted text-sm text-foreground/70 hover:text-foreground transition-all"
        >
          View Profile <ChevronRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => onToggleCompare(employer.slug)}
          className={`px-3 py-2 rounded-lg text-sm transition-all ${
            selected
              ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400'
              : 'bg-muted hover:bg-muted text-foreground/70 hover:text-foreground/70'
          }`}
          title="Add to compare"
        >
          <GitCompare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Compare Modal ─────────────────────────────────────────────────────────────

function CompareModal({
  employers,
  onClose,
}: {
  employers: EmployerSummary[];
  onClose: () => void;
}) {
  const rows: Array<{ label: string; key: keyof EmployerSummary | 'statesStr' | 'specialtiesStr' }> = [
    { label: 'Type', key: 'facilityType' },
    { label: 'Trust Score', key: 'trustScore' },
    { label: 'Open Roles', key: 'openRoles' },
    { label: 'Time to Start', key: 'timeToStart' },
    { label: 'Hiring Status', key: 'hiringStatus' },
    { label: 'States', key: 'statesStr' },
    { label: 'Specialties', key: 'specialtiesStr' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0f1c] border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-border bg-[#0a0f1c]">
          <h2 className="font-semibold text-foreground">Compare Employers</h2>
          <button onClick={onClose} className="text-foreground/70 hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-normal pr-6 pb-4 w-32">Field</th>
                {employers.map(e => (
                  <th key={e.slug} className="text-left pb-4 px-3">
                    <div className="font-semibold text-foreground">{e.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">{e.facilityType}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-white/5">
                  <td className="text-muted-foreground py-3 pr-6">{row.label}</td>
                  {employers.map(e => {
                    let val: React.ReactNode;
                    if (row.key === 'statesStr') {
                      val = e.states.join(', ');
                    } else if (row.key === 'specialtiesStr') {
                      val = e.specialties.slice(0, 3).join(', ') + (e.specialties.length > 3 ? '…' : '');
                    } else if (row.key === 'trustScore') {
                      val = (
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">{e.trustScore}</span>
                        </span>
                      );
                    } else if (row.key === 'hiringStatus') {
                      val = (
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${HIRING_STATUS_COLORS[e.hiringStatus] ?? ''}`}>
                          {HIRING_STATUS_LABELS[e.hiringStatus] ?? e.hiringStatus}
                        </span>
                      );
                    } else {
                      val = String(e[row.key as keyof EmployerSummary] ?? '—');
                    }
                    return (
                      <td key={e.slug} className="py-3 px-3 text-foreground/70">{val}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-3 mt-6 pt-6 border-t border-border">
            {employers.map(e => (
              <Link
                key={e.slug}
                href={`/employers/${e.slug}`}
                className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted text-foreground/70 hover:text-foreground transition-all"
              >
                View {e.name.split(' ')[0]} <ChevronRight className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
