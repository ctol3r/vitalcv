/**
 * B138A-COMPACT-008: Unified CompactsStatus Model
 *
 * Defines the unified data model for all compact eligibility statuses.
 * This model aggregates IMLC, PSYPACT, and Counseling Compact eligibility.
 */
import { z } from 'zod';
import type { IMLCStatus } from './IMLCEligibility.js';
import type { PSYPACTStatus } from './Psycompact.js';
import type { CounselingCompactStatus } from './CounselingCompact.js';
export declare const CompactsStatusSchema: z.ZodObject<{
    clinicianDid: z.ZodString;
    imlcStatus: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "LICENSED"]>>;
    imlcHomeState: z.ZodOptional<z.ZodString>;
    imlcCompactStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    psypactStatus: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "E_PASS", "ACTIVE"]>>;
    psypactStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    counselingStatus: z.ZodDefault<z.ZodEnum<["NOT_ELIGIBLE", "ELIGIBLE", "ACTIVE"]>>;
    counselingHomeState: z.ZodOptional<z.ZodString>;
    counselingStates: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lastComputedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    nextRefreshAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    vcHash: z.ZodOptional<z.ZodString>;
    vcCredentialId: z.ZodOptional<z.ZodString>;
    anchoredTxHash: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    clinicianDid: string;
    imlcStatus: "NOT_ELIGIBLE" | "ELIGIBLE" | "LICENSED";
    imlcCompactStates: string[];
    psypactStatus: "NOT_ELIGIBLE" | "ELIGIBLE" | "E_PASS" | "ACTIVE";
    psypactStates: string[];
    counselingStatus: "NOT_ELIGIBLE" | "ELIGIBLE" | "ACTIVE";
    counselingStates: string[];
    metadata?: Record<string, any> | undefined;
    imlcHomeState?: string | undefined;
    counselingHomeState?: string | undefined;
    lastComputedAt?: string | Date | undefined;
    nextRefreshAt?: string | Date | undefined;
    vcHash?: string | undefined;
    vcCredentialId?: string | undefined;
    anchoredTxHash?: string | undefined;
}, {
    clinicianDid: string;
    metadata?: Record<string, any> | undefined;
    imlcStatus?: "NOT_ELIGIBLE" | "ELIGIBLE" | "LICENSED" | undefined;
    imlcHomeState?: string | undefined;
    imlcCompactStates?: string[] | undefined;
    psypactStatus?: "NOT_ELIGIBLE" | "ELIGIBLE" | "E_PASS" | "ACTIVE" | undefined;
    psypactStates?: string[] | undefined;
    counselingStatus?: "NOT_ELIGIBLE" | "ELIGIBLE" | "ACTIVE" | undefined;
    counselingHomeState?: string | undefined;
    counselingStates?: string[] | undefined;
    lastComputedAt?: string | Date | undefined;
    nextRefreshAt?: string | Date | undefined;
    vcHash?: string | undefined;
    vcCredentialId?: string | undefined;
    anchoredTxHash?: string | undefined;
}>;
export type CompactsStatusData = z.infer<typeof CompactsStatusSchema>;
export interface FullCompactsStatus {
    clinicianDid: string;
    imlc: {
        status: IMLCStatus;
        homeState?: string;
        compactStates: string[];
        lastCheckedAt: Date;
    };
    psypact: {
        status: PSYPACTStatus;
        participatingStates: string[];
        ePassportId?: string;
        primaryState?: string;
        lastCheckedAt: Date;
    };
    counseling: {
        status: CounselingCompactStatus;
        homeState?: string;
        compactStates: string[];
        lastCheckedAt: Date;
    };
    unified: {
        lastComputedAt: Date;
        nextRefreshAt?: Date;
        vcHash?: string;
        vcCredentialId?: string;
        anchoredTxHash?: string;
    };
}
export interface CompactsEligibilitySummary {
    clinicianDid: string;
    hasAnyCompactEligibility: boolean;
    imlcEligible: boolean;
    psypactEligible: boolean;
    counselingEligible: boolean;
    totalEligibleStates: string[];
    compactTypes: string[];
}
export declare function validateCompactsStatus(data: unknown): CompactsStatusData;
export declare function computeEligibilitySummary(status: CompactsStatusData): CompactsEligibilitySummary;
export declare const COMPACTS_STATUS_CACHE_TTL_MS: number;
export declare function isRefreshNeeded(status: CompactsStatusData): boolean;
