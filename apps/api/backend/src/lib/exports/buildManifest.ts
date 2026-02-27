import { canonicalize } from "json-canonicalize";
import type { ExportControl, ExportManifest, ManifestInput, ExportSubject } from "./types";
import { sha256Hex } from "../crypto/sha256";

export function buildNcqaControls(): ExportControl[] {
  return [
    { framework: "NCQA", control_id: "CR1", description: "Credentialing file integrity and required elements" },
    { framework: "NCQA", control_id: "CR2", description: "Primary source verification evidence and timeliness" },
    { framework: "NCQA", control_id: "CR3", description: "Ongoing monitoring and re-verification triggers" },
    { framework: "NCQA", control_id: "CR4", description: "Sanctions/disciplinary action checks and documentation" },
    { framework: "NCQA", control_id: "CR5", description: "Attestation, approval, and audit trail completeness" },
  ];
}

type BuildManifestParams = {
  exportId: string;
  subject: ExportSubject;
  inputs: ManifestInput[];
};

export function buildManifest(params: BuildManifestParams): {
  manifest: ExportManifest;
  canonical: string;
  canonicalSha256: string;
} {
  const manifest: ExportManifest = {
    schema_version: "1.0.0",
    export_id: params.exportId,
    generated_at_utc: new Date().toISOString(),
    subject: params.subject,
    controls: buildNcqaControls(),
    inputs: params.inputs,
    methodology_version: "vitalcv.audit.export/1",
  };

  const canonical      = canonicalize(manifest)!;
  const canonicalSha256 = sha256Hex(canonical);

  return { manifest, canonical, canonicalSha256 };
}
