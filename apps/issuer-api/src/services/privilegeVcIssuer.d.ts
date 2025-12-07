/**
 * S72-D1-C-007: Privilege VC Issuer Service
 *
 * Issues Verifiable Credentials for granted clinical privileges.
 * Called when a privilege request is approved.
 * Generates signed PrivilegeGranted VC and stores vcId/anchorHash on PrivilegeRequest.
 */
/**
 * Verifiable Credential structure for PrivilegeGranted
 */
export interface PrivilegeGrantedVC {
    '@context': string[];
    id: string;
    type: string[];
    issuer: {
        id: string;
        name: string;
    };
    issuanceDate: string;
    expirationDate: string;
    credentialSubject: {
        id: string;
        name?: string;
        npi?: string;
        privileges: {
            privilegeSetId: string;
            privilegeSetName: string;
            department: string;
            procedures: Array<{
                code: string;
                name: string;
                category?: string;
            }>;
            restrictions?: string[];
        };
        grantedAt: string;
        reviewedBy?: {
            did: string;
            name?: string;
        };
        fppeRequired?: boolean;
        oppeRequired?: boolean;
        oppeIntervalMonths?: number;
        timeline: {
            effectiveDate: string;
            expirationDate: string;
            renewalDueDate: string;
        };
    };
    evidence?: Array<{
        id: string;
        type: string[];
        hash?: string;
    }>;
    proof?: {
        type: string;
        created: string;
        verificationMethod: string;
        proofPurpose: string;
        jws?: string;
    };
}
/**
 * Parameters for issuing a privilege VC
 */
export interface IssuePrivilegeVCParams {
    privilegeRequestId: string;
    clinicianDid: string;
    orgId: string;
    privilegeSetId: string;
    reviewerDid: string;
}
/**
 * Result of VC issuance
 */
export interface IssuePrivilegeVCResult {
    vcId: string;
    vcHash: string;
    vc: PrivilegeGrantedVC;
    anchorHash?: string;
}
/**
 * Issue a PrivilegeGranted Verifiable Credential
 */
export declare function issuePrivilegeGrantedVC(params: IssuePrivilegeVCParams): Promise<IssuePrivilegeVCResult>;
/**
 * Verify a PrivilegeGranted VC
 * In production, this would verify the signature and check blockchain anchor
 */
export declare function verifyPrivilegeGrantedVC(vc: PrivilegeGrantedVC): Promise<{
    valid: boolean;
    errors: string[];
}>;
/**
 * Revoke a privilege VC
 * In production, this would update a revocation registry
 */
export declare function revokePrivilegeGrantedVC(params: {
    vcId: string;
    privilegeGrantedId: string;
    reason: string;
    revokedBy: string;
}): Promise<void>;
