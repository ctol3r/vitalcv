/**
 * EvidenceBundlePreview — static representation of a verification artifact.
 *
 * Renders a structured key-value grid showing every field in an evidence
 * bundle. Designed to look like structured data (JSON-adjacent) so the
 * technical buyer immediately understands the artifact shape.
 */

const credentials = [
  { field: 'License', value: 'MD-123456', source: 'CA Medical Board', status: 'Source-verified' },
  { field: 'Board Cert', value: 'Internal Medicine', source: 'ABIM', status: 'Source-verified' },
  { field: 'NPI', value: '1234567890', source: 'NPPES', status: 'Active' },
  { field: 'OIG', value: 'No exclusions', source: 'OIG LEIE', status: 'Clear' },
  { field: 'SAM', value: 'No exclusions', source: 'SAM.gov', status: 'Clear' },
];

const metadata = [
  { label: 'Timestamp', value: '2026-02-14T12:00:00Z' },
  { label: 'Source', value: 'VitalCV Evidence Service v1' },
  { label: 'Signature', value: 'ES256 · sha256:a1b2c3d4e5f6…' },
];

export function EvidenceBundlePreview() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Evidence bundle
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Every verification, one artifact.
        </p>
        <p className="mt-4 max-w-xl text-base text-muted">
          A signed, timestamped record of every credential check — license,
          board certification, NPI status, OIG exclusion, SAM exclusion — with
          source attribution and cryptographic proof of integrity.
        </p>

        {/* ── Credential table ── */}
        <div className="mt-12 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-4 gap-px bg-border text-sm">
            {/* Header */}
            <div className="bg-surface px-4 py-3 font-medium text-foreground">
              Credential
            </div>
            <div className="bg-surface px-4 py-3 font-medium text-foreground">
              Value
            </div>
            <div className="bg-surface px-4 py-3 font-medium text-foreground">
              Source
            </div>
            <div className="bg-surface px-4 py-3 font-medium text-foreground">
              Status
            </div>

            {/* Rows */}
            {credentials.map((row) => (
              <>
                <div
                  key={`${row.field}-field`}
                  className="bg-background px-4 py-3 text-muted"
                >
                  {row.field}
                </div>
                <div
                  key={`${row.field}-value`}
                  className="bg-background px-4 py-3 font-mono text-foreground"
                >
                  {row.value}
                </div>
                <div
                  key={`${row.field}-source`}
                  className="bg-background px-4 py-3 text-muted"
                >
                  {row.source}
                </div>
                <div
                  key={`${row.field}-status`}
                  className="bg-background px-4 py-3 text-foreground"
                >
                  {row.status}
                </div>
              </>
            ))}
          </div>
        </div>

        {/* ── Metadata footer ── */}
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {metadata.map((item) => (
            <div key={item.label} className="bg-background px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                {item.label}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
