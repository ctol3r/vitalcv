export type VCVApplication = {
  npi: string;
  identity: any; // IdentitySnapshot
  lanes: {
    identity: string;
    sanctions: string;
    licensure: string;
    enrollment: string;
  };
  claims: any[];
  completeness: number;
  generatedAt: Date;
  status: 'draft' | 'submitted' | 'viewed' | 'decision' | 'hired';
};
