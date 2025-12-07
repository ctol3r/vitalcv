/**
 * B227B-DEV-006: ModuleScannerService
 *
 * Performs static analysis and vulnerability scanning on uploaded modules:
 * - Known CVEs scanning
 * - Package audit
 * - Produces detailed report
 * - Fails approval on critical issues
 */

import { PrismaClient } from '@prisma/client';

export interface Vulnerability {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  cveId?: string;
  packageName?: string;
  packageVersion?: string;
  affectedVersions?: string[];
  fixedVersion?: string;
  references?: string[];
  detectedAt: Date;
}

export interface PackageAuditResult {
  packageName: string;
  version: string;
  vulnerabilities: Vulnerability[];
}

export interface ScanReport {
  moduleId: string;
  scanId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  packages: PackageAuditResult[];
  vulnerabilities: Vulnerability[];
  approvalBlocked: boolean;
  approvalBlockReason?: string;
  metadata?: Record<string, any>;
}

export interface ModuleScanInput {
  moduleId: string;
  modulePath?: string; // Path to module files/archive
  packageManifest?: Record<string, any>; // package.json or equivalent
  sourceCodeHash?: string; // Hash of source code for deduplication
}

export class ModuleScannerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Scan module for vulnerabilities and known CVEs
   */
  async scanModule(input: ModuleScanInput): Promise<ScanReport> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    // Initialize report
    const report: ScanReport = {
      moduleId: input.moduleId,
      scanId,
      status: 'RUNNING',
      startedAt,
      totalVulnerabilities: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      packages: [],
      vulnerabilities: [],
      approvalBlocked: false,
    };

    try {
      // Step 1: Extract package dependencies from manifest
      const dependencies = this.extractDependencies(input.packageManifest || {});

      // Step 2: Audit each package for known vulnerabilities
      const packageAudits: PackageAuditResult[] = [];
      const allVulnerabilities: Vulnerability[] = [];

      for (const [packageName, version] of Object.entries(dependencies)) {
        const auditResult = await this.auditPackage(packageName, version as string);
        packageAudits.push(auditResult);
        allVulnerabilities.push(...auditResult.vulnerabilities);
      }

      // Step 3: Perform static analysis on source code (if available)
      if (input.modulePath) {
        const staticAnalysisVulns = await this.performStaticAnalysis(input.modulePath);
        allVulnerabilities.push(...staticAnalysisVulns);
      }

      // Step 4: Aggregate results
      report.packages = packageAudits;
      report.vulnerabilities = allVulnerabilities;
      report.totalVulnerabilities = allVulnerabilities.length;
      report.criticalCount = allVulnerabilities.filter((v) => v.severity === 'CRITICAL').length;
      report.highCount = allVulnerabilities.filter((v) => v.severity === 'HIGH').length;
      report.mediumCount = allVulnerabilities.filter((v) => v.severity === 'MEDIUM').length;
      report.lowCount = allVulnerabilities.filter((v) => v.severity === 'LOW').length;

      // Step 5: Determine if approval should be blocked
      const criticalOrHighVulns = report.criticalCount + report.highCount;
      if (criticalOrHighVulns > 0) {
        report.approvalBlocked = true;
        report.approvalBlockReason = `Found ${criticalOrHighVulns} critical or high severity vulnerabilities`;
      }

      report.status = 'COMPLETED';
      report.completedAt = new Date();

      return report;
    } catch (error: any) {
      report.status = 'FAILED';
      report.completedAt = new Date();
      report.metadata = {
        error: error.message,
        stack: error.stack,
      };
      throw error;
    }
  }

  /**
   * Extract dependencies from package manifest
   */
  private extractDependencies(manifest: Record<string, any>): Record<string, string> {
    const dependencies: Record<string, string> = {};

    // Extract from dependencies, devDependencies, peerDependencies
    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];

    for (const depType of depTypes) {
      if (manifest[depType] && typeof manifest[depType] === 'object') {
        Object.assign(dependencies, manifest[depType]);
      }
    }

    return dependencies;
  }

  /**
   * Audit a single package for known vulnerabilities
   * In production, this would integrate with npm audit, Snyk, or similar services
   */
  private async auditPackage(packageName: string, version: string): Promise<PackageAuditResult> {
    const vulnerabilities: Vulnerability[] = [];

    // Mock implementation - in production, this would:
    // 1. Query npm audit API
    // 2. Query Snyk API
    // 3. Query CVE databases
    // 4. Check against known vulnerability databases

    // Example: Check for known vulnerable packages
    const knownVulnerabilities = this.getKnownVulnerabilities(packageName, version);
    vulnerabilities.push(...knownVulnerabilities);

    return {
      packageName,
      version,
      vulnerabilities,
    };
  }

  /**
   * Get known vulnerabilities for a package (mock implementation)
   * In production, this would query real CVE databases
   */
  private getKnownVulnerabilities(packageName: string, version: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    // Example: Known vulnerable packages (mock data)
    const vulnerablePackages: Record<string, Array<{ version: string; cve: string; severity: Vulnerability['severity'] }>> = {
      'lodash': [
        { version: '<4.17.12', cve: 'CVE-2019-10744', severity: 'HIGH' },
        { version: '<4.17.21', cve: 'CVE-2021-23337', severity: 'HIGH' },
      ],
      'express': [
        { version: '<4.17.1', cve: 'CVE-2022-24999', severity: 'CRITICAL' },
      ],
      'axios': [
        { version: '<0.21.1', cve: 'CVE-2021-3749', severity: 'MEDIUM' },
      ],
    };

    const packageVulns = vulnerablePackages[packageName.toLowerCase()];
    if (packageVulns) {
      for (const vuln of packageVulns) {
        if (this.isVersionAffected(version, vuln.version)) {
          vulnerabilities.push({
            id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            severity: vuln.severity,
            title: `Vulnerability in ${packageName}`,
            description: `Known vulnerability ${vuln.cve} affects ${packageName} version ${version}`,
            cveId: vuln.cve,
            packageName,
            packageVersion: version,
            affectedVersions: [vuln.version],
            detectedAt: new Date(),
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Check if a version is affected by a vulnerability range
   */
  private isVersionAffected(version: string, affectedRange: string): boolean {
    // Simplified version check - in production, use semver library
    if (affectedRange.startsWith('<')) {
      const threshold = affectedRange.substring(1);
      return this.compareVersions(version, threshold) < 0;
    }
    return false;
  }

  /**
   * Compare two version strings (simplified)
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  }

  /**
   * Perform static analysis on source code
   */
  private async performStaticAnalysis(modulePath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Mock implementation - in production, this would:
    // 1. Use ESLint with security plugins
    // 2. Use SonarQube
    // 3. Use CodeQL
    // 4. Check for common security anti-patterns

    // Example checks:
    // - Hardcoded secrets
    // - SQL injection patterns
    // - XSS vulnerabilities
    // - Insecure random number generation
    // - Missing input validation

    return vulnerabilities;
  }

  /**
   * Get scan report by scan ID
   */
  async getScanReport(scanId: string): Promise<ScanReport | null> {
    // In production, this would fetch from database
    // For now, return null as reports are not persisted
    return null;
  }

  /**
   * Get latest scan report for a module
   */
  async getLatestScanReport(moduleId: string): Promise<ScanReport | null> {
    // In production, this would fetch from database
    return null;
  }
}

