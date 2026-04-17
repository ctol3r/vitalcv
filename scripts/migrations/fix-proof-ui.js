const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const limitationsCard = `
function LimitationsCard({ missing }: { missing?: any[] }) {
  if (!missing || missing.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden mt-8">
      <div className="px-5 py-4 border-b font-semibold bg-gray-50 text-gray-700">
        What We Did NOT Verify
      </div>
      <div className="p-5">
        <p className="text-sm text-muted-foreground mb-3">
          The following sources are excluded from this trust snapshot:
        </p>
        <ul className="space-y-2">
          {missing.map((m: any, i: number) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <span>
                <strong>{m.sourceId || m.dimension || 'Source'}</strong>: {m.reason || 'Not checked'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
`;

// Insert the LimitationsCard right before DecisionPostureCard
code = code.replace('function DecisionPostureCard', limitationsCard + '\nfunction DecisionPostureCard');

const renderLimitations1 = `
              <section className="mb-8">
                <DecisionPostureCard decision={(profile as any).decision} />
                <LimitationsCard missing={(profile as any).decision?.missing || []} />
              </section>
`;

const renderLimitations2 = `
              <section className="mb-10">
                <DecisionPostureCard decision={(profile as any).decision} />
                <LimitationsCard missing={(profile as any).decision?.missing || []} />
              </section>
`;

code = code.replace(/<section className="mb-8">\s*<DecisionPostureCard decision=\{\(profile as any\)\.decision\} \/>\s*<\/section>/, renderLimitations1);
code = code.replace(/<section className="mb-10 flex justify-center">\s*<DecisionPostureCard decision=\{\(profile as any\)\.decision\} \/>\s*<\/section>/, renderLimitations2);

// Strip technical wording from the ProofCard
code = code.replace(
  "Export the deterministic trust-proof bundle or download a human-readable PDF generated from the same canonical payload.",
  "Download a verified PDF summary of this clinician's credentialing checks and source data."
);
code = code.replace(
  "No source-backed claims are attached yet, so proof downloads stay disabled until the first checked claim lands.",
  "Verified PDF downloads will be available once the primary source checks are complete."
);
code = code.replace(
  "Download Cryptographic Bundle (JSON)",
  "Download Raw Data (JSON)"
);

// We want to hide AuditHashes completely as per rule:
// "REMOVE TECHNICAL LANGUAGE: Flag: hashes, crypto terms... These must NOT be primary UX"
code = code.replace(/<AuditHashes hashes=\{profile\.publicAuditHashes\} \/>/g, '');


fs.writeFileSync(path, code);
console.log('Fixed Proof UI');