import fs from 'node:fs/promises';
import path from 'node:path';
import { getPecosProvider, type PecosCheck } from './externalIntegrations';
import { buildPecosEnrollmentNote } from './identity/pecosContract';
import { checkExclusion, type ExclusionCheckParams, type ExclusionResult } from './psv/oigLeieChecker';
import { fetchNpiFromCMS } from '../modules/identity/nppes.service';
import { normalizeProvider } from '../modules/identity/nppes.validator';
import type { NppesFetchResult, NormalizedProvider } from '../modules/identity/types';
import { stableStringify } from '../utils/deterministic';

export type VCVBundleDecision = 'DECISION_GRADE' | 'PARTIAL' | 'CHECKING' | 'BLOCKED';

export type VCVBundle = {
  provider: {
    name: string;
    npi: string;
    taxonomy: string | null;
  };
  identity: {
    source: 'NPPES';
    status: string;
    timestamp: string;
  };
  sanctions: {
    source: 'OIG';
    status: string;
    timestamp: string;
  };
  enrollment: {
    source: 'PECOS';
    status: string;
    note: string;
  };
  summary: {
    decision: VCVBundleDecision;
    blockers: string[];
    nextSteps: string[];
    estimatedTimeSaved: number;
  };
};

export interface ManualAuditBundleDependencies {
  fetchNppes?: (npi: string) => Promise<NppesFetchResult>;
  checkOig?: (params: ExclusionCheckParams) => Promise<ExclusionResult>;
  checkPecos?: (npi: string) => Promise<PecosCheck>;
  now?: () => Date;
}

export interface ManualAuditBundleArtifactPaths {
  jsonPath: string;
  pdfPath: string;
}

export interface GenerateManualAuditBundleArtifactsOptions extends ManualAuditBundleDependencies {
  outDir?: string;
}

const DEFAULT_TIME_SAVED_MINUTES: Record<VCVBundleDecision, number> = {
  READY: 90,
  PARTIAL: 45,
  BLOCKED: 20,
};

function resolveIdentityStatus(provider: NormalizedProvider): string {
  if (provider.status === 'A') {
    return 'ACTIVE';
  }

  if (provider.status === 'D') {
    return 'DEACTIVATED';
  }

  return 'UNKNOWN';
}

function resolveProviderName(provider: NormalizedProvider): string {
  const normalized = provider.display_name.trim();
  return normalized || `Provider ${provider.npi}`;
}

function buildOigParams(provider: NormalizedProvider): ExclusionCheckParams {
  return {
    firstName: provider.first_name.trim() || provider.display_name.trim() || 'UNKNOWN',
    middleName: provider.middle_name.trim() || null,
    lastName: provider.last_name.trim() || provider.organization_name.trim() || provider.display_name.trim(),
    npi: provider.npi,
    state: provider.practice_address?.state?.trim() || provider.mailing_address?.state?.trim() || null,
    specialty: provider.primary_taxonomy?.trim() || null,
  };
}

function isPreviewOnlyPecos(check: PecosCheck): boolean {
  const rawPayload = check.rawPayload as Record<string, unknown>;
  return rawPayload.previewOnly === true || rawPayload.source === 'mock-pecos-provider';
}

