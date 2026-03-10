'use client';
import React from 'react';
import { DataTable, type ColumnDef } from '../../../components/operator/DataTable';
import { InspectorPanel } from '../../../components/ui/InspectorPanel';

const NAV_SECTIONS = [
  { key: 'network', label: 'Network', icon: '⬡' },
  { key: 'credentials', label: 'Credentials', icon: '🔑' },
  { key: 'psv', label: 'PSV Adapters', icon: '🔍' },
  { key: 'anchors', label: 'Trust Anchors', icon: '⚓' },
  { key: 'audit', label: 'Audit', icon: '📋' },
];

const COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', width: 100, sortable: true, render: (r) => <span className={`text-xs px-2 py-0.5 rounded ${String(r.status) === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{String(r.status)}</span> },
  { key: 'type', label: 'Type', width: 120 },
  { key: 'updatedAt', label: 'Updated', width: 160 },
];

const MOCK_DATA = Array.from({ length: 12 }, (_, i) => ({ name: `Provider ${i + 1}`, status: i % 3 === 0 ? 'PENDING' : 'ACTIVE', type: ['RN', 'LCSW', 'RT(R)', 'MD'][i % 4], updatedAt: new Date(Date.now() - i * 86400000).toLocaleDateString() }));

export default function MissionOpsV2Client() {
  const [section, setSection] = React.useState('network');
  const [selected, setSelected] = React.useState<Record<string, unknown> | null>(null);

  return (
    <div className="flex h-screen bg-[#0a0a12] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-[200px] flex-shrink-0 border-r border-white/10 py-4">
        <div className="px-4 mb-4 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Mission Ops v2</div>
        {NAV_SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors ${section === s.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
          <span className="text-xs text-white/40">Mission Ops</span>
          <span className="text-white/20">›</span>
          <span className="text-xs text-white capitalize">{section}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DataTable columns={COLS} data={MOCK_DATA} onRowClick={setSelected} selectedRow={selected} />
        </div>
      </div>
      {/* Inspector */}
      {selected && (
        <div className="w-[320px] flex-shrink-0 border-l border-white/10 p-4 overflow-y-auto">
          <InspectorPanel title="Inspector" items={Object.entries(selected).map(([label, value]) => ({ label, value: String(value), mono: label.toLowerCase().includes('id') || label.toLowerCase().includes('hash'), copy: true }))} />
        </div>
      )}
    </div>
  );
}
