import { JsonToggle } from './JsonToggle';

type ArtifactResult = {
  success: boolean;
  artifact: {
    schema_version: string;
    artifact_version: string;
    artifact_type: string;
    provider: {
      npi: string;
      first_name: string;
      last_name: string;
      [key: string]: unknown;
    };
    source: {
      system: string;
      endpoint: string;
      retrieved_at: string;
    };
    raw_capture: {
      payload_sha256: string;
      storage_ref: string;
    };
  };
  artifact_hash: string;
  signature: string | null;
  signing_available: boolean;
  source: 'live' | 'cached';
};

function truncate(value: string, len: number): string {
  if (value.length <= len) return value;
  return `${value.slice(0, len)}…`;
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-semibold text-foreground break-all ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function ArtifactCard({ data }: { data: ArtifactResult }) {
  const { artifact, artifact_hash, signature, signing_available, source } = data;

  return (
    <div className="rounded-lg border border-border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">
            Signed Identity Artifact
          </p>
          <p className="mt-1 text-sm text-muted">
            {artifact.provider.first_name} {artifact.provider.last_name} — NPI{' '}
            {artifact.provider.npi}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {source === 'cached' && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              cached
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              signing_available
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
            }`}
          >
            {signing_available ? 'ES256 Signed' : 'Unsigned'}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Detail
          label="Artifact hash"
          value={truncate(artifact_hash, 32)}
          mono
        />
        <Detail label="Schema" value={artifact.schema_version} />
        <Detail
          label="Payload SHA-256"
          value={truncate(artifact.raw_capture.payload_sha256, 32)}
          mono
        />
        <Detail label="Issuer" value="vitalcv" />
        <Detail label="Algorithm" value="ES256 (P-256)" />
        <Detail label="Retrieved at" value={artifact.source.retrieved_at} />
        {signature && (
          <Detail
            label="JWS signature"
            value={truncate(signature, 48)}
            mono
          />
        )}
        <Detail label="Source" value={artifact.source.system} />
      </dl>

      <JsonToggle data={data} label="full artifact JSON" />
    </div>
  );
}