function buildEnrollmentNote(check: PecosCheck): string {
  const baseNote = buildPecosEnrollmentNote(check.claimState, check.dataVersion);

  if (isPreviewOnlyPecos(check)) {
    return `${baseNote}. Current environment uses preview-only PECOS data, so confirm enrollment manually before employer acceptance.`;
  }

  return baseNote;
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildSummary(input: {
  identityStatus: string;
  sanctionsStatus: ExclusionResult['status'];
  enrollmentStatus: PecosCheck['claimState'];
  enrollmentPreviewOnly: boolean;
}): VCVBundle['summary'] {
  const blockers: string[] = [];
  const nextSteps: string[] = [];

  if (input.identityStatus !== 'ACTIVE') {
    blockers.push('NPPES did not return an active individual provider identity.');
    nextSteps.push('Re-run the NPPES lookup and confirm the clinician entered the correct 10-digit individual NPI.');
  }

  if (input.sanctionsStatus === 'EXCLUDED') {
    blockers.push('OIG/LEIE returned an exclusion for this clinician.');
    nextSteps.push('Stop the handoff and escalate the OIG/LEIE exclusion to compliance review.');
  }

  if (input.sanctionsStatus === 'POSSIBLE_MATCH') {
    blockers.push('OIG/LEIE returned a possible match that still requires manual resolution.');
    nextSteps.push('Run a manual OIG/LEIE verification and attach the reviewer outcome to the bundle.');
  }

  if (input.sanctionsStatus === 'UNCHECKED') {
    blockers.push('OIG/LEIE could not be confirmed from the current monthly dataset.');
    nextSteps.push('Run a manual OIG/LEIE verification and attach the receipt before employer review.');
  }

  if (input.enrollmentStatus === 'NOT_FOUND') {
    blockers.push('CMS PECOS did not confirm Medicare enrollment for this NPI.');
    nextSteps.push('Confirm whether Medicare enrollment is required for this role and document the exception if it is not.');
  }

  if (input.enrollmentStatus === 'UNKNOWN' || input.enrollmentPreviewOnly) {
    blockers.push('CMS PECOS did not return decision-grade enrollment status in this environment.');
    nextSteps.push('Resolve Medicare enrollment manually and attach the evidence to the audit packet.');
  }

  let decision: VCVBundleDecision = 'PARTIAL';

  if (input.identityStatus !== 'ACTIVE' || input.sanctionsStatus === 'EXCLUDED') {
    decision = 'BLOCKED';
  } else if (
    input.identityStatus === 'ACTIVE'
    && input.sanctionsStatus === 'CLEAR'
    && input.enrollmentStatus === 'ENROLLED'
    && !input.enrollmentPreviewOnly
  ) {
    decision = 'READY';
  }

  if (decision === 'READY') {
    nextSteps.push('Share the bundle with the reviewer and record the acceptance outcome in VitalCV.');
  }

  return {
    decision,
    blockers: dedupe(blockers),
    nextSteps: dedupe(nextSteps),
    estimatedTimeSaved: DEFAULT_TIME_SAVED_MINUTES[decision],
  };
}

function escapePdfText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function buildPdfLines(bundle: VCVBundle, generatedAt: string): string[] {
  const blockers = bundle.summary.blockers.length > 0 ? bundle.summary.blockers : ['None'];
  const nextSteps = bundle.summary.nextSteps.length > 0 ? bundle.summary.nextSteps : ['None'];

  const baseLines = [
    'VitalCV Manual Audit Bundle',
    '',
    `Generated: ${generatedAt}`,
    `Provider: ${bundle.provider.name}`,
    `NPI: ${bundle.provider.npi}`,
    `Taxonomy: ${bundle.provider.taxonomy ?? 'Unavailable'}`,
    '',
    `Identity (${bundle.identity.source}): ${bundle.identity.status}`,
    `Identity checked at: ${bundle.identity.timestamp}`,
    '',
    `Sanctions (${bundle.sanctions.source}): ${bundle.sanctions.status}`,
    `Sanctions checked at: ${bundle.sanctions.timestamp}`,
    '',
    `Enrollment (${bundle.enrollment.source}): ${bundle.enrollment.status}`,
    `Enrollment note: ${bundle.enrollment.note}`,
    '',
    `Decision: ${bundle.summary.decision}`,
    `Estimated time saved: ${bundle.summary.estimatedTimeSaved} minutes`,
    '',
    'Blockers:',
    ...blockers.map((blocker) => `- ${blocker}`),
    '',
    'Next steps:',
    ...nextSteps.map((step) => `- ${step}`),
  ];

  return baseLines.flatMap((line) => wrapPdfLine(line));
}

function wrapPdfLine(line: string, maxChars = 82): string[] {
  if (line.length <= maxChars || !line.trim()) {
    return [line];
  }

  const words = line.split(/\s+/).filter(Boolean);
  const wrapped: string[] = [];
  const continuationIndent = line.startsWith('- ') ? '  ' : '  ';
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      wrapped.push(current);
    }
    current = `${continuationIndent}${word}`;
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped;
}

