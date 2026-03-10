'use client';
import { cn } from '@/lib/utils';
import { Anchor, Database, FileText, Filter, Hexagon, Search, Shield, Terminal } from 'lucide-react';
import { useState } from 'react';
import { DataTable, type ColumnDef } from '../../../components/operator/DataTable';
import { TelemetryPanel } from '../../../components/operator/TelemetryPanel';
import { InspectorPanel } from '../../../components/ui/InspectorPanel';

const NAV_SECTIONS = [
  { key: 'network', label: 'Network Graph', icon: Hexagon },
  { key: 'credentials', label: 'Credentials', icon: Shield },
  { key: 'psv', label: 'PSV Adapters', icon: Search },
  { key: 'anchors', label: 'Trust Anchors', icon: Anchor },
  { key: 'audit', label: 'Audit Trail', icon: FileText },
];

const SAVED_VIEWS = ['All Providers', 'Pending Verification', 'Flagged for Review'];

const COLS: ColumnDef[] = [
  { key: 'id', label: 'UID', width: 80, render: (r) => <span className="font-mono text-white/40">{String(r.id).slice(0, 8)}</span> },
  { key: 'name', label: 'Subject Name', sortable: true, width: 200 },
  {
    key: 'status',
    label: 'Status',
    width: 100,
    sortable: true,
    render: (r) => (
      <span className={cn(
        "text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-sm",
        String(r.status) === 'ACTIVE' ? 'bg-vt-success/10 text-vt-success border border-vt-success/20' :
        String(r.status) === 'PENDING' ? 'bg-vt-warning/10 text-vt-warning border border-vt-warning/20' :
        'bg-vt-danger/10 text-vt-danger border border-vt-danger/20'
      )}>
        {String(r.status)}
      </span>
    )
  },
  { key: 'role', label: 'Role Type', width: 120, render: (r) => <span className="text-white/60">{String(r.role)}</span> },
  { key: 'updatedAt', label: 'Last Synced', width: 140, align: 'right', render: (r) => <span className="text-white/50">{String(r.updatedAt)}</span> },
  { key: 'riskScore', label: 'Risk', width: 80, sortable: true, align: 'right', render: (r) => <span className="font-mono">{String(r.riskScore)}</span> },
];

const MOCK_DATA = Array.from({ length: 45 }, (_, i) => ({
  id: `did:vcv:usr_${Math.random().toString(36).substr(2, 9)}`,
  name: `Provider ${Math.floor(Math.random() * 1000)}`,
  status: i % 7 === 0 ? 'FLAGGED' : i % 3 === 0 ? 'PENDING' : 'ACTIVE',
  role: ['RN', 'LCSW', 'RT(R)', 'MD', 'DO'][i % 5],
  updatedAt: new Date(Date.now() - Math.random() * 864000000).toISOString().replace('T', ' ').slice(0, 16),
  riskScore: (Math.random() * 100).toFixed(1),
  _raw: JSON.stringify({ metadata: { source: 'NPI Registry', lastRefreshed: Date.now() } })
}));

