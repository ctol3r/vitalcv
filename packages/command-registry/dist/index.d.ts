import { z } from 'zod';
export declare const VerifyNpiCommand: z.ZodObject<{
    npi: z.ZodString;
}, "strip", z.ZodTypeAny, {
    npi: string;
}, {
    npi: string;
}>;
export type VerifyNpiCommandParams = z.infer<typeof VerifyNpiCommand>;
export declare const IssueCredentialCommand: z.ZodObject<{
    npi: z.ZodString;
    type: z.ZodString;
    issuer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    npi: string;
    type: string;
    issuer: string;
}, {
    npi: string;
    type: string;
    issuer: string;
}>;
export type IssueCredentialCommandParams = z.infer<typeof IssueCredentialCommand>;
export declare const RevokeTrustCommand: z.ZodObject<{
    npi: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    npi: string;
    reason: string;
}, {
    npi: string;
    reason: string;
}>;
export type RevokeTrustCommandParams = z.infer<typeof RevokeTrustCommand>;
export declare const ExportNcqaCapsuleCommand: z.ZodObject<{
    npi: z.ZodString;
    destination: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    npi: string;
    destination?: string | undefined;
}, {
    npi: string;
    destination?: string | undefined;
}>;
export type ExportNcqaCapsuleCommandParams = z.infer<typeof ExportNcqaCapsuleCommand>;
export declare const CommandSchemas: {
    readonly VerifyNpiCommand: z.ZodObject<{
        npi: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        npi: string;
    }, {
        npi: string;
    }>;
    readonly IssueCredentialCommand: z.ZodObject<{
        npi: z.ZodString;
        type: z.ZodString;
        issuer: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        npi: string;
        type: string;
        issuer: string;
    }, {
        npi: string;
        type: string;
        issuer: string;
    }>;
    readonly RevokeTrustCommand: z.ZodObject<{
        npi: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        npi: string;
        reason: string;
    }, {
        npi: string;
        reason: string;
    }>;
    readonly ExportNcqaCapsuleCommand: z.ZodObject<{
        npi: z.ZodString;
        destination: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        npi: string;
        destination?: string | undefined;
    }, {
        npi: string;
        destination?: string | undefined;
    }>;
};
export type CommandName = keyof typeof CommandSchemas;
