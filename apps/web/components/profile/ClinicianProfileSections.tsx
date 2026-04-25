import * as React from 'react';
import type { ProfileField } from '@/lib/profile/provenance';

export interface ClinicianProfileData {
  identity: ProfileField<string>;
  contact: ProfileField<string>;
  locations: ProfileField<string[]>;
  medicalSchool: ProfileField<string>;
  residency: ProfileField<string>;
  fellowship: ProfileField<string>;
  specialty: ProfileField<string>;
  subspecialty: ProfileField<string>;
  boardCertifications: ProfileField<string[]>;
  licenses: ProfileField<string[]>;
  workHistory: ProfileField<string[]>;
  affiliations: ProfileField<string[]>;
  research: ProfileField<string[]>;
  publications: ProfileField<string[]>;
  documents: ProfileField<string[]>;
  careerGoals: ProfileField<string>;
}

const PROVENANCE_COLORS: Record<ProfileField<any>['provenance'], { bg: string; text: string }> = {
  VERIFIED: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  USER_ENTERED: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  INFERRED: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  UNKNOWN: { bg: 'bg-muted', text: 'text-muted-foreground' },
  CONFLICT: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
};

function ProvenanceBadge({ field }: { field: ProfileField<any> }) {
  const colors = PROVENANCE_COLORS[field.provenance];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
      {field.provenance}
    </span>
  );
}

function Section({ title, field, render }: { title: string; field: ProfileField<any>; render: (val: any) => React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        <ProvenanceBadge field={field} />
      </div>
      <div className="text-sm text-foreground/90">
        {field.provenance === 'UNKNOWN' ? (
          <span className="text-muted-foreground italic">No data available</span>
        ) : (
          render(field.value)
        )}
      </div>
      {field.limitationNote && (
        <div className="text-[11px] text-amber-500/80 italic mt-2 border-t border-border/50 pt-2">
          Note: {field.limitationNote}
        </div>
      )}
    </div>
  );
}

export function ClinicianProfileSections({ data }: { data: ClinicianProfileData }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Section title="Identity" field={data.identity} render={v => String(v)} />
        <Section title="Contact" field={data.contact} render={v => String(v)} />
        <Section title="Specialty" field={data.specialty} render={v => String(v)} />
        <Section title="Medical School" field={data.medicalSchool} render={v => String(v)} />
        <Section title="Residency" field={data.residency} render={v => String(v)} />
        <Section title="Fellowship" field={data.fellowship} render={v => String(v)} />
      </div>
    </div>
  );
}
