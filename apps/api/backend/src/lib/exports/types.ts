export type ExportControl = {
  framework: "NCQA";
  control_id: string;
  description: string;
};

export type ManifestInput = {
  source: string;
  retrieved_at_utc: string;
  sha256: string;
  artifact_type: string;
};

export type ExportSubject = {
  did: string;
  npi: string;
};

export type ExportManifest = {
  schema_version: "1.0.0";
  export_id: string;
  generated_at_utc: string;
  subject: ExportSubject;
  controls: ExportControl[];
  inputs: ManifestInput[];
  methodology_version: string;
};
