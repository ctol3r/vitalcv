"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrustStateRouter = createTrustStateRouter;
const express_1 = require("express");
const trust_state_1 = require("../trust-state");
const trust_state_2 = require("../../../packages/trust-state");
function parseClinicianId(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('clinician_id is required');
    }
    return value.trim();
}
function parseScopeInput(source) {
    const employer_id = typeof source?.employer_id === 'string' && source.employer_id.trim().length > 0
        ? source.employer_id.trim()
        : undefined;
    const facility_id = typeof source?.facility_id === 'string' && source.facility_id.trim().length > 0
        ? source.facility_id.trim()
        : undefined;
    const role = typeof source?.role === 'string' && source.role.trim().length > 0
        ? source.role.trim()
        : undefined;
    const provided = [employer_id, facility_id, role].filter(Boolean).length;
    if (provided === 0)
        return undefined;
    if (provided !== 3) {
        throw new Error('employer_id, facility_id, and role must be provided together');
    }
    return { employer_id, facility_id, role };
}
function createTrustStateRouter(deps) {
    const router = (0, express_1.Router)();
    const resolver = new trust_state_2.TrustStateResolver(deps);
    router.get('/trust-state/:clinician_id', async (req, res) => {
        try {
            const clinician_id = parseClinicianId(req.params.clinician_id);
            const scope = parseScopeInput(req.query);
            const trustState = scope
                ? await resolver.resolve(clinician_id, scope)
                : await (0, trust_state_1.resolveTrustState)(clinician_id, deps);
            return res.status(200).json(trustState);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to compute trust-state';
            return res.status(400).json({ error: message });
        }
    });
    router.post('/verify', async (req, res) => {
        try {
            const purpose = req.body?.purpose;
            if (purpose !== 'employment') {
                return res.status(400).json({ error: 'purpose must be employment' });
            }
            const clinician_id = parseClinicianId(req.body?.clinician_id);
            const scope = parseScopeInput(req.body);
            const trustState = scope
                ? await resolver.resolve(clinician_id, scope)
                : await (0, trust_state_1.resolveTrustState)(clinician_id, deps);
            return res.status(200).json(trustState);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to verify trust-state';
            return res.status(400).json({ error: message });
        }
    });
    return router;
}
