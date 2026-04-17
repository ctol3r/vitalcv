'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity,
  Anchor,
  Database,
  FileText,
  Filter,
  Hexagon,
  Search,
  Shield,
  Terminal,
} from 'lucide-react';
import { SourceOpsPanel } from '../../../components/mission-ops/SourceOpsPanel';
import { DataTable, type ColumnDef } from '../../../components/operator/DataTable';
import { TelemetryPanel } from '../../../components/operator/TelemetryPanel';
import { InspectorPanel } from '../../../components/ui/InspectorPanel';

const NAV_SECTIONS = [
  { key: 'source-ops', label: 'Source Health', icon: Activity },
  { key: 'network', label: 'Network Graph', icon: Hexagon },
  { key: 'credentials', label: 'Credentials', icon: Shield },
  { key: 'psv', label: 'PSV Adapters', icon: Search },
  { key: 'anchors', label: 'Trust Anchors', icon: Anchor },
  { key: 'audit', label: 'Audit Trail', icon: FileText },
] as const;

const SAVED_VIEWS = ['All Providers', 'Pending Verification', 'Flagged for Review'] as const;
const LIVE_SECTION_KEY = 'source-ops';
const SAMPLE_NOTICE =
  'Legacy sample workbench. Only Source Health is wired to live source truth in this shell.';

type MissionOpsSection = (typeof NAV_SECTIONS)[number]['key'];
type MissionOpsRecord = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PENDING' | 'FLAGGED';
  role: 'RN' | 'LCSW' | 'RT(R)' | 'MD' | 'DO';
  updatedAt: string;
  riskScore: string;
  _raw: string;
};

const STATUS_BADGE_CLASSES: Record<MissionOpsRecord['status'], string> = {
  ACTIVE: 'bg-vt-success/10 text-vt-success border border-vt-success/20',
  PENDING: 'bg-vt-warning/10 text-vt-warning border border-vt-warning/20',
  FLAGGED: 'bg-vt-danger/10 text-vt-danger border border-vt-danger/20',
};

const STATUS_BADGE_COLORS: Record<MissionOpsRecord['status'], string> = {
  ACTIVE: '#22c55e',
  PENDING: '#f59e0b',
  FLAGGED: '#ef4444',
};

const ROLE_SEQUENCE: MissionOpsRecord['role'][] = ['RN', 'LCSW', 'RT(R)', 'MD', 'DO'];
const STATUS_SEQUENCE: MissionOpsRecord['status'][] = ['FLAGGED', 'ACTIVE', 'ACTIVE', 'PENDING', 'ACTIVE'];

const SAMPLE_RECORDS: MissionOpsRecord[] = Array.from({ length: 45 }, (_, index) => {
  const sampleDate = new Date(Date.UTC(2026, 2, 23, 16, 0, 0) - index * 21_600_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16);

  return {
    id: `sample-provider-${String(index + 1).padStart(3, '0')}`,
    name: `Provider ${String(100 + index).padStart(3, '0')}`,
    status: STATUS_SEQUENCE[index % STATUS_SEQUENCE.length],
    role: ROLE_SEQUENCE[index % ROLE_SEQUENCE.length],
    updatedAt: sampleDate,
    riskScore: (35 + (index % 12) * 4.5).toFixed(1),
    _raw: JSON.stringify({
      metadata: {
        source: 'Sample Mission Ops dataset',
        generatedAt: '2026-03-23T16:00:00.000Z',
        recordIndex: index + 1,
      },
    }),
  };
});

function matchesQuery(record: MissionOpsRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    record.name.toLowerCase().includes(normalizedQuery)
    || record.role.toLowerCase().includes(normalizedQuery)
    || record.status.toLowerCase().includes(normalizedQuery)
  );
}

function readStatusBadgeClass(status: MissionOpsRecord['status']): string {
  return STATUS_BADGE_CLASSES[status];
}

const COLS: ColumnDef<MissionOpsRecord>[] = [
  {
    key: 'id',
    label: 'UID',
    width: 80,
    render: (row) => <span className="font-mono text-muted-foreground">{row.id.slice(-8)}</span>,
  },
  { key: 'name', label: 'Subject Name', sortable: true, width: 200 },
  {
    key: 'status',
    label: 'Status',
    width: 140,
    sortable: true,
    render: (row) => (
      <span
        className={cn(
          'rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
          readStatusBadgeClass(row.status),
        )}
      >
        {row.status}
      </span>
    ),
  },
  {
    key: 'role',
    label: 'Role Type',
    width: 120,
    render: (row) => <span className="text-foreground">{row.role}</span>,
  },
  {
    key: 'updatedAt',
    label: 'Last Synced',
    width: 140,
    align: 'right',
    render: (row) => <span className="text-foreground/70">{row.updatedAt}</span>,
  },
  {
    key: 'riskScore',
    label: 'Risk',
    width: 80,
    sortable: true,
    align: 'right',
    render: (row) => <span className="font-mono">{row.riskScore}</span>,
  },
];

