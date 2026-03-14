import { VerificationBadge, VerificationLevel } from './VerificationBadge';
import { CredentialStatusCard } from './CredentialStatusCard';

interface PassportData {
  clinician: {
    name: string;
    specialty: string;
    npi: string;
  };
  overallStatus: VerificationLevel;
  credentials: {
    license: { status: VerificationLevel; value: string; issuer: string; updatedAt: string };
    board: { status: VerificationLevel; value: string; issuer: string; updatedAt: string };
    dea: { status: VerificationLevel; value: string; issuer: string; updatedAt: string };
    sanctions: { status: VerificationLevel; issuesFound: number; lastChecked: string };
  };
}

export function CredentialPassportLayout({ data }: { data: PassportData }) {
  return (
    <div className="w-full max-w-6xl mx-auto py-16 px-6 sm:px-12 space-y-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-12 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-4">
          <p className="font-mono text-xs text-slate-500 dark:text-vt-neutral-400 uppercase tracking-[0.2em]">Credential Passport</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 dark:text-vt-neutral-50">{data.clinician.name}</h1>
          <div className="flex items-center gap-6 text-slate-500 dark:text-vt-neutral-400 text-lg">
            <span className="font-medium text-slate-700 dark:text-vt-neutral-300">{data.clinician.specialty}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="font-mono bg-slate-100 dark:bg-vt-neutral-800 px-3 py-1 rounded-md">NPI {data.clinician.npi}</span>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3 bg-white dark:bg-vt-neutral-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-vt-neutral-400">Readiness State</span>
          <VerificationBadge level={data.overallStatus} className="scale-110 origin-left md:origin-right" />
        </div>
      </header>

      {/* Credential Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CredentialStatusCard 
          title="State Medical License"
          level={data.credentials.license.status}
          value={data.credentials.license.value}
          issuer={data.credentials.license.issuer}
          updatedAt={data.credentials.license.updatedAt}
        />
        
        <CredentialStatusCard 
          title="Board Certification"
          level={data.credentials.board.status}
          value={data.credentials.board.value}
          issuer={data.credentials.board.issuer}
          updatedAt={data.credentials.board.updatedAt}
        />
        
        <CredentialStatusCard 
          title="DEA Registration"
          level={data.credentials.dea.status}
          value={data.credentials.dea.value}
          issuer={data.credentials.dea.issuer}
          updatedAt={data.credentials.dea.updatedAt}
        />

        <CredentialStatusCard 
          title="Sanctions & Disciplinary"
          level={data.credentials.sanctions.status}
          updatedAt={data.credentials.sanctions.lastChecked}
        >
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-light ${data.credentials.sanctions.issuesFound > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {data.credentials.sanctions.issuesFound}
            </span>
            <span className="text-slate-500 dark:text-vt-neutral-400 font-medium">issues detected</span>
          </div>
        </CredentialStatusCard>
      </div>
    </div>
  );
}
