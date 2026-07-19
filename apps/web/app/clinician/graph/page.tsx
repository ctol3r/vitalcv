import { redirect } from 'next/navigation';

/**
 * SHD-0.3 (P0 quarantine) — this public page rendered the same synthetic,
 * force-directed clinician graph as the legacy /evidence-network surface
 * (invented person-like nodes, non-live sample data). A public page of
 * clinician-like nodes is incompatible with VitalCV's privacy and truth
 * requirements, so it is removed and the route redirects to the Trust Center.
 * A clinician's real evidence relationships live in their authenticated wallet,
 * not a public graph.
 */
export default function ClinicianGraphPage() {
  redirect('/trust');
}
