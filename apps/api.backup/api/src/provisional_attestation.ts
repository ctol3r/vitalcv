export interface ProvisionalAttestation {
  issuerId: string;
  issuedAt: Date;
  expiresAt: Date;
  note: string;
}

export function offerProvisionalAttestation(
  issuerId: string,
  daysValid: number = 30,
  note: string = 'Provisional attestation for unintegrated issuer'
): ProvisionalAttestation {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + daysValid * 24 * 60 * 60 * 1000);
  return { issuerId, issuedAt, expiresAt, note };
}
