"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandSchemas = exports.ExportNcqaCapsuleCommand = exports.RevokeTrustCommand = exports.IssueCredentialCommand = exports.VerifyNpiCommand = void 0;
const zod_1 = require("zod");
exports.VerifyNpiCommand = zod_1.z.object({
    npi: zod_1.z.string().min(10).max(10).describe("The 10-digit National Provider Identifier to verify"),
});
exports.IssueCredentialCommand = zod_1.z.object({
    npi: zod_1.z.string().min(10).max(10).describe("The target NPI for the new credential"),
    type: zod_1.z.string().describe("The credential type (e.g., 'StateLicense', 'BoardCertification')"),
    issuer: zod_1.z.string().describe("The issuing authority"),
});
exports.RevokeTrustCommand = zod_1.z.object({
    npi: zod_1.z.string().min(10).max(10).describe("The target NPI"),
    reason: zod_1.z.string().min(5).describe("A detailed reason for the trust revocation"),
});
exports.ExportNcqaCapsuleCommand = zod_1.z.object({
    npi: zod_1.z.string().min(10).max(10).describe("The target NPI for the NCQA export"),
    destination: zod_1.z.string().optional().describe("An optional destination for the export (e.g., an email address or system identifier)"),
});
exports.CommandSchemas = {
    VerifyNpiCommand: exports.VerifyNpiCommand,
    IssueCredentialCommand: exports.IssueCredentialCommand,
    RevokeTrustCommand: exports.RevokeTrustCommand,
    ExportNcqaCapsuleCommand: exports.ExportNcqaCapsuleCommand,
};
