import { z } from 'zod';

export const VerifyNpiCommand = z.object({
  npi: z.string().min(10).max(10).describe("The 10-digit National Provider Identifier to verify"),
});
export type VerifyNpiCommandParams = z.infer<typeof VerifyNpiCommand>;

export const IssueCredentialCommand = z.object({
  npi: z.string().min(10).max(10).describe("The target NPI for the new credential"),
  type: z.string().describe("The credential type (e.g., 'StateLicense', 'BoardCertification')"),
  issuer: z.string().describe("The issuing authority"),
});
export type IssueCredentialCommandParams = z.infer<typeof IssueCredentialCommand>;

export const RevokeTrustCommand = z.object({
  npi: z.string().min(10).max(10).describe("The target NPI"),
  reason: z.string().min(5).describe("A detailed reason for the trust revocation"),
});
export type RevokeTrustCommandParams = z.infer<typeof RevokeTrustCommand>;

export const ExportNcqaCapsuleCommand = z.object({
  npi: z.string().min(10).max(10).describe("The target NPI for the NCQA export"),
  destination: z.string().optional().describe("An optional destination for the export (e.g., an email address or system identifier)"),
});
export type ExportNcqaCapsuleCommandParams = z.infer<typeof ExportNcqaCapsuleCommand>;

export const CommandSchemas = {
  VerifyNpiCommand,
  IssueCredentialCommand,
  RevokeTrustCommand,
  ExportNcqaCapsuleCommand,
} as const;

export type CommandName = keyof typeof CommandSchemas;
