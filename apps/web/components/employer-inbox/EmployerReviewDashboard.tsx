'use client';

/**
 * EmployerReviewDashboard — Assimilated from AI Studio sandbox
 *
 * Changes from source:
 * - Removed all inline mock packets (3 hardcoded fake clinicians removed)
 * - Removed 'any' types; fully typed
 * - Removed 'text-green-600' on time-to-start (implied acceptance — doctrine violation)
 * - Removed fixed action bar that overlapped content (replaced with inline actions)
 * - Status badge colors preserved (amber/red/green) — these reflect data state, not endorsement
 * - Removed framer-motion enter animations on list items (decorative, not state-explanatory)
 * - Truth Doctrine: 'CHECKED' not 'VERIFIED'; 'ACCESS REQUIRED' not 'CLEAR'
 * - No mock data. If packets is empty, shows an empty state.
 */

import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Activity, Download, Filter, Calendar, Search } from 'lucide-react';

export type SourceStatus = 'CHECKED' | 'PENDING' | 'ACCESS REQUIRED';

export interface ClinicianPacketSource {
  name: string;
  status: SourceStatus;
  details: string;
}

export interface ClinicianPacketSynthesis {
  verifiedCredentials: string;
  identifiedGaps: string;
  timeline: string;
}

export interface ClinicianPacket {
  clinicianName: string;
  npi: string;
  specialty: string;
  status: 'Pending' | 'Ready' | 'Needs Review';
  submissionDate: string;
  timeToStart: string;
  synthesis: ClinicianPacketSynthesis;
  sources: ClinicianPacketSource[];
}

interface EmployerReviewDashboardProps {
  packets: ClinicianPacket[];
  onOpenPacket?: (npi: string) => void;
}

const statusColors: Record<ClinicianPacket['status'], string> = {
  Ready:          'border-emerald-500 text-emerald-600 bg-emerald-500/10',
  Pending:        'border-amber-500 text-amber-600 bg-amber-500/10',
  'Needs Review': 'border-red-500 text-red-600 bg-red-500/10',
};

const StatusIcon = ({ status }: { status: ClinicianPacket['status'] }) => {
  if (status === 'Ready')        return <CheckCircle2 className="w-3 h-3" />;
  if (status === 'Pending')      return <Clock className="w-3 h-3" />;
  return <AlertCircle className="w-3 h-3" />;
};

function handleExport(packet: ClinicianPacket) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clinician-packet-${packet.npi}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function EmployerReviewDashboard({ packets, onOpenPacket }: EmployerReviewDashboardProps) {
  const [searchQuery, setSearchQuery]       = useState('');
  const [statusFilter, setStatusFilter]     = useState<string>('All');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('All');
  const [dateRange, setDateRange]           = useState<'All' | 'Last 7 Days' | 'Last 30 Days'>('All');

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'All' || specialtyFilter !== 'All' || dateRange !== 'All';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setSpecialtyFilter('All');
    setDateRange('All');
  };

  const specialties = ['All', ...Array.from(new Set(packets.map((p) => p.specialty)))];

  const filtered = packets.filter((packet) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!packet.clinicianName.toLowerCase().includes(q) && !packet.npi.includes(q)) return false;
    }
    if (statusFilter !== 'All' && packet.status !== statusFilter) return false;
    if (specialtyFilter !== 'All' && packet.specialty !== specialtyFilter) return false;
    if (dateRange !== 'All') {
      const daysDiff = (Date.now() - new Date(packet.submissionDate).getTime()) / 86_400_000;
      if (dateRange === 'Last 7 Days' && daysDiff > 7) return false;
      if (dateRange === 'Last 30 Days' && daysDiff > 30) return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clinician packets</h2>
          <p className="text-sm text-muted-foreground mt-1">Review incoming readiness snapshots.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Activity className="w-3.5 h-3.5" />
          {packets.length} packet{packets.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          placeholder="Search by name or NPI…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search clinicians"
          className="w-full bg-background border border-border rounded-lg py-2.5 pl-9 pr-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 p-4 border border-border rounded-xl bg-muted/20 items-start md:items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="w-3.5 h-3.5" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="flex flex-col gap-1">
            <label htmlFor="status-filter" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="bg-background border-b border-border py-2 text-xs font-mono focus:outline-none"
            >
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Ready">Ready</option>
              <option value="Needs Review">Needs review</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="specialty-filter" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Specialty</label>
            <select
              id="specialty-filter"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              aria-label="Filter by specialty"
              className="bg-background border-b border-border py-2 text-xs font-mono focus:outline-none"
            >
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="date-range-filter" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" aria-hidden /> Date range
            </label>
            <select
              id="date-range-filter"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              aria-label="Filter by date range"
              className="bg-background border-b border-border py-2 text-xs font-mono focus:outline-none"
            >
              <option value="All">All time</option>
              <option value="Last 7 Days">Last 7 days</option>
              <option value="Last 30 Days">Last 30 days</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Packet list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center border border-border border-dashed rounded-xl">
            <p className="text-xs font-mono uppercase text-muted-foreground">
              {packets.length === 0 ? 'No packets yet.' : 'No packets match the current filters.'}
            </p>
          </div>
        ) : (
          filtered.map((packet) => (
            <div
              key={packet.npi}
              className="border border-border rounded-xl p-5 hover:bg-muted/20 transition-colors"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-semibold tracking-tight">{packet.clinicianName}</h3>
                    <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusColors[packet.status]}`}>
                      <StatusIcon status={packet.status} />
                      {packet.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground flex-wrap">
                    <span>NPI: {packet.npi}</span>
                    <span>·</span>
                    <span>{packet.specialty}</span>
                    <span>·</span>
                    <span>Submitted: {new Date(packet.submissionDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Est. start</div>
                    <div className="text-sm font-bold font-mono">{packet.timeToStart}</div>
                  </div>
                  <button
                    onClick={() => handleExport(packet)}
                    className="p-2 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    aria-label="Export packet data"
                    title="Export as JSON"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenPacket?.(packet.npi)}
                    className="p-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                    aria-label="Open packet"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
