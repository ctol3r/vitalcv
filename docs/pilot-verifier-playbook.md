# VitalCV Verifier Pilot Playbook

## 5-Minute Demo Flow
1. Open verifier dashboard and create a new pilot org with one API key and org context.
2. Submit a known NPI and show artifact generation with visible `status`, `fingerprint`, and `merkleRoot`.
3. Run `proof` request and show selective claim proof generation plus verifier-side proof verification.
4. Open transparency log for the artifact and show append-only lifecycle entries tied to state transitions.
5. Execute one `cross-check-bundle` call and show deterministic checksum output and stable ordering.

## Objection Handling

### “We already use Medallion”
Medallion workflows are policy and audit surfaces, while VitalCV adds deterministic execution for lifecycle, revocation, proof integrity, and tenancy boundaries.  
Position: we layer on top by feeding the same source/verification inputs into enforceable transitions.

### “We don’t trust digital credentials”
We treat credentials as one input in a controlled policy pipeline.  
Verification, integrity checks, and revocation state are computed in deterministic code paths, with replay-safe logs and explicit transition rules.

### “What about NCQA?”
VitalCV aligns with NCQA-style governance by producing auditable lifecycle transitions, deterministic source re-checking, and explicit trust evidence for every artifact movement.  
Result: easier evidence bundles for external reviews and easier internal sampling.

### “How is this different from PSV?”
PSV is often a document or file exchange layer; VitalCV is an operational trust layer with enforced transitions, tenant-scoped policy checks, and cryptographically anchored proofs at request time.

## Pilot Proposal Outline

### Scope
- One verifier org and one partner artifact source.
- Production-like traffic with a minimum of 3 clinician NPIs and one federated org link.
- Enable strict-mode simulation for incident replay and exception capture.

### Metrics
- Mean proof issuance latency.
- Verification success rate.
- Artifact lifecycle drift rate (expired/revoked/suspended detection lag).
- Unauthorized cross-tenant access attempts (must stay zero).
- Transparency bundle creation success rate and checksum stability.

### Timeline
- Week 1: Configure and onboard source + API key + callback paths.
- Week 2: Controlled traffic, alerting, and weekly review.
- Week 3: Add one federated trust relation and run failure-replay scenarios.
- Week 4: Executive review with compliance evidence exports.

### Success Criteria
- 95%+ successful artifact verification on normal traffic.
- 100% cross-tenant denies on negative trust paths.
- 0 production critical failures in transition enforcement.
- Stable cross-check bundle checksum across identical payloads for repeated inputs.

## Revenue Recovery Model
- $3,000/month base for pilot verifier org.
- $0.10 per 1,000 proof requests above baseline.
- Optional add-on: $1,500/month for advanced trust dashboard + compliance exports.

Simple sample:  
If 40,000 proof requests/month and 1 add-on bundle, expected revenue =  
`$3,000 + (40,000/1,000 * $0.10) + $1,500 = $5,900/month`.

## Risk Mitigation Positioning
- Deterministic replay: same inputs produce the same artifact state path.
- Fail-closed where strict mode requires explicit acceptance.
- Tenant boundaries and federation resolution are evaluated before proof, status, or bundle operations.
- All critical checks are policy-driven and central utilities, reducing drift across endpoints.
- Audit packet + transparency ledger provides post-incident recoverability and evidence continuity.
