"use strict";
/**
 * B138A-AUD-014: Compacts Audit Events
 *
 * Audit event recording for compact eligibility computation, refresh, and errors.
 * All events are recorded with blockchain anchoring for tamper-proof audit trail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCompactComputedEvent = recordCompactComputedEvent;
exports.recordCompactRefreshedEvent = recordCompactRefreshedEvent;
exports.recordCompactErrorEvent = recordCompactErrorEvent;
exports.recordIMLCEligibilityEvent = recordIMLCEligibilityEvent;
exports.recordPSYPACTEligibilityEvent = recordPSYPACTEligibilityEvent;
exports.recordCounselingEligibilityEvent = recordCounselingEligibilityEvent;
exports.recordCompactVCIssuedEvent = recordCompactVCIssuedEvent;
exports.recordCompactVCRevokedEvent = recordCompactVCRevokedEvent;
exports.getCompactAuditEvents = getCompactAuditEvents;
/**
 * Record a compact eligibility computation event
 */
async function recordCompactComputedEvent(prisma, clinicianDid, compactStatus, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'COMPACT_COMPUTED',
            subjectNpi: undefined, // Using DID instead
            userId: undefined,
            data: {
                clinicianDid,
                imlcStatus: compactStatus.imlcStatus,
                imlcStates: compactStatus.imlcCompactStates,
                psypactStatus: compactStatus.psypactStatus,
                psypactStates: compactStatus.psypactStates,
                counselingStatus: compactStatus.counselingStatus,
                counselingStates: compactStatus.counselingStates,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record a compact status refresh event
 */
async function recordCompactRefreshedEvent(prisma, clinicianDid, previousStatus, newStatus, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'COMPACT_REFRESHED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                previousStatus: {
                    imlcStatus: previousStatus.imlcStatus,
                    psypactStatus: previousStatus.psypactStatus,
                    counselingStatus: previousStatus.counselingStatus,
                },
                newStatus: {
                    imlcStatus: newStatus.imlcStatus,
                    psypactStatus: newStatus.psypactStatus,
                    counselingStatus: newStatus.counselingStatus,
                },
                statusChanged: {
                    imlc: previousStatus.imlcStatus !== newStatus.imlcStatus,
                    psypact: previousStatus.psypactStatus !== newStatus.psypactStatus,
                    counseling: previousStatus.counselingStatus !== newStatus.counselingStatus,
                },
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record a compact eligibility computation error
 */
async function recordCompactErrorEvent(prisma, clinicianDid, error, compactType, metadata) {
    await prisma.auditEvent.create({
        data: {
            type: 'COMPACT_ERROR',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                compactType,
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                },
                metadata,
                timestamp: new Date().toISOString(),
            },
        },
    });
}
/**
 * Record IMLC eligibility computation
 */
async function recordIMLCEligibilityEvent(prisma, clinicianDid, status, homeState, eligibleStates, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'IMLC_ELIGIBILITY_COMPUTED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                status,
                homeState,
                eligibleStates,
                eligibleStatesCount: eligibleStates.length,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record PSYPACT eligibility computation
 */
async function recordPSYPACTEligibilityEvent(prisma, clinicianDid, status, primaryState, participatingStates, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'PSYPACT_ELIGIBILITY_COMPUTED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                status,
                primaryState,
                participatingStates,
                participatingStatesCount: participatingStates.length,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record Counseling Compact eligibility computation
 */
async function recordCounselingEligibilityEvent(prisma, clinicianDid, status, homeState, compactStates, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'COUNSELING_ELIGIBILITY_COMPUTED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                status,
                homeState,
                compactStates,
                compactStatesCount: compactStates.length,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record compact VC issuance
 */
async function recordCompactVCIssuedEvent(prisma, clinicianDid, vcCredentialId, vcHash, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'COMPACT_VC_ISSUED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                vcCredentialId,
                vcHash,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Record compact VC revocation
 */
async function recordCompactVCRevokedEvent(prisma, clinicianDid, vcCredentialId, reason, chainTxHash) {
    await prisma.auditEvent.create({
        data: {
            type: 'COMPACT_VC_REVOKED',
            subjectNpi: undefined,
            userId: undefined,
            data: {
                clinicianDid,
                vcCredentialId,
                reason,
                timestamp: new Date().toISOString(),
            },
            chainTxHash,
        },
    });
}
/**
 * Get compact audit events for a clinician
 */
async function getCompactAuditEvents(prisma, clinicianDid, options) {
    const where = {
        type: options?.eventType || {
            in: [
                'COMPACT_COMPUTED',
                'COMPACT_REFRESHED',
                'COMPACT_ERROR',
                'IMLC_ELIGIBILITY_COMPUTED',
                'PSYPACT_ELIGIBILITY_COMPUTED',
                'COUNSELING_ELIGIBILITY_COMPUTED',
                'COMPACT_VC_ISSUED',
                'COMPACT_VC_REVOKED',
            ],
        },
    };
    // Since we're storing clinicianDid in the data field, we need to filter in application code
    // or use a text search. For simplicity, we'll fetch all compact events and filter.
    const events = await prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0,
    });
    // Filter by clinicianDid in data field
    return events.filter((event) => {
        const data = event.data;
        return data?.clinicianDid === clinicianDid;
    });
}
