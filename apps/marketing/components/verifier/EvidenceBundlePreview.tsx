/**
 * EvidenceBundlePreview — illustrative representation of an evidence artifact.
 *
 * Renders a structured key-value grid showing the SHAPE of an evidence bundle
 * so a technical buyer understands the artifact. The data below is illustrative,
 * not a live verification, and lists only sources VitalCV actually integrates
 * (NPPES, state medical boards, OIG LEIE, CMS/PECOS enrollment). Sources VitalCV
 * does NOT integrate — SAM.gov, ABMS/ABIM board certification, NPDB, DEA — are
 * deliberately absent per doctrine.
 */

const credentials = [
  { field: 'Identity (NPI)', value: '1234567890', source: 'NPPES', status: 'Checked' },
  { field: 'License', value: 'MD-123456', source: 'CA Medical Board', status: 'Checked' },
  { field: 'Exclusions', value: 'No exclusions', source: 'OIG LEIE', status: 'Clear' },
  { field: 'Enrollment', value: 'Active', source: 'CMS / PECOS', status: 'Checked' },
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
          Evidence bundle <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">Illustrative</span>
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Every source check, one artifact.
        </p>
        <p className="mt-4 max-w-xl text-base text-muted">
          A signed, timestamped record of each source check — identity, license,
          exclusions, and CMS enrollment — with source attribution and a
          cryptographic proof of integrity. Coverage states are shown honestly;
          this preview is illustrative, not a live verification.
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
