import { JsonToggle } from './JsonToggle';

type Provider = {
  npi: string;
  enumeration_type: string;
  status: string;
  first_name: string;
  last_name: string;
  primary_taxonomy: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">
        {value || '—'}
      </dd>
    </div>
  );
}

export function ProviderCard({
  provider,
  source,
}: {
  provider: Provider;
  source: 'live' | 'cached';
}) {
  const fullName = `${provider.first_name} ${provider.last_name}`.trim();

  return (
    <div className="rounded-lg border border-border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">{fullName}</p>
          <p className="mt-1 text-sm text-muted">NPI {provider.npi}</p>
        </div>
        <div className="flex items-center gap-2">
          {source === 'cached' && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              cached
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              provider.status === 'A'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {provider.status === 'A' ? 'Active' : provider.status}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Enumeration type" value={provider.enumeration_type} />
        <Field label="Specialty" value={provider.primary_taxonomy} />
        <Field label="Status" value={provider.status === 'A' ? 'Active' : provider.status} />
      </dl>

      <JsonToggle data={provider} label="provider JSON" />
    </div>
  );
}
