/**
 * One timestamp formatter for the clinician mobile surfaces.
 *
 * Three byte-identical copies of this used to live in ClinicianPanels,
 * ClinicianApplicationsSurface, and (near-identical) ClinicianHomeSurface —
 * and none included the year, so a March card read as "Mar 20, 7:53 PM" in
 * August and passed as fresh. The year is part of the claim.
 */
export function formatEventTimestamp(value: string, fallback = 'recently'): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
