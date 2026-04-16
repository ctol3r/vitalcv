type PublicDecisionStatus =
  | 'PROCEED'
  | 'PROCEED_WITH_CAUTION'
  | 'DO_NOT_PROCEED'
  | 'INSUFFICIENT_DATA';

type PublicNextBestActionKind =
  | 'PROCEED'
  | 'REVERIFY'
  | 'ESCALATE'
  | 'REVIEW_MANUALLY';

type ReceiptReference = {
  sourceId: string;
  receiptId: string;
};

type ManifestSourceReceiptShape = {
  sourceId: string;
  state: string;
  receiptIds?: string[];
  provenance?: {
    receiptIds?: string[];
  } | null;
};

type ManifestReceiptShape = {
  manifest: {
    sources: ManifestSourceReceiptShape[];
    receiptReferences?: ReceiptReference[];
  };
  receiptReferences?: ReceiptReference[];
};

type UiLimitationsShape = {
  blockers?: string[] | null;
  gaps?: string[] | null;
};

type FlowCoverageCheckShape = {
  sourceId: string;
  state: string;
};

type FlowCoverageShape = {
  checks: FlowCoverageCheckShape[];
};

type DisclosureCredentialShape = {
  type?: string | null;
  name?: string | null;
  issuer?: string | null;
  claimLevel?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  licenseId?: string | null;
  psvSnapshotHash?: string | null;
  verifierDid?: string | null;
};

export interface SelectiveDisclosureSnapshot {
  receiptBacked: boolean;
  visibleFields: string[];
  lockedFields: string[];
}

export interface UiTruthSnapshot {
  receiptBackedManifest: boolean;
  decisionGradeReady: boolean;
  decisionStatus: PublicDecisionStatus;
  visibleLimitations: Array<{ kind: 'blocker' | 'gap'; text: string }>;
}

export const FLOW_STAGES = [
  'identity',
  'safety',
  'authority',
  'decision',
] as const;

export type FlowStage = (typeof FLOW_STAGES)[number];

export interface FlowStageSnapshot {
  stage: FlowStage;
  visible: boolean;
  complete: boolean;
}

export type AtomicTruthRenderState = 'waiting' | 'resolved';

export interface AtomicRenderManifest {
  complete: boolean;
}

export interface AtomicManifest {
  complete: true;
  coverage: FlowCoverageShape;
}

export interface AtomicRenderUiState {
  renderState: AtomicTruthRenderState;
}

const FLOW_STAGE_SOURCE_IDS: Record<Exclude<FlowStage, 'decision'>, string[]> = {
  identity: ['NPPES_API', 'NPPES'],
  safety: ['OIG_LEIE', 'OIG'],
  authority: ['STATE_BOARD'],
};

const RESOLVED_FLOW_SOURCE_STATES = new Set([
  'checked',
  'stale',
  'gated',
  'unavailable',
  'accessrequired',
  'reviewrequired',
  'notdecisiongrade',
  'previewonly',
]);

function normalizeReadinessLevel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function hasDecisionGradeSignals(
  readinessLevel: string | null | undefined,
): boolean {
  return normalizeReadinessLevel(readinessLevel) === 'L3';
}

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeCoverageState(value: string | null | undefined): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s_-]+/g, '')
    : '';
}

function isFlowStageChecked(
  coverage: FlowCoverageShape | null | undefined,
  stage: Exclude<FlowStage, 'decision'>,
): boolean {
  const matches = FLOW_STAGE_SOURCE_IDS[stage];

  return coverage?.checks.some((check) => (
    matches.includes(check.sourceId)
    && normalizeCoverageState(check.state) === 'checked'
  )) ?? false;
}

function isFlowStageResolved(
  coverage: FlowCoverageShape | null | undefined,
  stage: Exclude<FlowStage, 'decision'>,
): boolean {
  const matches = FLOW_STAGE_SOURCE_IDS[stage];

  return coverage?.checks.some((check) => (
    matches.includes(check.sourceId)
    && RESOLVED_FLOW_SOURCE_STATES.has(normalizeCoverageState(check.state))
  )) ?? false;
}

