import type { AgentAction } from '../timeline/agentIntegration';

export interface AgentAuditExportOptions {
  clinicianId: string;
  orgId?: string;
  committeePacketId?: string;
  includePdf?: boolean;
}

export interface AgentAuditManifestAction {
  id: string;
  category: AgentAction['category'];
  state: AgentAction['state'];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  summary: string;
  evidenceCount: number;
  evidence?: AgentAction['evidence'];
}

export interface AgentAuditManifest {
  formatVersion: string;
  generatedAt: string;
  clinicianId: string;
  orgId?: string;
  committeePacketId?: string;
  actions: AgentAuditManifestAction[];
  totals: {
    actionCount: number;
    evidenceCount: number;
  };
}

export interface AuditArtifact {
  filename: string;
  mimeType: string;
  data: string | Uint8Array;
}

export interface AgentAuditExportResult {
  manifest: AgentAuditManifest;
  jsonFile: AuditArtifact;
  pdfFile?: AuditArtifact;
}

export async function exportAgentAudit(
  actions: AgentAction[],
  options: AgentAuditExportOptions
): Promise<AgentAuditExportResult> {
  const manifest = buildManifest(actions, options);
  const jsonPayload = JSON.stringify(manifest, null, 2);
  const jsonFile: AuditArtifact = {
    filename: `agent-audit-${manifest.clinicianId}.json`,
    mimeType: 'application/json',
    data: jsonPayload,
  };

  const includePdf = options.includePdf !== false;
  const pdfFile = includePdf ? await buildPdfArtifact(manifest) : undefined;

  return { manifest, jsonFile, ...(pdfFile ? { pdfFile } : {}) };
}

function buildManifest(actions: AgentAction[], options: AgentAuditExportOptions): AgentAuditManifest {
  const generatedAt = new Date().toISOString();
  const actionEntries: AgentAuditManifestAction[] = actions.map((action) => ({
    id: action.id,
    category: action.category,
    state: action.state,
    startedAt: action.startedAt.toISOString(),
    completedAt: action.completedAt?.toISOString(),
    durationMs: action.completedAt ? action.completedAt.getTime() - action.startedAt.getTime() : undefined,
    summary: action.summary,
    evidenceCount: action.evidence?.length ?? 0,
    evidence: action.evidence,
  }));

  const evidenceCount = actionEntries.reduce((total, entry) => total + entry.evidenceCount, 0);

  return {
    formatVersion: '2025-11-09',
    generatedAt,
    clinicianId: options.clinicianId,
    orgId: options.orgId,
    committeePacketId: options.committeePacketId,
    actions: actionEntries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    totals: {
      actionCount: actions.length,
      evidenceCount,
    },
  };
}

async function buildPdfArtifact(manifest: AgentAuditManifest): Promise<AuditArtifact | undefined> {
  if (manifest.actions.length === 0) {
    return undefined;
  }

  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any);

  const doc = new jsPDF({ format: 'letter', unit: 'pt' });
  doc.setFont('helvetica', 'normal', 'normal');
  doc.setFontSize(16);
  doc.text('Vital Credentialing Agent Audit', 40, 40);
  doc.setFontSize(10);
  doc.text(`Clinician: ${manifest.clinicianId}`, 40, 60);
  if (manifest.orgId) {
    doc.text(`Org: ${manifest.orgId}`, 40, 74);
  }
  doc.text(`Generated: ${new Date(manifest.generatedAt).toLocaleString()}`, 40, 88);

  autoTable(doc, {
    startY: 110,
    head: [['Action', 'Category', 'State', 'Started', 'Completed', 'Evidence', 'Summary']],
    body: manifest.actions.map((action) => [
      action.id,
      action.category,
      action.state,
      formatDate(action.startedAt),
      action.completedAt ? formatDate(action.completedAt) : '—',
      String(action.evidenceCount),
      action.summary,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellWidth: 'wrap' },
    headStyles: { fillColor: [60, 80, 100], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 90 },
      6: { cellWidth: 200 },
    },
  });

  const arrayBuffer = doc.output('arraybuffer');
  return {
    filename: `agent-audit-${manifest.clinicianId}.pdf`,
    mimeType: 'application/pdf',
    data: new Uint8Array(arrayBuffer),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleString();
}
