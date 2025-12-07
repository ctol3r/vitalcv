/**
 * AI Narrative Layer
 * Converts structured system data into coherent onboarding narrative
 */

import type { StateReport } from '../types';

export async function generateNarrative(report: StateReport): Promise<string> {
  const sections: string[] = [];

  // Introduction
  sections.push(`# VitalCV System Intelligence Report`);
  sections.push('');
  sections.push(`This report provides a comprehensive overview of the VitalCV platform architecture, ` +
    `active modules, and current system state. Generated at ${report.generatedAt} for AI agent onboarding.`);
  sections.push('');

  // Purpose
  sections.push('## System Purpose');
  sections.push('');
  sections.push(`VitalCV is a comprehensive healthcare workforce credentialing and identity platform ` +
    `that leverages verifiable credentials (VCs), blockchain technology, and AI-powered matching ` +
    `to streamline clinician onboarding, credentialing, and compliance management.`);
  sections.push('');

  // Architecture Overview
  sections.push('## Architecture Overview');
  sections.push('');
  sections.push(`The system is built as a monorepo with ${report.metadata.monorepo.totalPackages} packages ` +
    `and ${report.metadata.monorepo.totalApps} applications. The core API exposes ${report.metadata.api.totalRoutes} ` +
    `endpoints across multiple domains including credentialing, identity, compliance, and workforce management.`);
  sections.push('');

  // Key Subsystems
  if (report.architecture && report.architecture.subsystems.length > 0) {
    sections.push('## Key Subsystems');
    sections.push('');
    for (const subsystem of report.architecture.subsystems.slice(0, 10)) {
      sections.push(`### ${subsystem.name}`);
      sections.push(`${subsystem.purpose}`);
      if (subsystem.status !== 'active') {
        sections.push(`**Status:** ${subsystem.status}`);
      }
      sections.push('');
    }
  }

  // Active Modules
  sections.push('## Active Modules');
  sections.push('');
  const activeServices = report.metadata.services.filter(s => s.type === 'service').slice(0, 15);
  if (activeServices.length > 0) {
    sections.push(`The platform includes ${activeServices.length} active services including:`);
    sections.push('');
    for (const service of activeServices) {
      sections.push(`- **${service.name}**: ${service.path}`);
    }
    sections.push('');
  }

  // Blockchain Integration
  if (report.metadata.blockchain.runtime !== 'unknown') {
    sections.push('## Blockchain Integration');
    sections.push('');
    sections.push(`The system integrates with a ${report.metadata.blockchain.runtime} blockchain runtime ` +
      `with ${report.metadata.blockchain.validators} validators. `);
    if (report.metadata.blockchain.pallets.length > 0) {
      sections.push(`Active pallets include: ${report.metadata.blockchain.pallets.slice(0, 5).join(', ')}.`);
    }
    sections.push('');
  }

  // Credential Flows
  if (report.architecture && report.architecture.flows.length > 0) {
    sections.push('## Credential Flows');
    sections.push('');
    for (const flow of report.architecture.flows.slice(0, 5)) {
      sections.push(`- **${flow.name}** (${flow.type}): ${flow.steps.join(' → ')}`);
    }
    sections.push('');
  }

  // Known Gaps & Priorities
  sections.push('## System Status & Priorities');
  sections.push('');
  sections.push(`The system is actively maintained with ${report.metadata.api.totalRoutes} API endpoints ` +
    `and ${report.metadata.services.length} services. Compliance measures are in place with ` +
    `${report.compliance.gdprCompliant ? 'GDPR' : ''} ${report.compliance.hipaaCompliant ? 'HIPAA' : ''} ` +
    `compliance ${report.compliance.gdprCompliant || report.compliance.hipaaCompliant ? 'enabled' : 'pending'}.`);
  sections.push('');

  // Task Queues
  sections.push('## Recommended Task Queues');
  sections.push('');
  sections.push(`1. **System Monitoring**: Monitor API health, blockchain connectivity, and service status`);
  sections.push(`2. **Compliance Auditing**: Regular audits of PII/PHI handling and data retention policies`);
  sections.push(`3. **Performance Optimization**: Review and optimize high-traffic endpoints and database queries`);
  sections.push(`4. **Documentation Updates**: Keep architecture documentation in sync with codebase changes`);
  sections.push(`5. **Security Hardening**: Regular security reviews and dependency updates`);
  sections.push('');

  // Compliance Notes
  if (report.compliance.pouConstraints.length > 0) {
    sections.push('## Compliance Constraints');
    sections.push('');
    sections.push(`This report has been generated with the following constraints:`);
    for (const constraint of report.compliance.pouConstraints) {
      sections.push(`- ${constraint}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

