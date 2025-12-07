/**
 * B227A-DEV-004: SemanticReleaseIntegration
 *
 * Integrates semantic-release to automate versioning and changelog generation for modules.
 * Updates MarketplaceModule.version automatically on release.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface ReleaseConfig {
  moduleId: string;
  vendorId: string;
  dryRun?: boolean;
  branch?: string;
}

export interface ReleaseResult {
  success: boolean;
  version?: string;
  changelog?: string;
  error?: string;
}

export class SemanticReleaseIntegration {
  constructor(private prisma: PrismaClient) {}

  /**
   * Run semantic-release and update module version
   */
  async releaseModule(config: ReleaseConfig): Promise<ReleaseResult> {
    try {
      // Verify module exists
      const module = await this.prisma.marketplaceModule.findUnique({
        where: { id: config.moduleId },
      });

      if (!module) {
        throw new Error(`Module ${config.moduleId} not found`);
      }

      if (module.vendorId !== config.vendorId) {
        throw new Error('Module does not belong to vendor');
      }

      // Run semantic-release
      const releaseResult = await this.runSemanticRelease(config);

      if (!releaseResult.success || !releaseResult.version) {
        return releaseResult;
      }

      // Update module version in database
      await this.prisma.marketplaceModule.update({
        where: { id: config.moduleId },
        data: {
          version: releaseResult.version,
          updatedAt: new Date(),
        },
      });

      return releaseResult;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Release failed',
      };
    }
  }

  /**
   * Run semantic-release command
   */
  private async runSemanticRelease(config: ReleaseConfig): Promise<ReleaseResult> {
    try {
      const cwd = process.cwd();
      const dryRunFlag = config.dryRun ? '--dry-run' : '';
      const branchFlag = config.branch ? `--branches ${config.branch}` : '';

      // Check if semantic-release is installed
      try {
        execSync('npx semantic-release --version', { stdio: 'ignore' });
      } catch {
        // Try installing semantic-release if not found
        console.log('Installing semantic-release...');
        execSync('npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git', {
          stdio: 'inherit',
        });
      }

      // Run semantic-release
      const command = `npx semantic-release ${dryRunFlag} ${branchFlag}`.trim();
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd,
        stdio: 'pipe',
      });

      // Extract version from output
      const versionMatch = output.match(/Published release (\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : undefined;

      // Read changelog if it exists
      let changelog: string | undefined;
      try {
        const changelogPath = path.join(cwd, 'CHANGELOG.md');
        changelog = await fs.readFile(changelogPath, 'utf-8');
      } catch {
        // Changelog might not exist
      }

      return {
        success: true,
        version,
        changelog,
      };
    } catch (error: any) {
      // Check if it's a "no release" scenario (not an error)
      if (error.stdout && error.stdout.includes('no release')) {
        return {
          success: true,
          version: undefined,
        };
      }

      return {
        success: false,
        error: error.message || 'Semantic release failed',
      };
    }
  }

  /**
   * Get current version from package.json
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      return packageJson.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Analyze commits to determine next version
   */
  async analyzeCommits(branch: string = 'main'): Promise<{
    type: 'major' | 'minor' | 'patch' | null;
    commits: Array<{ type: string; message: string }>;
  }> {
    try {
      const command = `git log origin/${branch}..HEAD --pretty=format:"%s"`;
      const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });

      const commits = output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^(\w+)(\(.+\))?: (.+)$/);
          if (match) {
            return {
              type: match[1].toLowerCase(),
              message: match[3],
            };
          }
          return { type: 'other', message: line };
        });

      // Determine version bump type
      let versionType: 'major' | 'minor' | 'patch' | null = null;
      for (const commit of commits) {
        if (commit.type === 'feat' && versionType !== 'major') {
          versionType = 'minor';
        } else if (commit.type === 'fix' && versionType === null) {
          versionType = 'patch';
        } else if (commit.type.includes('breaking') || commit.type.includes('!')) {
          versionType = 'major';
        }
      }

      return {
        type: versionType,
        commits,
      };
    } catch (error: any) {
      return {
        type: null,
        commits: [],
      };
    }
  }

  /**
   * Create or update release configuration
   */
  async createReleaseConfig(options: {
    repositoryUrl?: string;
    branches?: string[];
    plugins?: string[];
  }): Promise<void> {
    const config = {
      repositoryUrl: options.repositoryUrl || process.env.GITHUB_REPOSITORY_URL,
      branches: options.branches || ['main'],
      plugins: options.plugins || [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        '@semantic-release/npm',
        '@semantic-release/git',
      ],
    };

    const configPath = path.join(process.cwd(), '.releaserc.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }
}