export function buildFlowStages(input: {
  coverage?: FlowCoverageShape | null;
  readinessLevel?: string | null | undefined;
}): FlowStageSnapshot[] {
  const identityComplete = isFlowStageChecked(input.coverage ?? null, 'identity');
  const safetyVisible = identityComplete;
  const safetyComplete = safetyVisible && isFlowStageChecked(input.coverage ?? null, 'safety');
  const authorityVisible = safetyComplete;
  const authorityComplete = authorityVisible && isFlowStageChecked(input.coverage ?? null, 'authority');
  const decisionVisible = authorityComplete;
  const decisionComplete = decisionVisible && hasDecisionGradeSignals(input.readinessLevel);

  return [
    { stage: 'identity', visible: true, complete: identityComplete },
    { stage: 'safety', visible: safetyVisible, complete: safetyComplete },
    { stage: 'authority', visible: authorityVisible, complete: authorityComplete },
    { stage: 'decision', visible: decisionVisible, complete: decisionComplete },
  ];
}

export function canRenderFlowStage(input: {
  coverage?: FlowCoverageShape | null;
  readinessLevel?: string | null | undefined;
}, stage: FlowStage): boolean {
  return buildFlowStages(input).some((snapshot) => (
    snapshot.stage === stage && snapshot.visible
  ));
}

export function areRequiredFlowStagesResolved(input: {
  coverage?: FlowCoverageShape | null;
}): boolean {
  return ['identity', 'safety', 'authority'].every((stage) => (
    isFlowStageResolved(
      input.coverage ?? null,
      stage as Exclude<FlowStage, 'decision'>,
    )
  ));
}

export function resolveAtomicTruthRenderState(input: {
  coverage?: FlowCoverageShape | null;
}): AtomicTruthRenderState {
  return areRequiredFlowStagesResolved(input) ? 'resolved' : 'waiting';
}

export function toAtomicManifest(input: {
  coverage?: FlowCoverageShape | null;
}): AtomicManifest | null {
  if (!input.coverage || !areRequiredFlowStagesResolved(input)) {
    return null;
  }

  return {
    complete: true,
    coverage: input.coverage,
  };
}

export function assertNoArtificialLatency(input: {
  truthResolved: boolean;
  renderState: AtomicTruthRenderState;
}): void {
  if (input.truthResolved && input.renderState !== 'resolved') {
    throw new Error('Artificial latency forbidden');
  }
}

export function assertAtomicRender(
  manifest: AtomicRenderManifest,
  uiState: AtomicRenderUiState,
): void {
  if (!manifest.complete) {
    throw new Error('Partial truth render forbidden');
  }

  assertNoArtificialLatency({
    truthResolved: manifest.complete,
    renderState: uiState.renderState,
  });
}

export function assertNoProgressiveComputation(input: {
  manifestFetchCount: number;
  stageFetchCount?: number;
  conditionalFetchCount?: number;
}): void {
  if (
    input.manifestFetchCount !== 1
    || (input.stageFetchCount ?? 0) > 0
    || (input.conditionalFetchCount ?? 0) > 0
  ) {
    throw new Error('Progressive computation forbidden');
  }
}

export function resolvePublicDecisionTruthStatus(input: {
  decision: PublicDecisionStatus;
  readinessLevel: string | null | undefined;
}): PublicDecisionStatus {
  if (
    !hasDecisionGradeSignals(input.readinessLevel)
    && (input.decision === 'PROCEED' || input.decision === 'PROCEED_WITH_CAUTION')
  ) {
    return 'INSUFFICIENT_DATA';
  }

  return input.decision;
}

export function resolvePublicNextBestActionTruthStatus(input: {
  action: PublicNextBestActionKind;
  readinessLevel: string | null | undefined;
}): PublicNextBestActionKind {
  if (!hasDecisionGradeSignals(input.readinessLevel) && input.action === 'PROCEED') {
    return 'REVIEW_MANUALLY';
  }

  return input.action;
}

function collectManifestSourceReceiptIds(source: ManifestSourceReceiptShape): string[] {
  const ids = new Set<string>();

  for (const receiptId of source.receiptIds ?? []) {
    if (receiptId.trim().length > 0) {
      ids.add(receiptId);
    }
  }

  for (const receiptId of source.provenance?.receiptIds ?? []) {
    if (receiptId.trim().length > 0) {
      ids.add(receiptId);
    }
  }

  return [...ids];
}

