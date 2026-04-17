import { notFound } from "next/navigation";

type ComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  crossCheckEligible: boolean;
  auditSnapshotSupported: boolean;
  trustLedgerAppendOnly: boolean;
};

type SecurityPosture = {
  rateLimiting: boolean;
  inputValidation: boolean;
  enumLocked: boolean;
  internalRouteProtection: boolean;
  startupEnvValidation: boolean;
};

type VersionResponse = {
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
  prismaVersion: string;
};

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || '';

function hasEnterpriseModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENTERPRISE_MODE ?? process.env.ENTERPRISE_MODE;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function fetchComplianceSummary(): Promise<ComplianceSummary | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/compliance/summary`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as ComplianceSummary;
  } catch {
    return null;
  }
}

async function fetchSecurityPosture(): Promise<SecurityPosture | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/security/posture`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as SecurityPosture;
  } catch {
    return null;
  }
}

async function fetchVersion(): Promise<VersionResponse | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/version`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as VersionResponse;
  } catch {
    return null;
  }
}

function formatFlag(value: boolean): string {
  return value ? 'enabled' : 'disabled';
}

export default async function EnterpriseSignalsPage() {
  if (!hasEnterpriseModeEnabled()) {
    notFound();
  }

  const [compliance, posture, version] = await Promise.all([
    fetchComplianceSummary(),
    fetchSecurityPosture(),
    fetchVersion(),
  ]);

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">enterprise diagnostics</p>
          <h1 className="text-3xl font-semibold">Enterprise Signals</h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <SignalCard
            title="Compliance summary"
            entries={[
              { label: 'NCQA alignment', value: compliance ? formatFlag(compliance.ncqaAlignment) : 'unknown' },
              {
                label: 'Monitoring enabled',
                value: compliance ? formatFlag(compliance.monitoringEnabled) : 'unknown',
              },
              {
                label: 'Cross-check eligible',
                value: compliance ? formatFlag(compliance.crossCheckEligible) : 'unknown',
              },
              {
                label: 'Audit snapshot supported',
                value: compliance ? formatFlag(compliance.auditSnapshotSupported) : 'unknown',
              },
            ]}
          />

          <SignalCard
            title="Security posture"
            entries={[
              { label: 'Rate limiting', value: posture ? formatFlag(posture.rateLimiting) : 'unknown' },
              {
                label: 'Input validation',
                value: posture ? formatFlag(posture.inputValidation) : 'unknown',
              },
              { label: 'Enum locked', value: posture ? formatFlag(posture.enumLocked) : 'unknown' },
              {
                label: 'Internal route protection',
                value: posture ? formatFlag(posture.internalRouteProtection) : 'unknown',
              },
              {
                label: 'Startup env validation',
                value: posture ? formatFlag(posture.startupEnvValidation) : 'unknown',
              },
            ]}
          />

          <SignalCard
            title="Audit trail integrity"
            entries={[
              {
                label: 'Append-only audit trail',
                value: compliance ? formatFlag(compliance.trustLedgerAppendOnly) : 'unknown',
              },
              {
                label: 'Version check',
                value: version ? `${version.buildVersion}/${version.commitHash}` : 'unknown',
              },
              {
                label: 'Node',
                value: version ? version.nodeVersion : 'unknown',
              },
              {
                label: 'Prisma',
                value: version ? version.prismaVersion : 'unknown',
              },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

function SignalCard({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="border border-border p-4">
      <h2 className="text-sm uppercase tracking-[0.15em] text-muted-foreground">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {entries.map((entry) => (
          <li className="flex justify-between gap-3" key={entry.label}>
            <span>{entry.label}</span>
            <span className="font-semibold text-muted-foreground">{entry.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
