export async function submitApplication(clinicianId: string, jobId: string) {
  const id = `app-${Date.now()}`;
  return {
    id,
    clinicianId,
    jobId,
    createdAt: new Date().toISOString(),
  };
}