export function hasReceiptBackedManifestSource(
  source: ManifestSourceReceiptShape,
  receiptReferences: ReceiptReference[],
): boolean {
  if (source.state.trim().toLowerCase() !== 'checked') {
    return true;
  }

  const receiptIds = collectManifestSourceReceiptIds(source);
  if (receiptIds.length === 0) {
    return false;
  }

  const referencedIds = new Set(
    receiptReferences
      .filter((reference) => reference.sourceId === source.sourceId)
      .map((reference) => reference.receiptId),
  );

  return receiptIds.some((receiptId) => referencedIds.has(receiptId));
}

export function hasReceiptBackedManifest(packet: ManifestReceiptShape): boolean {
  const mergedReferences = [
    ...(packet.manifest.receiptReferences ?? []),
    ...(packet.receiptReferences ?? []),
  ];

  return packet.manifest.sources.every((source) => (
    hasReceiptBackedManifestSource(source, mergedReferences)
  ));
}

export function resolveVisibleLimitations(
  limitations: UiLimitationsShape | null | undefined,
): Array<{ kind: 'blocker' | 'gap'; text: string }> {
  if (!limitations) {
    return [];
  }

  const blockers = dedupeStrings(limitations.blockers ?? [])
    .map((text) => ({ kind: 'blocker' as const, text }));
  const gaps = dedupeStrings(limitations.gaps ?? [])
    .map((text) => ({ kind: 'gap' as const, text }));

  return [...blockers, ...gaps];
}

export function isReceiptBackedDisclosureCredential(
  credential: DisclosureCredentialShape,
): boolean {
  return credential.claimLevel === 'L3'
    && typeof credential.psvSnapshotHash === 'string'
    && credential.psvSnapshotHash.trim().length > 0
    && typeof credential.verifierDid === 'string'
    && credential.verifierDid.trim().length > 0;
}

export function buildSelectiveDisclosureSnapshot(
  credential: DisclosureCredentialShape,
  disclosureLevel: 'full' | 'proof',
): SelectiveDisclosureSnapshot {
  const receiptBacked = isReceiptBackedDisclosureCredential(credential);
  const typeLabel = typeof credential.type === 'string'
    ? credential.type.replace(/_/g, ' ')
    : 'Credential';

  if (disclosureLevel === 'full') {
    return {
      receiptBacked,
      visibleFields: dedupeStrings([
        credential.name ?? '',
        credential.issuer ? `Issuer: ${credential.issuer}` : '',
        credential.licenseId ? `Identifier: ${credential.licenseId}` : '',
        credential.issueDate ? `Issued: ${credential.issueDate}` : '',
        credential.expirationDate ? `Expires: ${credential.expirationDate}` : '',
      ]),
      lockedFields: [],
    };
  }

  return {
    receiptBacked,
    visibleFields: dedupeStrings([
      `Credential type: ${typeLabel}`,
      receiptBacked ? 'Receipt attached' : 'Receipt missing',
      credential.claimLevel ? `Trust level: ${credential.claimLevel}` : '',
    ]),
    lockedFields: dedupeStrings([
      credential.name ?? '',
      credential.issuer ? `Issuer: ${credential.issuer}` : '',
      credential.licenseId ? `Identifier: ${credential.licenseId}` : '',
      credential.issueDate ? `Issued: ${credential.issueDate}` : '',
      credential.expirationDate ? `Expires: ${credential.expirationDate}` : '',
    ]),
  };
}

export function buildUiTruthSnapshot(input: {
  manifest: ManifestReceiptShape;
  readinessLevel: string | null | undefined;
  decision: PublicDecisionStatus;
  limitations?: UiLimitationsShape | null;
}): UiTruthSnapshot {
  return {
    receiptBackedManifest: hasReceiptBackedManifest(input.manifest),
    decisionGradeReady: hasDecisionGradeSignals(input.readinessLevel),
    decisionStatus: resolvePublicDecisionTruthStatus({
      decision: input.decision,
      readinessLevel: input.readinessLevel,
    }),
    visibleLimitations: resolveVisibleLimitations(input.limitations),
  };
}
