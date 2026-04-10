export type NCCPAStatus = 'CERTIFIED' | 'EXPIRED' | 'NOT_FOUND';

export async function verifyNCCPA(npi: string, stateId: string): Promise<{ status: NCCPAStatus, lastChecked: string }> {
  // Mock NCCPA lookup. In production, this proxies to NCCPA credentialing API.
  return {
    status: 'CERTIFIED',
    lastChecked: new Date().toISOString()
  };
}

export async function verifyStateBoard(state: string, licenseNumber: string): Promise<{ status: 'ACTIVE' | 'INACTIVE', expirationDate: string }> {
  // Mock State Board. Production routes through DCA Breeze / state-specific adapters.
  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 2);
  
  return {
    status: 'ACTIVE',
    expirationDate: expirationDate.toISOString()
  };
}
