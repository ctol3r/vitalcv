/**
 * B138A-PSY-004: PSYPACT (Psychology Interjurisdictional Compact) Model
 *
 * Defines the data model and validation for PSYPACT eligibility and participation.
 * PSYPACT allows psychologists to practice telepsychology across state lines.
 */
import { z } from 'zod';
export type PSYPACTStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'E_PASS' | 'ACTIVE';
export declare const PsychologyLicenseSchema: z.ZodObject<{
    state: z.ZodString;
    licenseNumber: z.ZodString;
    licenseType: z.ZodString;
    issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "expired" | "inactive" | "revoked";
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    isPrimary: boolean;
    licenseType: string;
    expirationDate?: string | Date | undefined;
}, {
    status: "active" | "expired" | "inactive" | "revoked";
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    licenseType: string;
    expirationDate?: string | Date | undefined;
    isPrimary?: boolean | undefined;
}>;
export type PsychologyLicense = z.infer<typeof PsychologyLicenseSchema>;
export declare const PSYPACTCompactSchema: z.ZodObject<{
    clinicianDid: z.ZodString;
    participatingStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "E_PASS", "ACTIVE"]>>;
    ePassportId: z.ZodOptional<z.ZodString>;
    primaryState: z.ZodOptional<z.ZodString>;
    licenseData: z.ZodOptional<z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        licenseNumber: z.ZodString;
        licenseType: z.ZodString;
        issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "expired" | "inactive" | "revoked";
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        isPrimary: boolean;
        licenseType: string;
        expirationDate?: string | Date | undefined;
    }, {
        status: "active" | "expired" | "inactive" | "revoked";
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        licenseType: string;
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status: "NOT_ELIGIBLE" | "ELIGIBLE" | "E_PASS" | "ACTIVE";
    clinicianDid: string;
    participatingStates: string[];
    metadata?: Record<string, any> | undefined;
    ePassportId?: string | undefined;
    primaryState?: string | undefined;
    licenseData?: {
        status: "active" | "expired" | "inactive" | "revoked";
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        isPrimary: boolean;
        licenseType: string;
        expirationDate?: string | Date | undefined;
    }[] | undefined;
}, {
    clinicianDid: string;
    status?: "NOT_ELIGIBLE" | "ELIGIBLE" | "E_PASS" | "ACTIVE" | undefined;
    metadata?: Record<string, any> | undefined;
    participatingStates?: string[] | undefined;
    ePassportId?: string | undefined;
    primaryState?: string | undefined;
    licenseData?: {
        status: "active" | "expired" | "inactive" | "revoked";
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        licenseType: string;
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
}>;
export type PSYPACTCompactData = z.infer<typeof PSYPACTCompactSchema>;
export declare const PSYPACT_STATES: readonly ["AL", "AZ", "AR", "CO", "CT", "DE", "DC", "GA", "ID", "IL", "IN", "KS", "KY", "ME", "MD", "MI", "MN", "MS", "MO", "NE", "NV", "NH", "NJ", "NC", "OH", "OK", "PA", "TN", "TX", "UT", "VA", "WA", "WV", "WI"];
export type PSYPACTState = typeof PSYPACT_STATES[number];
export interface PSYPACTEligibilityRequirements {
    hasActiveLicense: boolean;
    homeStateIsPSYPACTMember: boolean;
    hasDoctoralDegree: boolean;
    hasPassedEPPP: boolean;
    noDisciplinaryActions: boolean;
    meetsExperienceRequirement: boolean;
}
export declare function validatePSYPACTCompact(data: unknown): PSYPACTCompactData;
export declare function isPSYPACTState(state: string): state is PSYPACTState;
export declare enum EPassportStatus {
    NOT_ENROLLED = "NOT_ENROLLED",
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    REVOKED = "REVOKED"
}
export interface APIT {
    state: string;
    issuedDate: Date;
    expirationDate?: Date;
    status: 'active' | 'inactive' | 'expired';
}
export interface TAP {
    state: string;
    issuedDate: Date;
    expirationDate: Date;
    daysRemaining: number;
    status: 'active' | 'expired';
}
