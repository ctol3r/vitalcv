'use client';

/**
 * EmployerReviewDashboard — List/queue view for clinician readiness packets.
 *
 * Assimilated from vitalcv-ai-sandbox. Complementary to ReviewClient (single
 * deep-review) — this component renders a filterable list of incoming packets.
 *
 * Truth Doctrine: All fake clinician data, overclaiming labels, and heavy
 * decoration have been stripped. Status vocabulary uses canonical TrustUiStatus.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  TrustStatusBadge,
  type TrustBadgeStatus,
} from '@/components/ui/trust-status-badge';

// ── Types ────────────────────────────────────────────────────────

export interface ClinicianPacket {
  clinicianName: string;
  npi: string;
  specialty: string;
  status: TrustBadgeStatus;
  submissionDate: string;
  timeToStart: string;
  synthesis: {
    verifiedCredentials: string;
    identifiedGaps: string;
    timeline: string;
  };
  sources: {
    name: string;
    status: TrustBadgeStatus;
    details: string;
  }[];
}

interface EmployerReviewDashboardProps {
  packets: ClinicianPacket[];
  onSelectPacket?: (packet: ClinicianPacket) => void;
  onExportPacket?: (packet: ClinicianPacket) => void;
}

// ── Component ────────────────────────────────────────────────────

export function EmployerReviewDashboard({
  packets,
  onSelectPacket,
  onExportPacket,
}: EmployerReviewDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [specialtyFilter, setSpecialtyFilter] = useState('All');
  const [dateRange, setDateRange] = useState<'All' | 'Last 7 Days' | 'Last 30 Days'>('All');

  const hasActiveFilters =
    searchQuery !== '' || statusFilter !== 'All' || specialtyFilter !== 'All' || dateRange !== 'All';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setSpecialtyFilter('All');
    setDateRange('All');
  };

  const handleExport = (packet: ClinicianPacket) => {
    if (onExportPacket) {
      onExportPacket(packet);
      return;
    }
    const dataStr = JSON.stringify(packet, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinician-packet-${packet.npi}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Apply filters
  const filteredPackets = packets.filter((packet) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !packet.clinicianName.toLowerCase().includes(query) &&
        !packet.npi.includes(query)
      ) {
        return false;
      }
    }
    if (statusFilter !== 'All' && packet.status !== statusFilter) return false;
    if (specialtyFilter !== 'All' && packet.specialty !== specialtyFilter) return false;

    if (dateRange !== 'All') {
      const packetDate = new Date(packet.submissionDate).getTime();
      const daysDiff = (Date.now() - packetDate) / (1000 * 3600 * 24);
      if (dateRange === 'Last 7 Days' && daysDiff > 7) return false;
      if (dateRange === 'Last 30 Days' && daysDiff > 30) return false;
    }

    return true;
  });

  const specialties = ['All', ...Array.from(new Set(packets.map((p) => p.specialty)))];

  return (
    <div data-slot="employer-review-dashboard" className="w-full space-y-8">
      <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clinician Packets</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review and manage incoming readiness snapshots.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          placeholder="Search clinicians by name or NPI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 font-mono text-sm"
          aria-label="Search clinicians"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-muted/30 p-4 md:flex-row md:items-center">
        <div className="flex w-full items-center justify-between md:mr-4 md:w-auto">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-[10px] uppercase tracking-widest md:hidden"
              aria-label="Clear all filters"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="status-filter"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-b border-border bg-transparent py-2 font-mono text-xs focus:border-foreground focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="checked">Checked</option>
              <option value="review_required">Review Required</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="specialty-filter"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Specialty
            </label>
            <select
              id="specialty-filter"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="border-b border-border bg-transparent py-2 font-mono text-xs focus:border-foreground focus:outline-none"
              aria-label="Filter by specialty"
            >
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="date-range-filter"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Date Range
            </label>
            <div className="relative">
              <select
                id="date-range-filter"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'All' | 'Last 7 Days' | 'Last 30 Days')}
                className="w-full appearance-none border-b border-border bg-transparent py-2 pl-6 font-mono text-xs focus:border-foreground focus:outline-none"
                aria-label="Filter by date range"
              >
                <option value="All">All Time</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
              </select>
              <Calendar
                className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-4 hidden whitespace-nowrap text-[10px] uppercase tracking-widest md:block"
            aria-label="Clear all filters"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Packet List */}
      <div className="space-y-4">
        {filteredPackets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <p className="font-mono text-xs uppercase">No packets match the current filters.</p>
          </div>
        ) : (
          filteredPackets.map((packet) => (
            <motion.div
              key={packet.npi}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card
                interactive
                className="cursor-pointer p-6"
                onClick={() => onSelectPacket?.(packet)}
              >
                <div className="flex flex-col justify-between gap-6 md:flex-row">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold tracking-tight">{packet.clinicianName}</h3>
                      <TrustStatusBadge status={packet.status} size="sm" />
                    </div>
                    <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
                      <span>NPI: {packet.npi}</span>
                      <span>&middot;</span>
                      <span>{packet.specialty}</span>
                      <span>&middot;</span>
                      <span>
                        Submitted: {new Date(packet.submissionDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden text-right sm:block">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Est. Start
                      </div>
                      <div className="font-mono text-lg font-bold">{packet.timeToStart}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(packet);
                        }}
                        aria-label="Export packet data"
                        title="Export packet data"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPacket?.(packet);
                        }}
                        aria-label="Open packet"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