export default function MissionOpsV2Client() {
  const [section, setSection] = useState('credentials');
  const [activeView, setActiveView] = useState(SAVED_VIEWS[0]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');

  return (
    <div className="flex h-screen bg-[#050508] text-white overflow-hidden font-sans">

      {/* Sidebar Navigation */}
      <div className="w-[220px] flex-shrink-0 border-r border-white/5 bg-[#0a0a0f] flex flex-col">
        <div className="p-5 border-b border-white/5 shrink-0 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">VitalCV Base</div>
            <div className="text-sm font-medium tracking-tight">Mission Ops</div>
          </div>
          <Terminal className="w-4 h-4 text-white/20" />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-5 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Core Modules</div>
          <div className="px-2 space-y-0.5 mb-6">
            {NAV_SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = section === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => { setSection(s.key); setSelected(null); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all",
                    isActive ? "bg-vt-info/10 text-vt-info font-medium" : "text-white/50 hover:bg-white/[0.03] hover:text-white/80"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="px-5 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold flex items-center justify-between">
            Saved Views
            <Filter className="w-3 h-3" />
          </div>
          <div className="px-2 space-y-0.5">
            {SAVED_VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-1.5 text-xs rounded-md transition-all",
                  activeView === v ? "text-white bg-white/5" : "text-white/40 hover:text-white/70"
                )}
              >
                <Database className="w-3 h-3 shrink-0 opacity-50" />
                <span className="truncate">{v}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 text-[10px] text-white/20 font-mono tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
          SYSTEM ONLINE
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">

        {/* Top Header & Telemetry Row */}
        <div className="flex-shrink-0 border-b border-white/5 shrink-0">
          <div className="h-14 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">Mission Ops</span>
              <span className="text-white/20">/</span>
              <span className="text-white/90 text-sm font-medium capitalize">{section}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-vt-info transition-colors" />
                <input
                  type="text"
                  placeholder="Filter records (Cmd+F)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-white/[0.02] border border-white/10 rounded-md py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-vt-info/50 focus:ring-1 focus:ring-vt-info/50 w-64 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 grid grid-cols-4 gap-4 bg-[#050508]/50">
            <TelemetryPanel title="Active Nodes" value="2,481" trend={{ value: '+12%', positive: true }} />
            <TelemetryPanel title="Pending Reviews" value="142" trend={{ value: '-5%', positive: false }} />
            <TelemetryPanel title="Network Hashrate" value="14.2 TH/s" trend={{ value: 'Stable', positive: undefined }} />
            <TelemetryPanel title="System Alerts" value="0" trend={{ value: 'All Clear', positive: true }} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2 border-b border-white/5 flex items-center justify-between text-xs bg-white/[0.01]">
          <div className="flex items-center gap-4 text-white/50 font-medium">
            <span className="text-white">{MOCK_DATA.length} Records</span>
            <div className="h-3 w-px bg-white/10" />
            <button className="hover:text-white transition-colors">Export CSV</button>
            <button className="hover:text-white transition-colors">Bulk Actions</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/30">Layout:</span>
            <button className="px-2 py-0.5 rounded bg-white/10 text-white">Split</button>
            <button className="px-2 py-0.5 rounded hover:bg-white/5 text-white/50 transition-colors">Table</button>
          </div>
        </div>

        {/* Split Table / Inspector Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Table Area */}
          <div className={cn("flex-1 overflow-hidden transition-all duration-300", selected ? "mr-0" : "")}>
            <DataTable
              columns={COLS}
              data={MOCK_DATA.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.role.toLowerCase().includes(query.toLowerCase()))}
              onRowClick={setSelected}
              selectedRow={selected}
              className="border-none bg-transparent"
            />
          </div>

          {/* Inline Inspector Area */}
          {selected && (
            <div className="w-[400px] flex-shrink-0 border-l border-white/5 bg-[#08080c] flex flex-col transform transition-transform duration-300 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0 bg-[#0f1115]">
                <h3 className="text-xs font-semibold text-white">Record Details</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/30 hover:text-white/70 p-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <InspectorPanel
                  title="Subject Information"
                  badge={{
                    text: String(selected.status),
                    color: String(selected.status) === 'ACTIVE' ? '#22c55e' : String(selected.status) === 'PENDING' ? '#f59e0b' : '#ef4444'
                  }}
                  items={[
                    { label: 'UID', value: selected.id, mono: true, copy: true, colSpan: 2 },
                    { label: 'Full Name', value: selected.name, copy: true, colSpan: 2 },
                    { label: 'Role', value: selected.role },
                    { label: 'Risk Score', value: selected.riskScore, mono: true },
                    { label: 'Last Synced', value: String(selected.updatedAt) },
                    { label: 'Source', value: 'Primary PSV Net' },
                    { label: 'Raw Payload', value: selected._raw, mono: true, colSpan: 2, copy: true },
                  ]}
                  className="bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
