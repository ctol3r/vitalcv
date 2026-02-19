"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanStart = assertCanStart;
const errors_1 = require("../errors");
function assertCanStart(acceptance, priorStarts = []) {
    if (!acceptance) {
        throw new errors_1.DomainError('Acceptance is required before start', 'MISSING_ACCEPTANCE');
    }
    const alreadyStarted = priorStarts.some((start) => start.acceptanceId === acceptance.acceptanceId);
    if (alreadyStarted) {
        throw new errors_1.DomainError('Start already exists for this acceptance', 'START_EXISTS');
    }
}
