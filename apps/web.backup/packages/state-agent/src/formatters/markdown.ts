/**
 * Markdown formatter for state reports
 */

import type { StateReport } from '../types';

export function formatAsMarkdown(report: StateReport): string {
  const lines: string[] = [];

  lines.push('# VitalCV System State Report');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  if (report.waveNumber) {
    lines.push(`**Wave:** ${report.waveNumber}`);
  }
  if (report.commitHash) {
    lines.push(`**Commit:** ${report.commitHash.substring(0, 7)}`);
  }
  lines.push(`**Version:** ${report.version}`);
  lines.push('');

  // Compliance Status
  lines.push('## Compliance Status');
  lines.push('');
  lines.push(`- **Redaction Applied:** ${report.compliance.redactionApplied ? '✅' : '❌'}`);
  lines.push(`- **PII Detected:** ${report.compliance.piiDetected ? '⚠️' : '✅'}`);
  lines.push(`- **PHI Detected:** ${report.compliance.phiDetected ? '⚠️' : '✅'}`);
  lines.push(`- **GDPR Compliant:** ${report.compliance.gdprCompliant ? '✅' : '❌'}`);
  lines.push(`- **HIPAA Compliant:** ${report.compliance.hipaaCompliant ? '✅' : '❌'}`);
  if (report.compliance.pouConstraints.length > 0) {
    lines.push(`- **POU Constraints:** ${report.compliance.pouConstraints.join(', ')}`);
  }
  lines.push('');

  // Monorepo Overview
  lines.push('## Monorepo Overview');
  lines.push('');
  lines.push(`- **Root Package:** ${report.metadata.monorepo.rootPackage.name} v${report.metadata.monorepo.rootPackage.version}`);
  lines.push(`- **Total Packages:** ${report.metadata.monorepo.totalPackages}`);
  lines.push(`- **Total Apps:** ${report.metadata.monorepo.totalApps}`);
  lines.push(`- **Workspaces:** ${report.metadata.monorepo.workspaces.length}`);
  lines.push('');

  // API Overview
  lines.push('## API Overview');
  lines.push('');
  lines.push(`- **Total Routes:** ${report.metadata.api.totalRoutes}`);
  lines.push(`- **Middleware:** ${report.metadata.api.middleware.length} modules`);
  lines.push(`- **Services:** ${report.metadata.api.services.length} services`);
  lines.push('');

  if (report.metadata.api.routes.length > 0) {
    lines.push('### Key Routes');
    lines.push('');
    const routeGroups = new Map<string, string[]>();
    for (const route of report.metadata.api.routes.slice(0, 50)) {
      const basePath = route.path.split('/')[1] || 'root';
      if (!routeGroups.has(basePath)) {
        routeGroups.set(basePath, []);
      }
      routeGroups.get(basePath)!.push(`- \`${route.method}\` ${route.path}`);
    }
    for (const [group, routes] of routeGroups.entries()) {
      lines.push(`#### ${group}`);
      lines.push('');
      lines.push(...routes);
      lines.push('');
    }
  }

  // Blockchain Overview
  lines.push('## Blockchain Overview');
  lines.push('');
  lines.push(`- **Runtime:** ${report.metadata.blockchain.runtime}`);
  lines.push(`- **Validators:** ${report.metadata.blockchain.validators}`);
  if (report.metadata.blockchain.chainId) {
    lines.push(`- **Chain ID:** ${report.metadata.blockchain.chainId}`);
  }
  if (report.metadata.blockchain.pallets.length > 0) {
    lines.push(`- **Pallets:** ${report.metadata.blockchain.pallets.join(', ')}`);
  }
  lines.push('');

  // Architecture Summary
  if (report.architecture) {
    lines.push('## Architecture Summary');
    lines.push('');

    if (report.architecture.subsystems.length > 0) {
      lines.push('### Subsystems');
      lines.push('');
      for (const subsystem of report.architecture.subsystems) {
        lines.push(`#### ${subsystem.name}`);
        lines.push(`- **Purpose:** ${subsystem.purpose}`);
        lines.push(`- **Status:** ${subsystem.status}`);
        lines.push(`- **Components:** ${subsystem.components.join(', ')}`);
        lines.push('');
      }
    }

    if (report.architecture.pipelines.length > 0) {
      lines.push('### Active Pipelines');
      lines.push('');
      for (const pipeline of report.architecture.pipelines) {
        lines.push(`- **${pipeline.name}** (${pipeline.type}) - ${pipeline.status}`);
        lines.push(`  - Stages: ${pipeline.stages.join(' → ')}`);
        lines.push('');
      }
    }

    if (report.architecture.flows.length > 0) {
      lines.push('### Credential Flows');
      lines.push('');
      for (const flow of report.architecture.flows) {
        lines.push(`- **${flow.name}** (${flow.type})`);
        lines.push(`  - Steps: ${flow.steps.join(' → ')}`);
        lines.push('');
      }
    }

    lines.push(`### Compliance Posture`);
    lines.push('');
    lines.push(report.architecture.compliancePosture);
    lines.push('');
  }

  // Narrative
  if (report.narrative) {
    lines.push('## AI Onboarding Narrative');
    lines.push('');
    lines.push(report.narrative);
    lines.push('');
  }

  // Packages
  if (report.metadata.packages.length > 0) {
    lines.push('## Packages');
    lines.push('');
    for (const pkg of report.metadata.packages.slice(0, 20)) {
      lines.push(`- **${pkg.name}** v${pkg.version} (${pkg.dependencies.length} deps)`);
    }
    if (report.metadata.packages.length > 20) {
      lines.push(`- ... and ${report.metadata.packages.length - 20} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

