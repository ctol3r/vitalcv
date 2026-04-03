/** YC MVP — behavior frozen. Do not modify without scope approval. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustStateResolver = void 0;
const psv_1 = require("@vitalcv/psv");
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CRS_START_THRESHOLD = 80;
const BLOCKING_REASON_ORDER = [
    'MISSING_PSV',
    'EXPIRED_PSV',
    'REVOKED_PSV',
    'MISSING_ACCEPTANCE',
    'CRS_BELOW_THRESHOLD',
    'START_ALREADY_ATTESTED',
];
function assertClinicianId(clinician_id) {
    if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
        throw new Error('clinician_id is required');
    }
}
function isValidRfc3339Utc(value) {
    return RFC3339_UTC.test(value) && Number.isFinite(Date.parse(value));
}
function normalizeLastVerifiedAt(crs, fallbackIso) {
    return isValidRfc3339Utc(crs.last_verified_at) ? crs.last_verified_at : fallbackIso;
}
function sortBlockingReasons(reasons) {
    return BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason));
}
function normalizeScopeField(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeScope(scope) {
    if (!scope || typeof scope !== 'object') {
        return {};
    }
    const employer_id = normalizeScopeField(scope.employer_id);
    const facility_id = normalizeScopeField(scope.facility_id);
    const role = normalizeScopeField(scope.role);
    return {
        ...(employer_id ? { employer_id } : {}),
        ...(facility_id ? { facility_id } : {}),
        ...(role ? { role } : {}),
    };
}
function hasAnyScope(scope) {
    return Boolean(scope.employer_id || scope.facility_id || scope.role);
}
function hasFullScope(scope) {
    return Boolean(scope.employer_id && scope.facility_id && scope.role);
}
function isScopeMatch(record, scope) {
    return (record.employer_id === scope.employer_id &&
        record.facility_id === scope.facility_id &&
        record.role === scope.role);
}
class TrustStateResolver {
    constructor(deps) {
        this.deps = deps;
    }
    async hasAcceptanceForScope(clinician_id, scope) {
        if (!hasAnyScope(scope)) {
            return this.deps.acceptances.existsForClinician(clinician_id);
        }
        if (!hasFullScope(scope)) {
            // Partial scope is invalid for deterministic trust-state gating.
            return false;
        }
        if (this.deps.acceptances.existsForScope) {
            return this.deps.acceptances.existsForScope({
                clinician_id,
                employer_id: scope.employer_id,
                facility_id: scope.facility_id,
                role: scope.role,
            });
        }
        if (this.deps.acceptances.listByClinician) {
            const records = await this.deps.acceptances.listByClinician(clinician_id);
            return records.some((record) => isScopeMatch(record, scope));
        }
        // Scope-aware gating cannot be evaluated without scoped acceptance data.
        return false;
    }
    async hasStartForScope(clinician_id, scope) {
        if (!hasAnyScope(scope)) {
            return this.deps.starts.existsForClinician(clinician_id);
        }
        if (!hasFullScope(scope)) {
            // Partial scope is invalid for deterministic trust-state gating.
            return false;
        }
        if (this.deps.starts.existsForScope) {
            return this.deps.starts.existsForScope({
                clinician_id,
                employer_id: scope.employer_id,
                facility_id: scope.facility_id,
                role: scope.role,
            });
        }
        if (this.deps.starts.listByClinician) {
            const records = await this.deps.starts.listByClinician(clinician_id);
            return records.some((record) => isScopeMatch(record, scope));
        }
        return false;
    }
    async resolve(clinician_id, scope) {
        const startedAtMs = Date.now();
        assertClinicianId(clinician_id);
        const normalizedScope = normalizeScope(scope);
        const asOf = (this.deps.now ?? (() => new Date()))().toISOString();
        const [crs, receipts, hasAcceptance, hasStart] = await Promise.all([
            this.deps.crs.computeForClinician({ clinician_id, as_of: asOf }),
            this.deps.receipts.listByClinician(clinician_id),
            this.hasAcceptanceForScope(clinician_id, normalizedScope),
            this.hasStartForScope(clinician_id, normalizedScope),
        ]);
        const blockingReasons = new Set();
        const decayedReceipts = [];
        if (!Array.isArray(receipts) || receipts.length === 0) {
            blockingReasons.add('MISSING_PSV');
        }
        else {
            for (const receipt of receipts) {
                const status = (0, psv_1.resolveReceiptStatus)(receipt, asOf);
                if (status === 'REVOKED') {
                    blockingReasons.add('REVOKED_PSV');
                    decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
                }
                if (status === 'EXPIRED') {
                    blockingReasons.add('EXPIRED_PSV');
                    decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
                }
            }
        }
        if (!hasAcceptance) {
            blockingReasons.add('MISSING_ACCEPTANCE');
        }
        if (hasStart) {
            blockingReasons.add('START_ALREADY_ATTESTED');
        }
        const hasDecay = decayedReceipts.length > 0;
        const resolvedBand = hasDecay ? 'RED' : crs.band;
        const resolvedScore = hasDecay && crs.score >= CRS_START_THRESHOLD ? CRS_START_THRESHOLD - 1 : crs.score;
        if (resolvedScore < CRS_START_THRESHOLD || resolvedBand !== 'GREEN') {
            blockingReasons.add('CRS_BELOW_THRESHOLD');
        }
        for (const decayedReceipt of decayedReceipts) {
            await this.deps.audit.append({
                event_type: 'TRUST_STATE_DECAY',
                clinician_id,
                occurred_at: asOf,
                metadata: {
                    receipt_id: decayedReceipt.receipt_id,
                    previous_band: crs.band,
                    new_band: 'RED',
                    detected_at: asOf,
                    status: decayedReceipt.status,
                },
            });
        }
        const orderedReasons = sortBlockingReasons(blockingReasons);
        const start_ready = orderedReasons.length === 0;
        const last_verified_at = normalizeLastVerifiedAt(crs, asOf);
        const metrics = {
            verification_latency_ms: Math.max(0, Date.now() - startedAtMs),
            crs_band: resolvedBand,
            blocking_reason_count: orderedReasons.length,
        };
        let linked_employers_count;
        let linked_clinicians_count;
        try {
            const listEmployersForClinician = this.deps.trust_graph?.listEmployersForClinician;
            if (listEmployersForClinician) {
                const links = await listEmployersForClinician(clinician_id);
                linked_employers_count = Array.isArray(links) ? links.length : 0;
            }
        }
        catch {
            linked_employers_count = undefined;
        }
        try {
            const listCliniciansForEmployer = this.deps.trust_graph?.listCliniciansForEmployer;
            if (listCliniciansForEmployer && normalizedScope.employer_id) {
                const links = await listCliniciansForEmployer(normalizedScope.employer_id);
                linked_clinicians_count = Array.isArray(links) ? links.length : 0;
            }
        }
        catch {
            linked_clinicians_count = undefined;
        }
        const audit = await this.deps.audit.append({
            event_type: 'TRUST_STATE_CHECK',
            clinician_id,
            occurred_at: asOf,
            metadata: {
                start_ready,
                score: resolvedScore,
                band: resolvedBand,
                blocking_reasons: orderedReasons,
                metrics,
            },
        });
        return {
            clinician_id,
            start_ready,
            score: resolvedScore,
            band: resolvedBand,
            blocking_reasons: orderedReasons,
            last_verified_at,
            audit_ref: audit.audit_packet_id,
            metrics: {
                verification_latency_ms: metrics.verification_latency_ms,
            },
            ...(typeof linked_employers_count === 'number' ? { linked_employers_count } : {}),
            ...(typeof linked_clinicians_count === 'number' ? { linked_clinicians_count } : {}),
        };
    }
}
exports.TrustStateResolver = TrustStateResolver;
