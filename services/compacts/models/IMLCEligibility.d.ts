/**
 * B138A-IMLC-001: Interstate Medical Licensure Compact (IMLC) Eligibility Model
 *
 * Defines the data model and validation for IMLC eligibility status.
 * IMLC allows physicians to practice across state lines with expedited licensure.
 */
import { z } from 'zod';
export type IMLCStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'LICENSED';
export declare const LicenseHistorySchema: z.ZodObject<{
    state: z.ZodString;
    licenseNumber: z.ZodString;
    issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    disciplinaryActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        date: string | Date;
        description?: string | undefined;
    }, {
        type: string;
        date: string | Date;
        description?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    status: "active" | "inactive" | "expired" | "revoked";
    isPrimary: boolean;
    expirationDate?: string | Date | undefined;
    disciplinaryActions?: {
        type: string;
        date: string | Date;
        description?: string | undefined;
    }[] | undefined;
}, {
    state: string;
    licenseNumber: string;
    issueDate: string | Date;
    status: "active" | "inactive" | "expired" | "revoked";
    expirationDate?: string | Date | undefined;
    isPrimary?: boolean | undefined;
    disciplinaryActions?: {
        type: string;
        date: string | Date;
        description?: string | undefined;
    }[] | undefined;
}>;
export type LicenseHistory = z.infer<typeof LicenseHistorySchema>;
export declare const IMLCEligibilitySchema: z.ZodObject<{
    clinicianDid: z.ZodString;
    homeState: z.ZodString;
    compactStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "LICENSED"]>>;
    licenseHistory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        licenseNumber: z.ZodString;
        issueDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        expirationDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        status: z.ZodEnum<["active", "inactive", "expired", "revoked"]>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
        disciplinaryActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            date: z.ZodUnion<[z.ZodString, z.ZodDate]>;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }, {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        isPrimary: boolean;
        expirationDate?: string | Date | undefined;
        disciplinaryActions?: {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }[] | undefined;
    }, {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
        disciplinaryActions?: {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }[] | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status: "NOT_ELIGIBLE" | "ELIGIBLE" | "LICENSED";
    clinicianDid: string;
    homeState: string;
    compactStates: string[];
    licenseHistory?: {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        isPrimary: boolean;
        expirationDate?: string | Date | undefined;
        disciplinaryActions?: {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }[] | undefined;
    }[] | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    clinicianDid: string;
    homeState: string;
    status?: "NOT_ELIGIBLE" | "ELIGIBLE" | "LICENSED" | undefined;
    compactStates?: string[] | undefined;
    licenseHistory?: {
        state: string;
        licenseNumber: string;
        issueDate: string | Date;
        status: "active" | "inactive" | "expired" | "revoked";
        expirationDate?: string | Date | undefined;
        isPrimary?: boolean | undefined;
        disciplinaryActions?: {
            type: string;
            date: string | Date;
            description?: string | undefined;
        }[] | undefined;
    }[] | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type IMLCEligibilityData = z.infer<typeof IMLCEligibilitySchema>;
export declare const IMLC_STATES: readonly ["AL", "AK", "AZ", "CO", "DC", "FL", "GA", "ID", "IL", "IN", "IA", "KS", "KY", "ME", "MD", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NC", "ND", "OH", "OK", "PA", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
export type IMLCState = typeof IMLC_STATES[number];
export interface IMLCEligibilityRequirements {
    hasUnrestrictedLicense: boolean;
    homeStateIsIMLCMember: boolean;
    noPendingActions: boolean;
    noDisciplinaryHistory: boolean;
    hasMinimumPracticeTime: boolean;
    hasPassedBoardExam: boolean;
}
export declare function validateIMLCEligibility(data: unknown): IMLCEligibilityData;
export declare function isIMLCState(state: string): state is IMLCState;