function buildPdfDocument(pageLineGroups: string[][]): Buffer {
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageObjectIds: number[] = [];

  for (const lines of pageLineGroups) {
    const content = [
      'BT',
      '/F1 12 Tf',
      '14 TL',
      '54 738 Td',
      ...lines.flatMap((line, index) => (
        index === 0
          ? [`(${escapePdfText(line)}) Tj`]
          : ['T*', `(${escapePdfText(line)}) Tj`]
      )),
      'ET',
    ].join('\n');

    const contentObjectId = addObject(
      `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    );

    const pageObjectId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );

    pageObjectIds.push(pageObjectId);
  }

  const pagesObjectId = addObject(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`,
  );
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const finalizedObjects = objects.map((body, index) => {
    const objectId = index + 1;
    if (pageObjectIds.includes(objectId)) {
      return body.replace('/Parent 0 0 R', `/Parent ${pagesObjectId} 0 R`);
    }
    return body;
  });

  let document = '%PDF-1.4\n';
  const offsets: number[] = [0];

  finalizedObjects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(document, 'utf8'));
    document += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(document, 'utf8');
  document += `xref\n0 ${finalizedObjects.length + 1}\n`;
  document += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    document += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  document += [
    'trailer',
    `<< /Size ${finalizedObjects.length + 1} /Root ${catalogObjectId} 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');

  return Buffer.from(document, 'utf8');
}

export function renderManualAuditBundlePdf(
  bundle: VCVBundle,
  generatedAt = new Date().toISOString(),
): Buffer {
  const lines = buildPdfLines(bundle, generatedAt);
  const linesPerPage = 44;
  const pageLineGroups: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pageLineGroups.push(lines.slice(index, index + linesPerPage));
  }

  return buildPdfDocument(pageLineGroups);
}

export async function buildManualAuditBundle(
  npi: string,
  dependencies: ManualAuditBundleDependencies = {},
): Promise<VCVBundle> {
  const normalizedNpi = npi.trim();
  if (!/^\d{10}$/.test(normalizedNpi)) {
    throw new Error('NPI must be exactly 10 digits.');
  }

  const fetchNppes = dependencies.fetchNppes ?? fetchNpiFromCMS;
  const checkOig = dependencies.checkOig ?? checkExclusion;
  const checkPecos = dependencies.checkPecos ?? ((value) => getPecosProvider().fetchEnrollmentStatus(value));
  const now = dependencies.now ?? (() => new Date());

  const identityLookupAt = now().toISOString();
  const { rawPayload } = await fetchNppes(normalizedNpi);
  const provider = normalizeProvider(rawPayload);
  const [sanctions, enrollment] = await Promise.all([
    checkOig(buildOigParams(provider)),
    checkPecos(normalizedNpi),
  ]);

  const identityStatus = resolveIdentityStatus(provider);
  const enrollmentPreviewOnly = isPreviewOnlyPecos(enrollment);

  return {
    provider: {
      name: resolveProviderName(provider),
      npi: normalizedNpi,
      taxonomy: provider.primary_taxonomy?.trim() || null,
    },
    identity: {
      source: 'NPPES',
      status: identityStatus,
      timestamp: identityLookupAt,
    },
    sanctions: {
      source: 'OIG',
      status: sanctions.status,
      timestamp: sanctions.checkedAt,
    },
    enrollment: {
      source: 'PECOS',
      status: enrollment.claimState,
      note: buildEnrollmentNote(enrollment),
    },
    summary: buildSummary({
      identityStatus,
      sanctionsStatus: sanctions.status,
      enrollmentStatus: enrollment.claimState,
      enrollmentPreviewOnly,
    }),
  };
}

export async function generateManualAuditBundleArtifacts(
  npi: string,
  options: GenerateManualAuditBundleArtifactsOptions = {},
): Promise<{ bundle: VCVBundle; paths: ManualAuditBundleArtifactPaths }> {
  const bundle = await buildManualAuditBundle(npi, options);
  const outDir = options.outDir
    ? path.resolve(options.outDir)
    : path.resolve(__dirname, '../../../../../output/manual-audit-bundles');

  await fs.mkdir(outDir, { recursive: true });

  const baseName = `vitalcv-manual-audit-bundle-${bundle.provider.npi}`;
  const jsonPath = path.join(outDir, `${baseName}.json`);
  const pdfPath = path.join(outDir, `${baseName}.pdf`);

  await fs.writeFile(jsonPath, `${stableStringify(bundle)}\n`, 'utf8');
  await fs.writeFile(pdfPath, renderManualAuditBundlePdf(bundle));

  return {
    bundle,
    paths: {
      jsonPath,
      pdfPath,
    },
  };
}
