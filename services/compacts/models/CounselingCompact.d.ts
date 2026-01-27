/**
 * B138A-CC-006: Counseling Compact Model
 *
 * Defines the data model and validation for the Counseling Compact eligibility.
 * The Counseling Compact allows licensed professional counselors to practice across state lines.
 */
import { z } from 'zod';
export type CounselingCompactStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'ACTIVE';
export declare const CounselingLicenseTypes: readonly ["LPC", "LPCC", "LMHC", "LCMHC", "LCPC"];
export type CounselingLicenseType = typeof CounselingLicenseTypes[number];
export declare const CounselingLicenseSchema: z.ZodObject<{
    state: z.ZodString;
    licenseNumber: z.ZodString;
    licenseType: z.ZodEnum<["LPC", "LPCC", "LMHC", "LCMHC", "LCPC"]>;
    issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    status: "active" | "inactive" | "expired" | "revoked";
    isPrimary: boolean;
    licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
    expirationDate?: string | Date | undefined;
}, {
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    status: "active" | "inactive" | "expired" | "revoked";
    licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
    expirationDate?: string | Date | undefined;
    isPrimary?: boolean | undefined;
}>;
export type CounselingLicense = z.infer<typeof CounselingLicenseSchema>;
export declare const CounselingCompactSchema: z.ZodObject<{
    clinicianDid: z.ZodString;
    homeState: z.ZodOptional<z.ZodString>;
    compactStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "ACTIVE"]>>;
    licenseType: z.ZodOptional<z.ZodEnum<["LPC", "LPCC", "LMHC", "LCMHC", "LCPC"]>>;
    licenseData: z.ZodOptional<z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        licenseNumber: z.ZodString;
        licenseType: z.ZodEnum<["LPC", "LPCC", "LMHC", "LCMHC", "LCPC"]>;
        issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        isPrimary: boolean;
        licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
        expirationDate?: string | Date | undefined;
    }, {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status: "NOT_ELIGIBLE" | "ELIGIBLE" | "ACTIVE";
    clinicianDid: string;
    compactStates: string[];
    homeState?: string | undefined;
    metadata?: Record<string, any> | undefined;
    licenseType?: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC" | undefined;
    licenseData?: {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        isPrimary: boolean;
        licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
        expirationDate?: string | Date | undefined;
    }[] | undefined;
}, {
    clinicianDid: string;
    status?: "NOT_ELIGIBLE" | "ELIGIBLE" | "ACTIVE" | undefined;
    homeState?: string | undefined;
    compactStates?: string[] | undefined;
    metadata?: Record<string, any> | undefined;
    licenseType?: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC" | undefined;
    licenseData?: {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        licenseType: "LPC" | "LPCC" | "LMHC" | "LCMHC" | "LCPC";
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
}>;
export type CounselingCompactData = z.infer<typeof CounselingCompactSchema>;
export declare const COUNSELING_COMPACT_STATES: readonly ["AL", "AR", "CO", "DE", "FL", "GA", "ID", "IL", "KS", "KY", "MD", "MS", "MO", "NE", "NH", "NC", "OH", "OK", "SC", "TN", "TX", "UT", "VA", "WV", "WI"];
export type CounselingCompactState = typeof COUNSELING_COMPACT_STATES[number];
export interface CounselingCompactEligibilityRequirements {
    hasActiveLicense: boolean;
    homeStateIsCompactMember: boolean;
    hasMastersDegree: boolean;
    hasRequiredExperience: boolean;
    hasPassedNationalExam: boolean;
    noDisciplinaryActions: boolean;
    backgroundCheckCompleted: boolean;
}
export declare function validateCounselingCompact(data: unknown): CounselingCompactData;
export declare function isCounselingCompactState(state: string): state is CounselingCompactState;
export interface PrivilegeToPractice {
    state: string;
    issuedDate: Date;
    expirationDate?: Date;
    renewalRequired: boolean;
    status: 'active' | 'inactive' | 'expired' | 'suspended';
}
