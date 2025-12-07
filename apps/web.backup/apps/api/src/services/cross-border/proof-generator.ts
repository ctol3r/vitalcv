export interface CrossBorderProof {
  clinicianId: string;
  targetCountry: string;
  proof: {
    credentials: any[];
    equivalencies: any[];
    regulatorApproval: boolean;
  };
  valid: boolean;
}

export function proofGenerator(clinicianId: string, targetCountry: string): CrossBorderProof {
  return {
    clinicianId,
    targetCountry,
    proof: {
      credentials: [
        { id: 'cred_1', type: 'license', country: 'US' },
      ],
      equivalencies: [
        { source: 'US_license', target: `${targetCountry}_equivalent` },
      ],
      regulatorApproval: true,
    },
    valid: true,
  };
}








