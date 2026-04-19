"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, Clock, AlertCircle, ArrowRight, User, Activity, FileText, RefreshCw, ShieldAlert, Filter, Calendar, Download, Search, ChevronDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/sandbox/lib/utils";
import TrustWarrantyShield from "@/components/employer/warranty/TrustWarrantyShield";
import WarrantyCoverageMatrix from "@/components/employer/warranty/WarrantyCoverageMatrix";
import ActuarialRiskPanel from "@/components/employer/warranty/ActuarialRiskPanel";

type ReadinessBand = "CLEARED FOR START" | "CONDITIONAL READY" | "REVIEW REQUIRED";

function deriveReadinessBand(
  sources: { status: string }[] | undefined,
): ReadinessBand {
  if (!sources || sources.length === 0) return "CONDITIONAL READY";
  if (sources.some((s) => s.status === "UNAVAILABLE")) return "REVIEW REQUIRED";
  if (sources.every((s) => s.status === "CHECKED")) return "CLEARED FOR START";
  return "CONDITIONAL READY";
}

const READINESS_TONE: Record<
  ReadinessBand,
  { dot: string; text: string; ring: string }
> = {
  "CLEARED FOR START": {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  "CONDITIONAL READY": {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
  },
  "REVIEW REQUIRED": {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
  },
};

export interface ClinicianPacket {
  clinicianName: string;
  npi: string;
  specialty: string;
  status: "READY" | "PARTIAL" | "BLOCKED";
  submissionDate: string;
  timeToStart: string;
  synthesis: {
    verifiedCredentials: string;
    identifiedGaps: string;
    timeline: string;
  };
  sources: {
    name: string;
    status: "CHECKED" | "PENDING" | "ACCESS REQUIRED" | "UNAVAILABLE" | "REVIEW REQUIRED" | "STALE";
    details: string;
  }[];
  internalNotes?: string;
}

export interface EmployerReviewProps {
  packets?: ClinicianPacket[];
  // Fallback for single packet view (legacy support)
  clinicianName?: string;
  npi?: string;
  timeToStart?: string;
  synthesis?: {
    verifiedCredentials: string;
    identifiedGaps: string;
    timeline: string;
  };
  sources?: {
    name: string;
    status: "CHECKED" | "PENDING" | "ACCESS REQUIRED" | "UNAVAILABLE" | "REVIEW REQUIRED" | "STALE";
    details: string;
  }[];
}

const EmployerReviewDashboard: React.FC<EmployerReviewProps> = (props) => {
  // Determine if we are in list mode or single view mode
  const isListMode = !!props.packets;

  const handleExport = (data: any, npi: string) => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinician-packet-${npi}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // State for filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [specialtyFilters, setSpecialtyFilters] = useState<string[]>([]);
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<"All" | "Last 7 Days" | "Last 30 Days">("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const specialtyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (specialtyDropdownRef.current && !specialtyDropdownRef.current.contains(event.target as Node)) {
        setIsSpecialtyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "All" || specialtyFilters.length > 0 || dateRange !== "All";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setSpecialtyFilters([]);
    setDateRange("All");
    setCurrentPage(1);
  };

  // Mock packets if none provided in list mode (for demonstration)
  const defaultPackets: ClinicianPacket[] = [
    {
      clinicianName: props.clinicianName || "Dr. John Smith, MD",
      npi: props.npi || "1234567890",
      specialty: "Internal Medicine",
      status: "PARTIAL" as const,
      submissionDate: new Date().toISOString(),
      timeToStart: props.timeToStart || "14 Days",
      synthesis: props.synthesis || {
        verifiedCredentials: "NPPES Identity confirmed.",
        identifiedGaps: "PECOS Enrollment status is PENDING.",
        timeline: "Estimated onboarding completion in 14 days.",
      },
      sources: props.sources || [
        { name: "Identity", status: "CHECKED" as const, details: "NPPES Registry match confirmed." },
        { name: "Sanctions", status: "PENDING" as const, details: "OIG/LEIE check in progress." },
        { name: "Federal Exclusions", status: "PENDING" as const, details: "SAM.gov check in progress." },
        { name: "State Board", status: "CHECKED" as const, details: "CA Medical Board license active." },
        { name: "Board Certification", status: "CHECKED" as const, details: "ABMS certification verified." },
        { name: "DEA Registration", status: "ACCESS REQUIRED" as const, details: "Requires institutional access to verify." }
      ],
    },
    {
      clinicianName: "Dr. Sarah Chen, DO",
      npi: "1003000126",
      specialty: "Emergency Medicine",
      status: "READY" as const,
      submissionDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      timeToStart: "0 Days",
      synthesis: {
        verifiedCredentials: "All primary sources verified and active.",
        identifiedGaps: "None.",
        timeline: "Cleared to start immediately.",
      },
      sources: [
        { name: "Identity", status: "CHECKED" as const, details: "NPPES Registry match confirmed." },
        { name: "Sanctions", status: "CHECKED" as const, details: "OIG/LEIE clear." },
        { name: "Federal Exclusions", status: "CHECKED" as const, details: "SAM.gov clear. No active exclusions." },
        { name: "State Board", status: "CHECKED" as const, details: "NY Medical Board license active and in good standing." },
        { name: "Board Certification", status: "CHECKED" as const, details: "ABMS certification verified." },
        { name: "DEA Registration", status: "CHECKED" as const, details: "DEA registration active." }
      ],
    },
    {
      clinicianName: "Dr. Emily Davis, MD",
      npi: "9876543210",
      specialty: "Cardiology",
      status: "BLOCKED" as const,
      submissionDate: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
      timeToStart: "TBD",
      synthesis: {
        verifiedCredentials: "NPPES Identity confirmed.",
        identifiedGaps: "State license expired. Requires manual intervention.",
        timeline: "Blocked until license renewal is verified.",
      },
      sources: [
        { name: "Identity", status: "CHECKED" as const, details: "NPPES Registry match confirmed." },
        { name: "Licensure", status: "ACCESS REQUIRED" as const, details: "License expired on 2025-12-31." },
        { name: "Federal Exclusions", status: "CHECKED" as const, details: "SAM.gov clear." },
        { name: "State Board", status: "ACCESS REQUIRED" as const, details: "TX Medical Board requires manual verification of expired status." },
        { name: "Board Certification", status: "CHECKED" as const, details: "ABMS certification verified." },
        { name: "DEA Registration", status: "ACCESS REQUIRED" as const, details: "Requires institutional access to verify." }
      ],
    }
  ];

  const [packets, setPackets] = useState<ClinicianPacket[]>(props.packets || defaultPackets);
  const [selectedNpis, setSelectedNpis] = useState<string[]>([]);
  const [expandedNpi, setExpandedNpi] = useState<string | null>(null);

  // Automated Background Checks Simulation
  useEffect(() => {
    const pendingPackets = packets.filter(p =>
      p.sources.some(s => s.status === "PENDING" && ["Sanctions", "Federal Exclusions", "NPDB"].includes(s.name))
    );

    if (pendingPackets.length === 0) return;

    const timer = setTimeout(() => {
      setPackets(prevPackets => prevPackets.map(packet => {
        const hasPendingChecks = packet.sources.some(s => s.status === "PENDING" && ["Sanctions", "Federal Exclusions", "NPDB"].includes(s.name));
        if (!hasPendingChecks) return packet;

        const updatedSources = packet.sources.map(source => {
          if (source.status === "PENDING" && ["Sanctions", "Federal Exclusions", "NPDB"].includes(source.name)) {
            return {
              ...source,
              status: "CHECKED" as const,
              details: source.name === "Sanctions" ? "OIG/LEIE Exclusion List: No matches found." :
                       source.name === "Federal Exclusions" ? "SAM.gov clear. No active exclusions." :
                       "NPDB: No adverse actions reported."
            };
          }
          return source;
        });

        // If all sources are now checked, we could potentially update the packet status
        const allChecked = updatedSources.every(s => s.status === "CHECKED");
        
        return {
          ...packet,
          sources: updatedSources,
          status: allChecked ? "READY" : packet.status
        };
      }));
    }, 3000); // Simulate network delay for background checks

    return () => clearTimeout(timer);
  }, [packets]);

  useEffect(() => {
    if (props.packets) {
      setPackets(props.packets);
    }
  }, [props.packets]);

  // Apply filters
  const filteredPackets = packets.filter(packet => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!packet.clinicianName.toLowerCase().includes(query) && !packet.npi.includes(query)) {
        return false;
      }
    }
    if (statusFilter !== "All" && packet.status !== statusFilter) return false;
    if (specialtyFilters.length > 0 && !specialtyFilters.includes(packet.specialty)) return false;

    if (dateRange !== "All") {
      const packetDate = new Date(packet.submissionDate).getTime();
      const now = Date.now();
      const daysDiff = (now - packetDate) / (1000 * 3600 * 24);

      if (dateRange === "Last 7 Days" && daysDiff > 7) return false;
      if (dateRange === "Last 30 Days" && daysDiff > 30) return false;
    }

    return true;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, specialtyFilters, dateRange]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPackets.length / ITEMS_PER_PAGE);
  const paginatedPackets = filteredPackets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSelection = (npi: string) => {
    setSelectedNpis(prev => prev.includes(npi) ? prev.filter(id => id !== npi) : [...prev, npi]);
  };

  const toggleSelectAll = () => {
    if (selectedNpis.length === filteredPackets.length && filteredPackets.length > 0) {
      setSelectedNpis([]);
    } else {
      setSelectedNpis(filteredPackets.map(p => p.npi));
    }
  };

  const handleBulkAction = (newStatus: ClinicianPacket["status"]) => {
    setPackets(prev => prev.map(p => selectedNpis.includes(p.npi) ? { ...p, status: newStatus } : p));
    setSelectedNpis([]);
  };

  const handleNoteChange = (npi: string, note: string) => {
    setPackets(prev => prev.map(p => p.npi === npi ? { ...p, internalNotes: note } : p));
  };

  const simulateNewSubmission = () => {
    const newNpi = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const newPacket: ClinicianPacket = {
      clinicianName: `Dr. New Applicant, MD`,
      npi: newNpi,
      specialty: "Family Medicine",
      status: "PARTIAL",
      submissionDate: new Date().toISOString(),
      timeToStart: "14 Days",
      synthesis: {
        verifiedCredentials: "NPPES Identity confirmed.",
        identifiedGaps: "Background checks in progress.",
        timeline: "Awaiting automated background check results.",
      },
      sources: [
        { name: "Identity", status: "CHECKED", details: "NPPES Registry match confirmed." },
        { name: "Sanctions", status: "PENDING", details: "OIG/LEIE check in progress..." },
        { name: "Federal Exclusions", status: "PENDING", details: "SAM.gov check in progress..." },
        { name: "NPDB", status: "PENDING", details: "NPDB query submitted..." },
        { name: "State Board", status: "CHECKED", details: "State Medical Board license active." },
        { name: "Board Certification", status: "CHECKED", details: "ABMS certification verified." },
        { name: "DEA Registration", status: "ACCESS REQUIRED", details: "Requires institutional access to verify." }
      ]
    };
    setPackets(prev => [newPacket, ...prev]);
  };

  // Extract unique specialties for the filter dropdown
  const specialties = Array.from(new Set(packets.map(p => p.specialty)));

  // Render Single Packet View (Legacy)
  if (!isListMode) {
    const { clinicianName, npi, timeToStart, synthesis, sources } = props;
    const readinessBand = deriveReadinessBand(sources);
    const readinessTone = READINESS_TONE[readinessBand];
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-5xl mx-auto w-full space-y-10 pb-40"
      >
        {/* Top Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-line pb-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-ink text-bg px-2 py-0.5 rounded-full">
                Employer Review Mode
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                NPI: {npi}
              </span>
            </div>

            {/* Readiness banner + Warranty Shield row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div
                aria-label={`Readiness status: ${readinessBand}`}
                className={cn(
                  "inline-flex items-center gap-2 border border-line bg-ink/5 px-3 py-1.5",
                  "font-mono text-[10.5px] uppercase tracking-[0.18em]",
                  "ring-1 ring-inset",
                  readinessTone.ring,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    readinessTone.dot,
                  )}
                />
                <span className="text-ink/50">Readiness</span>
                <span className="text-ink/30" aria-hidden="true">:</span>
                <span className={cn("font-semibold", readinessTone.text)}>
                  {readinessBand}
                </span>
              </div>
              <TrustWarrantyShield />
            </div>

            <h2 className="text-5xl font-bold tracking-tighter">{clinicianName}</h2>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Est. Time-to-Start</div>
              <div className="text-5xl font-bold tracking-tighter text-green-600 dark:text-green-400 tabular-nums">{timeToStart}</div>
            </div>
            <button
              onClick={() => handleExport(props, npi || 'unknown')}
              className="p-4 border border-line hover:bg-ink/5 transition-colors flex items-center justify-center"
              aria-label="Export Packet Data"
              title="Export Packet Data"
            >
              <Download className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* AI Synthesis Section */}
        <div className="border border-line p-8 bg-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-ink/20" />
          <div className="flex items-center gap-2 mb-8 opacity-40">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">MSP Auditor Synthesis</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40">01. Verified Credentials</h4>
              <p className="font-mono text-xs leading-relaxed opacity-80">{synthesis?.verifiedCredentials}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40">02. Identified Gaps</h4>
              <p className="font-mono text-xs leading-relaxed opacity-80">{synthesis?.identifiedGaps}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40">03. Timeline</h4>
              <p className="font-mono text-xs leading-relaxed opacity-80">{synthesis?.timeline}</p>
            </div>
          </div>
        </div>

        {/* Velocity + Actuarial Metrics — the math that underwrites */}
        <ActuarialRiskPanel
          estimatedStart={timeToStart || "—"}
          riskStatus={
            readinessBand === "REVIEW REQUIRED"
              ? "OUT OF SCOPE"
              : "ACCEPTABLE FOR UNDERWRITING"
          }
        />

        {/* Evidence Table — source grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
              Evidence · Primary Source Verification
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
              {sources?.length ?? 0} lanes
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sources?.map((source, index) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index, duration: 0.4 }}
                className="border border-line p-5 bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{source.name}</span>
                  {source.status === "CHECKED" ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : source.status === "PENDING" ? (
                    <Clock className="w-3 h-3 text-amber-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                </div>
                <div className={cn(
                  "font-mono text-xs font-bold mb-2",
                  source.status === "CHECKED" ? "text-green-500" :
                  source.status === "PENDING" ? "text-amber-500" : "text-red-500"
                )}>
                  {source.status}
                </div>
                <p className="text-[10px] opacity-50 leading-tight line-clamp-2">{source.details}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Warranty & Indemnity Coverage — collapsible legal ledger */}
        <WarrantyCoverageMatrix />

        {/* Fixed Action Bar — Accept & Transfer Risk */}
        <div className="fixed bottom-0 left-0 right-0 bg-bg/90 backdrop-blur-md border-t border-line z-50">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/45">
                {'// Decision'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
                Primary source defect liability is officially transferred to the VitalCV Trust Warranty under Pilot Terms.
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              {/* Primary — Accept & Transfer Risk */}
              <button
                type="button"
                className={cn(
                  "group relative flex flex-col items-start text-left",
                  "bg-ink text-bg hover:bg-ink/90 transition-colors",
                  "px-5 py-3 border border-ink",
                  "ring-offset-2 ring-offset-[var(--color-bg)] focus-visible:ring-2 focus-visible:ring-ink",
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-[0.16em] text-[13px]">
                    Accept &amp; Transfer Risk
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
                <span className="mt-1 text-[10.5px] leading-snug text-bg/70 font-mono">
                  Proceed with onboarding. Primary source defect liability is
                  officially transferred to the VitalCV Trust Warranty under
                  Pilot Terms.
                </span>
              </button>

              {/* Refresh */}
              <button
                type="button"
                className={cn(
                  "group flex flex-col items-start text-left",
                  "border border-line bg-transparent text-ink hover:bg-ink/5 transition-colors",
                  "px-4 py-3",
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-[0.16em] text-[12px]">
                    Request Refresh
                  </span>
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
                <span className="mt-1 text-[10px] leading-snug text-ink/55 font-mono">
                  Re-run stale lanes · no decision recorded.
                </span>
              </button>

              {/* Route to Manual Review */}
              <button
                type="button"
                className={cn(
                  "group flex flex-col items-start text-left",
                  "border border-rose-500/30 bg-transparent text-rose-500 hover:bg-rose-500/5 transition-colors",
                  "px-4 py-3",
                )}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-[0.16em] text-[12px]">
                    Manual Review
                  </span>
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <span className="mt-1 text-[10px] leading-snug text-rose-500/70 font-mono">
                  Escalate to committee · warranty suspended.
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Render List View with Filters
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="max-w-5xl mx-auto w-full space-y-8 pb-32"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-line pb-8">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter uppercase">Clinician Packets</h2>
          <p className="text-sm opacity-60 font-mono mt-2">Review and manage incoming readiness snapshots.</p>
        </div>
        <button
          onClick={simulateNewSubmission}
          className="bg-ink text-bg px-6 py-3 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:opacity-90 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Simulate New Submission
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search clinicians by name or NPI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border border-line py-3 pl-11 pr-4 text-sm font-mono focus:outline-none focus:border-ink transition-colors"
          aria-label="Search clinicians"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 p-4 border border-line bg-ink/5 items-start md:items-center">
        <div className="flex items-center justify-between w-full md:w-auto md:mr-4">
          <div className="flex items-center gap-2 opacity-60">
            <Filter className="w-4 h-4" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="md:hidden text-[10px] font-bold uppercase tracking-widest text-ink/60 hover:text-ink transition-colors"
              aria-label="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="status-filter" className="text-[9px] font-bold uppercase tracking-widest opacity-40">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-b border-line py-2 text-xs font-mono focus:outline-none focus:border-ink transition-colors"
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              <option value="PARTIAL">Pending</option>
              <option value="READY">Ready</option>
              <option value="BLOCKED">Needs Review</option>
            </select>
          </div>

          {/* Specialty Filter (Multi-Select) */}
          <div className="flex flex-col gap-1 relative" ref={specialtyDropdownRef}>
            <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">Specialties</label>
            <button
              onClick={() => setIsSpecialtyDropdownOpen(!isSpecialtyDropdownOpen)}
              className="flex items-center justify-between w-full bg-transparent border-b border-line py-2 text-xs font-mono focus:outline-none focus:border-ink transition-colors text-left"
              aria-label="Filter by specialties"
            >
              <span className="truncate pr-4">
                {specialtyFilters.length === 0
                  ? "All Specialties"
                  : `${specialtyFilters.length} Selected`}
              </span>
              <ChevronDown className="w-3 h-3 opacity-40 flex-shrink-0" />
            </button>

            {isSpecialtyDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg)] border border-line shadow-xl z-50 max-h-60 overflow-y-auto">
                <div
                  className="px-3 py-2 text-xs font-mono cursor-pointer hover:bg-ink/5 flex items-center gap-2"
                  onClick={() => setSpecialtyFilters([])}
                >
                  <div className="w-3 h-3 border border-line flex items-center justify-center">
                    {specialtyFilters.length === 0 && <Check className="w-2 h-2" />}
                  </div>
                  All Specialties
                </div>
                {specialties.map(spec => (
                  <div
                    key={spec}
                    className="px-3 py-2 text-xs font-mono cursor-pointer hover:bg-ink/5 flex items-center gap-2"
                    onClick={() => {
                      if (specialtyFilters.includes(spec)) {
                        setSpecialtyFilters(specialtyFilters.filter(s => s !== spec));
                      } else {
                        setSpecialtyFilters([...specialtyFilters, spec]);
                      }
                    }}
                  >
                    <div className="w-3 h-3 border border-line flex items-center justify-center">
                      {specialtyFilters.includes(spec) && <Check className="w-2 h-2" />}
                    </div>
                    {spec}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="date-range-filter" className="text-[9px] font-bold uppercase tracking-widest opacity-40">Date Range</label>
            <div className="relative">
              <select
                id="date-range-filter"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full bg-transparent border-b border-line py-2 pl-6 text-xs font-mono focus:outline-none focus:border-ink transition-colors appearance-none"
                aria-label="Filter by date range"
              >
                <option value="All">All Time</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
              </select>
              <Calendar className="w-3 h-3 absolute left-0 top-1/2 -translate-y-1/2 opacity-40" aria-hidden="true" />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="hidden md:block text-[10px] font-bold uppercase tracking-widest text-ink/60 hover:text-ink transition-colors whitespace-nowrap ml-4"
            aria-label="Clear all filters"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Bulk Actions & Select All */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-ink/5 p-4 border border-line gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={filteredPackets.length > 0 && selectedNpis.length === filteredPackets.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-ink cursor-pointer"
            aria-label="Select all packets"
          />
          <span className="text-xs font-bold uppercase tracking-widest opacity-60">
            {selectedNpis.length > 0 ? `${selectedNpis.length} Selected` : "Select All"}
          </span>
        </div>

        {selectedNpis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-wrap items-center gap-3"
          >
            <button
              onClick={() => handleBulkAction("READY")}
              className="px-4 py-2 bg-green-600/10 text-green-600 dark:text-green-400 hover:bg-green-600/20 border border-green-500/30 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-3 h-3" /> Mark as Ready
            </button>
            <button 
              onClick={() => handleBulkAction("BLOCKED")}
              className="px-4 py-2 bg-red-600/10 text-red-600 dark:text-red-400 hover:bg-red-600/20 border border-red-500/30 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <ShieldAlert className="w-3 h-3" /> Route for Manual Review
            </button>
          </motion.div>
        )}
      </div>

      {/* Packet List */}
      <div className="space-y-4">
        {filteredPackets.length === 0 ? (
          <div className="p-12 text-center border border-line border-dashed opacity-40">
            <p className="text-xs font-mono uppercase">No packets match the current filters.</p>
          </div>
        ) : (
          paginatedPackets.map((packet) => (
            <motion.div
              key={packet.npi}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-line p-6 hover:bg-ink/5 transition-colors group cursor-pointer"
              onClick={() => setExpandedNpi(expandedNpi === packet.npi ? null : packet.npi)}
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="pt-1.5">
                    <input
                      type="checkbox"
                      checked={selectedNpis.includes(packet.npi)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(packet.npi);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-ink cursor-pointer"
                      aria-label={`Select ${packet.clinicianName}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold tracking-tight">{packet.clinicianName}</h3>
                    <span className={cn(
                      "flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      packet.status === "READY" ? "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10" :
                      packet.status === "PARTIAL" ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10" :
                      "border-red-500 text-red-600 dark:text-red-400 bg-red-500/10"
                    )}>
                      {packet.status === "READY" && <CheckCircle2 className="w-3 h-3" />}
                      {packet.status === "PARTIAL" && <Clock className="w-3 h-3" />}
                      {packet.status === "BLOCKED" && <AlertCircle className="w-3 h-3" />}
                      {packet.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono opacity-60">
                    <span>NPI: {packet.npi}</span>
                    <span>•</span>
                    <span>{packet.specialty}</span>
                    <span>•</span>
                    <span>Submitted: {new Date(packet.submissionDate).toLocaleDateString()}</span>
                  </div>
                </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-1">Est. Start</div>
                    <div className="text-lg font-bold font-mono">{packet.timeToStart}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(packet, packet.npi); }}
                      className="p-3 border border-line hover:bg-ink/5 transition-colors text-ink"
                      aria-label="Export Packet Data"
                      title="Export Packet Data"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      className="p-3 bg-ink text-bg hover:opacity-90 transition-opacity"
                      aria-label={expandedNpi === packet.npi ? "Collapse details" : "Expand details"}
                    >
                      <motion.div
                        animate={{ rotate: expandedNpi === packet.npi ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details View */}
              {expandedNpi === packet.npi && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-8 pt-8 border-t border-line space-y-8"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                  {/* AI Synthesis */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Verified Credentials
                      </h4>
                      <p className="font-mono text-xs leading-relaxed opacity-80">{packet.synthesis.verifiedCredentials}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" /> Identified Gaps
                      </h4>
                      <p className="font-mono text-xs leading-relaxed opacity-80">{packet.synthesis.identifiedGaps}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Timeline
                      </h4>
                      <p className="font-mono text-xs leading-relaxed opacity-80">{packet.synthesis.timeline}</p>
                    </div>
                  </div>

                  {/* Internal Notes */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Internal Notes
                    </h4>
                    <textarea
                      value={packet.internalNotes || ""}
                      onChange={(e) => handleNoteChange(packet.npi, e.target.value)}
                      placeholder="Add internal notes about this clinician..."
                      className="w-full h-24 bg-transparent border border-line p-3 text-sm font-mono focus:outline-none focus:border-ink transition-colors resize-none"
                      aria-label={`Internal notes for ${packet.clinicianName}`}
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line pt-6 mt-8">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredPackets.length)} of {filteredPackets.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-line hover:bg-ink/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-mono px-4">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border border-line hover:bg-ink/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default EmployerReviewDashboard;
