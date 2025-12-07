export interface EvidenceBundleManifest {
  bundleId: string;
  clinicianId: string;
  npi?: string;
  vcId?: string;
  psvResultId: string;
  timestamp: string;
  results: {
    licenseCheck: {
      checkId: string;
      npi: string;
      state: string;
      licenseNumber: string;
      status: string;
      sourceUrl: string;
      checkedAt: string;
    };
    sanctionsCheck: {
      checkId: string;
      npi: string;
      sanctioned: boolean;
      sourceUrl: string;
      checkedAt: string;
    };
  };
  overallStatus: string;
  sourceUrls: string[];
  metadata: {
    ncqaCompliance: string;
    freshnessStatus: string;
    generatedAt: string;
  };
}

export interface EvidenceBundleResult {
  bundleId: string;
  manifestPath: string;
  tempDirectory: string;
  manifest: EvidenceBundleManifest;
}

