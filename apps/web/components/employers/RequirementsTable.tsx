/**
 * Wave 186 — Employer Knowledge Layer
 * RequirementsTable — credential requirement display component
 */

interface Requirement {
  label: string;
  level: string;
  note?: string;
}

const LEVEL_META: Record<string, { label: string; color: string; description: string }> = {
  L3: {
    label: 'L3',
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    description: 'Required — hard gate for employment',
  },
  L2: {
    label: 'L2',
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    description: 'Required — may be waived in limited cases',
  },
  L1: {
    label: 'L1',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    description: 'Preferred — strengthens candidacy',
  },
};

export default function RequirementsTable({ requirements }: { requirements: Requirement[] }) {
  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(LEVEL_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`px-1.5 py-0.5 rounded border text-xs ${meta.color}`}>{meta.label}</span>
            <span>{meta.description}</span>
          </div>
        ))}
      </div>

      {requirements.map((req, i) => {
        const meta = LEVEL_META[req.level] ?? LEVEL_META['L1'];
        return (
          <div key={i} className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 font-medium">{req.label}</p>
              {req.note && (
                <p className="text-xs text-white/40 mt-0.5">{req.note}</p>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded border text-xs flex-shrink-0 ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
