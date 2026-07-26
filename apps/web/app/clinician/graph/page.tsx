import { redirect } from 'next/navigation';

/**
 * SHD-0.3 (P0 quarantine) — this route used to render a synthetic,
 * force-directed "career evidence graph" of invented person-like nodes drawn
 * from a non-live sample roster, plus physics/debug controls. It carries no
 * auth gate: lib/auth/roles.ts classes /clinician/graph as neither public nor
 * protected, so the middleware passes it straight through and an anonymous
 * visitor can reach it — i.e. a publicly reachable page of made-up clinicians
 * on a trust/credentialing product.
 *
 * Per the SHD doctrine, person-like nodes belong ONLY on authenticated,
 * authorized, tenant-scoped surfaces showing REAL records — never here. A
 * clinician's real career-evidence graph already lives in their signed-in
 * wallet (the gated /holder workspace). This route is retired: it imports no
 * graph and renders no synthetic people; it redirects to the public Trust
 * Center — the canonical source-attribution / transparency surface, sibling of
 * the quarantined /evidence-network.
 */
export default function ClinicianGraphPage() {
  redirect('/trust');
}
