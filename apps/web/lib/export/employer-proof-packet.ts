export function employerProofPacketFilename(npi: string): string {
  return `vitalcv-employer-packet-${npi}.pdf`;
}

export function buildEmployerProofPacketDownloadUrl(npi: string): string {
  const params = new URLSearchParams({ npi });
  return `/api/export/packet?${params.toString()}`;
}
