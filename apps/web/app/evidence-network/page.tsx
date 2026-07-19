import { redirect } from 'next/navigation';

/**
 * SHD-0.3 (P0 quarantine) — the legacy public force-directed knowledge graph
 * here rendered invented clinician-like nodes and exposed layout/physics debug
 * controls. That is incompatible with a healthcare trust product and with
 * VitalCV's privacy and truth requirements, so the public graph is removed.
 *
 * The route redirects to the Trust Center (the real source-attribution and
 * transparency surface). A real clinician evidence-relationship view, if ever
 * built, is an authenticated, authorized, tenant-scoped product surface — never
 * a public marketing page. The abstract public "Evidence Network" transparency
 * page (system concepts only, no people) is SHD-2.3, built separately.
 */
export default function EvidenceNetworkPage() {
  redirect('/trust');
}
