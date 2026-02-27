import PDFDocument from "pdfkit";

type EvidencePdfParams = {
  exportId: string;
  subjectDid: string;
  subjectNpi: string;
  summary: {
    readiness_band: string;
    readiness_score: number;
    outcome: string;
  };
  inputs: Array<{
    source: string;
    retrievedAtUtc: string;
    sha256: string;
  }>;
};

export async function buildEvidencePdf(params: EvidencePdfParams): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ── Header ──────────────────────────────────────────────
  doc.fontSize(18).fillColor("#000").text("VitalCV Evidence Packet", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#333")
    .text(`Export ID:    ${params.exportId}`)
    .text(`Subject DID:  ${params.subjectDid}`)
    .text(`Subject NPI:  ${params.subjectNpi}`)
    .text(`Generated:    ${new Date().toUTCString()}`);
  doc.moveDown(0.8);

  // ── PSV Outcome ──────────────────────────────────────────
  doc.fontSize(14).fillColor("#000").text("PSV Outcome Summary");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#333")
    .text(`Readiness Band:  ${params.summary.readiness_band}`)
    .text(`Readiness Score: ${params.summary.readiness_score}`)
    .text(`Outcome:         ${params.summary.outcome}`);
  doc.moveDown(1);

  // ── Evidence Inputs ──────────────────────────────────────
  doc.fontSize(14).fillColor("#000").text("Evidence Inputs & Cryptographic Hashes");
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#333");
  params.inputs.forEach((inp, idx) => {
    doc.text(`${idx + 1}. Source:    ${inp.source}`);
    doc.text(`   Retrieved: ${inp.retrievedAtUtc}`);
    doc.text(`   SHA-256:   ${inp.sha256}`);
    doc.moveDown(0.4);
  });

  // ── NCQA Controls ────────────────────────────────────────
  doc.moveDown(0.4);
  doc.fontSize(14).fillColor("#000").text("NCQA Credentialing Controls (CR1-CR5)");
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#333");
  [
    "CR1 — Credentialing file integrity and required elements",
    "CR2 — Primary source verification evidence and timeliness",
    "CR3 — Ongoing monitoring and re-verification triggers",
    "CR4 — Sanctions/disciplinary action checks and documentation",
    "CR5 — Attestation, approval, and audit trail completeness",
  ].forEach((line) => doc.text(`• ${line}`));

  doc.moveDown(1);
  doc.fontSize(9).fillColor("#666").text(
    "Machine-verifiable integrity is enforced by manifest.json (JCS canonicalized) " +
    "and manifest.sig (Ed25519 detached signature). Verify using GET /api/verify."
  );

  doc.end();
  return done;
}