export default function MissionOpsV2Client() {
  const [section, setSection] = useState<MissionOpsSection>(LIVE_SECTION_KEY);
  const [activeView, setActiveView] = useState<(typeof SAVED_VIEWS)[number]>(SAVED_VIEWS[0]);
  const [selected, setSelected] = useState<MissionOpsRecord | null>(null);
  const [query, setQuery] = useState('');

  const isLiveSection = section === LIVE_SECTION_KEY;
  const filteredRecords = SAMPLE_RECORDS.filter((record) => matchesQuery(record, query));
  const activeSectionLabel = NAV_SECTIONS.find((item) => item.key === section)?.label ?? section;

  return (
    <div className="flex h-screen overflow-hidden bg-[#050508] font-sans text-foreground">
      <div className="flex w-[220px] flex-shrink-0 flex-col border-r border-white/5 bg-[#0a0a0f]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 p-5">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              VitalCV Base
            </div>
            <div className="text-sm font-medium tracking-tight">Mission Ops</div>
          </div>
          <Terminal className="h-4 w-4 text-muted-foreground/40" />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Core Modules
          </div>
          <div className="mb-6 space-y-0.5 px-2">
            {NAV_SECTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSection(item.key);
                    setSelected(null);
                  }}
                  aria-pressed={isActive}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs transition-all',
                    isActive
                      ? 'bg-vt-info/10 font-medium text-vt-info'
                      : 'text-foreground/70 hover:bg-white/[0.03] hover:text-foreground/80',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-center justify-between px-5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Saved Views
            <Filter className="h-3 w-3" />
          </div>
          <div className="space-y-0.5 px-2">
            {SAVED_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                aria-pressed={activeView === view}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-xs transition-all',
                  activeView === view ? 'bg-muted text-white' : 'text-muted-foreground hover:text-foreground/70',
                )}
              >
                <Database className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{view}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/5 p-4 font-mono text-[10px] tracking-widest text-muted-foreground/40">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500/50 motion-safe:animate-pulse" />
          SYSTEM ONLINE
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#0a0a0f]">
        <div className="flex-shrink-0 border-b border-white/5">
          <div className="flex h-14 items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mission Ops</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm font-medium text-foreground">{activeSectionLabel}</span>
            </div>

            {isLiveSection ? (
              <div className="rounded-md border border-vt-info/20 bg-vt-info/5 px-3 py-1.5 text-[11px] text-vt-info/90">
                Live route: <span className="font-mono text-vt-info">/api/internal/mission-ops/sources</span>
              </div>
            ) : (
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-vt-info" />
                <input
                  type="text"
                  aria-label="Filter sample mission ops records"
                  placeholder="Filter sample records…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-64 rounded-md border border-border bg-white/[0.02] py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-vt-info/50 focus:outline-none focus:ring-1 focus:ring-vt-info/50"
                />
              </div>
            )}
          </div>

          {!isLiveSection && (
            <>
              <div className="grid grid-cols-4 gap-4 bg-[#050508]/50 px-6 py-4">
                <TelemetryPanel title="Active Nodes" value="2,481" trend={{ value: '+12%', positive: true }} />
                <TelemetryPanel title="Pending Reviews" value="142" trend={{ value: '-5%', positive: false }} />
                <TelemetryPanel title="Network Hashrate" value="14.2 TH/s" trend={{ value: 'Stable', positive: undefined }} />
                <TelemetryPanel title="System Alerts" value="0" trend={{ value: 'All Clear', positive: true }} />
              </div>
              <div className="border-t border-amber-400/10 bg-amber-400/5 px-6 py-3 text-xs text-amber-100/75">
                <span className="mr-2 font-semibold uppercase tracking-[0.16em] text-amber-300">Sample view</span>
                {SAMPLE_NOTICE}
              </div>
            </>
          )}
        </div>

        {!isLiveSection && (
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.01] px-6 py-2 text-xs">
            <div className="flex items-center gap-4 font-medium text-foreground/70">
              <span className="text-white">{filteredRecords.length} Sample Records</span>
              <div className="h-3 w-px bg-muted" />
              <span className="text-amber-200/60">Read-only preview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60">Layout:</span>
              <span className="rounded bg-muted px-2 py-0.5 text-foreground">Split</span>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isLiveSection ? (
            <SourceOpsPanel />
          ) : (
            <>
              <div className="flex-1 overflow-hidden">
                <DataTable
                  columns={COLS}
                  data={filteredRecords}
                  onRowClick={setSelected}
                  selectedRow={selected}
                  className="border-none bg-transparent"
                />
              </div>

              {selected && (
                <div className="flex w-[400px] flex-shrink-0 flex-col border-l border-white/5 bg-[#08080c] shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#0f1115] px-4 py-3">
                    <h3 className="text-xs font-semibold text-foreground">Record Details</h3>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label="Close record details"
                      className="p-1 text-muted-foreground/60 transition hover:text-foreground/70"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <InspectorPanel
                      title="Subject Information"
                      badge={{
                        text: selected.status,
                        color: STATUS_BADGE_COLORS[selected.status],
                      }}
                      items={[
                        { label: 'UID', value: selected.id, mono: true, copy: true, colSpan: 2 },
                        { label: 'Full Name', value: selected.name, copy: true, colSpan: 2 },
                        { label: 'Role', value: selected.role },
                        { label: 'Risk Score', value: selected.riskScore, mono: true },
                        { label: 'Last Synced', value: selected.updatedAt },
                        { label: 'Source', value: 'Sample Mission Ops dataset' },
                        { label: 'Raw Payload', value: selected._raw, mono: true, colSpan: 2, copy: true },
                      ]}
                      className="bg-transparent"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
