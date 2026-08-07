import path from 'node:path';
import { generateManualAuditBundleArtifacts } from '../services/manualAuditBundle';

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main(): Promise<void> {
  const npi = readArg('--npi') ?? '0000000000';
  const outDirArg = readArg('--outdir');
  const outDir = outDirArg
    ? path.resolve(outDirArg)
    : path.resolve(__dirname, '../../../../../output/manual-audit-bundles');

  const { bundle, paths } = await generateManualAuditBundleArtifacts(npi, { outDir });

  process.stdout.write([
    `Generated manual audit bundle for ${bundle.provider.name} (${bundle.provider.npi})`,
    `Decision: ${bundle.summary.decision}`,
    `JSON: ${paths.jsonPath}`,
    `PDF: ${paths.pdfPath}`,
  ].join('\n'));
  process.stdout.write('\n');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Manual audit bundle generation failed: ${message}\n`);
  process.exitCode = 1;
});
