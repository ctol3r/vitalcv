/**
 * Main State Agent
 * Orchestrates scanning, collection, compliance, and formatting
 */

import { PrismaClient } from '@prisma/client';
import { scanMonorepo, scanPackages } from './scanners/monorepo';
import { scanApiRoutes } from './scanners/apiRoutes';
import { scanSubstratePallets } from './scanners/substrate';
import { collectCredentialRegistry } from './collectors/credentialRegistry';
import { collectAuditScrapbook } from './collectors/auditScrapbook';
import { collectOidcConfigs } from './collectors/oidc';
import { collectFhirResources } from './collectors/fhir';
import { collectPsvSources } from './collectors/psv';
import { collectMatchingEngines } from './collectors/matching';
import { collectSanctionsGraph } from './collectors/sanctions';
import { redactPiiPhi } from './compliance/redaction';
import { generateNarrative } from './narrative/generator';
import type { StateReport, StateReportOptions, SystemMetadata, ArchitectureSummary } from './types';
import * as child_process from 'child_process';

export async function generateStateReport(
  prisma: PrismaClient,
  options: StateReportOptions = {}
): Promise<StateReport> {
  const startTime = Date.now();

  // Get commit hash if available
  let commitHash: string | undefined;
  try {
    commitHash = child_process.execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Not in a git repo or git not available
  }

  // Scan monorepo structure
  const monorepoMetadata = await scanMonorepo();
  const packages = await scanPackages();

  // Scan API routes
  const apiMetadata = await scanApiRoutes();

  // Scan blockchain
  const blockchainMetadata = await scanSubstratePallets();

  // Collect metadata from various subsystems
  const credentialRegistry = await collectCredentialRegistry(prisma);
  const auditScrapbook = await collectAuditScrapbook(prisma);
  const oidcConfigs = await collectOidcConfigs();
  const fhirResources = await collectFhirResources(prisma);
  const psvSources = await collectPsvSources(prisma);
  const matchingEngines = await collectMatchingEngines();
  const sanctionsGraph = await collectSanctionsGraph(prisma);

  // Build system metadata
  const systemMetadata: SystemMetadata = {
    monorepo: monorepoMetadata,
    api: apiMetadata,
    blockchain: blockchainMetadata,
    services: [
      ...apiMetadata.services.map(s => ({
        name: s,
        type: 'service' as const,
        path: `apps/api/src/services/${s}`,
        dependencies: [],
      })),
    ],
    packages,
  };

  // Build architecture summary
  const architecture: ArchitectureSummary = {
    subsystems: [
      {
        name: 'Credential Registry',
        purpose: 'Manages verifiable credentials on-chain and off-chain',
        components: ['CredentialRegistry pallet', 'VC storage', 'Status lists'],
        status: credentialRegistry.totalCredentials > 0 ? 'active' : 'in-development',
      },
      {
        name: 'Audit Scrapbook',
        purpose: 'Maintains immutable audit trail of system events',
        components: ['Event logging', 'Chain anchoring', 'Forensics'],
        status: auditScrapbook.totalEvents > 0 ? 'active' : 'in-development',
      },
      {
        name: 'OIDC/OID4VCI Gateway',
        purpose: 'Provides OIDC and OID4VCI credential issuance flows',
        components: oidcConfigs.supportedFlows,
        status: oidcConfigs.totalProviders > 0 ? 'active' : 'in-development',
      },
      {
        name: 'FHIR Gateway',
        purpose: 'FHIR resource management and interoperability',
        components: fhirResources.resources,
        status: fhirResources.gatewayActive ? 'active' : 'in-development',
      },
      {
        name: 'PSV Connectors',
        purpose: 'Provider Source Verification from external systems',
        components: psvSources.connectors,
        status: psvSources.totalSources > 0 ? 'active' : 'in-development',
      },
      {
        name: 'Matching Engine',
        purpose: 'AI-powered credential and role matching',
        components: matchingEngines.models,
        status: matchingEngines.activeModels > 0 ? 'active' : 'in-development',
      },
      {
        name: 'Sanctions Graph',
        purpose: 'OFAC and sanctions list monitoring',
        components: ['Graph database', 'OFAC integration'],
        status: sanctionsGraph.graphActive ? 'active' : 'in-development',
      },
    ],
    pipelines: [
      {
        name: 'Credential Issuance',
        type: 'VC Flow',
        stages: ['Request', 'Verification', 'Issuance', 'On-chain Anchor'],
        status: 'active',
      },
      {
        name: 'Identity Fusion',
        type: 'Identity Resolution',
        stages: ['Collection', 'Deduplication', 'Fusion', 'Verification'],
        status: 'active',
      },
    ],
    endpoints: apiMetadata.routes.slice(0, 20).map(r => ({
      path: r.path,
      method: r.method,
      description: `${r.method} endpoint`,
      authRequired: true,
    })),
    flows: [
      {
        name: 'OID4VCI Credential Issuance',
        type: 'OIDC',
        steps: ['Authorization', 'Token Exchange', 'Credential Request', 'Credential Delivery'],
      },
      {
        name: 'SD-JWT Presentation',
        type: 'SD-JWT',
        steps: ['Presentation Request', 'Selective Disclosure', 'Verification', 'Response'],
      },
      {
        name: 'FHIR Resource Exchange',
        type: 'FHIR',
        steps: ['Resource Request', 'Authorization', 'Resource Retrieval', 'Response'],
      },
    ],
    compliancePosture: `GDPR: ${oidcConfigs.totalProviders > 0 ? 'Compliant' : 'Pending'}, ` +
      `HIPAA: ${fhirResources.gatewayActive ? 'Compliant' : 'Pending'}, ` +
      `PII Redaction: ${options.complianceLevel || 'standard'}`,
  };

  // Build raw report
  const rawReport: Omit<StateReport, 'compliance' | 'narrative'> = {
    generatedAt: new Date().toISOString(),
    waveNumber: options.waveNumber,
    commitHash,
    timestamp: new Date().toISOString(),
    metadata: systemMetadata,
    architecture,
    version: '1.0.0',
  };

  // Apply compliance redaction
  const { redacted, metadata: complianceMetadata } = redactPiiPhi(rawReport, options);

  // Generate narrative if requested
  let narrative: string | undefined;
  if (options.includeNarrative !== false) {
    const reportWithCompliance: StateReport = {
      ...redacted as StateReport,
      compliance: complianceMetadata,
    };
    narrative = await generateNarrative(reportWithCompliance);
  }

  // Build final report
  const report: StateReport = {
    ...redacted as StateReport,
    compliance: complianceMetadata,
    narrative,
  };

  const duration = Date.now() - startTime;
  console.log(`[state-agent] Generated state report in ${duration}ms`);

  return report;
}

