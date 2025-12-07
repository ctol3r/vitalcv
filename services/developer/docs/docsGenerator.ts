/**
 * DeveloperDocs Generator
 *
 * Uses TypeDoc or similar to generate API documentation for modules and SDKs.
 * Deploys to a static site and integrates with Developer Portal.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DocsConfig {
  moduleId: string;
  moduleName: string;
  sourcePath: string;
  outputPath: string;
  baseUrl?: string;
  theme?: 'default' | 'minimal' | 'markdown';
  includePrivate?: boolean;
  excludeTags?: string[];
}

export interface DocsGenerationResult {
  success: boolean;
  outputPath?: string;
  url?: string;
  error?: string;
  filesGenerated?: number;
}

export class DocsGenerator {
  private config: DocsConfig;
  private static readonly TYPEDOC_CONFIG = 'typedoc.json';

  constructor(config: DocsConfig) {
    this.config = config;
  }

  /**
   * Generate API documentation for a module
   */
  async generate(): Promise<DocsGenerationResult> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputPath, { recursive: true });

      // Check if TypeDoc is available
      const typedocAvailable = await this.checkTypeDocAvailable();
      if (!typedocAvailable) {
        // Fallback to basic markdown generation
        return await this.generateMarkdownDocs();
      }

      // Generate TypeDoc configuration
      const typedocConfigPath = await this.createTypeDocConfig();

      // Run TypeDoc
      const command = `typedoc --options ${typedocConfigPath} ${this.config.sourcePath}`;
      await execAsync(command);

      // Count generated files
      const filesGenerated = await this.countGeneratedFiles();

      // Generate deployment manifest
      await this.generateDeploymentManifest();

      const url = this.config.baseUrl
        ? `${this.config.baseUrl}/${this.config.moduleId}`
        : undefined;

      return {
        success: true,
        outputPath: this.config.outputPath,
        url,
        filesGenerated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if TypeDoc is installed
   */
  private async checkTypeDocAvailable(): Promise<boolean> {
    try {
      await execAsync('typedoc --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create TypeDoc configuration file
   */
  private async createTypeDocConfig(): Promise<string> {
    const configPath = path.join(this.config.outputPath, DocsGenerator.TYPEDOC_CONFIG);
    const config = {
      entryPoints: [this.config.sourcePath],
      out: this.config.outputPath,
      name: `${this.config.moduleName} API Documentation`,
      theme: this.config.theme || 'default',
      excludePrivate: !this.config.includePrivate,
      excludeTags: this.config.excludeTags || [],
      readme: path.join(this.config.sourcePath, 'README.md'),
      includeVersion: true,
      gitRevision: 'main',
      plugin: ['typedoc-plugin-markdown'],
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Generate basic markdown documentation as fallback
   */
  private async generateMarkdownDocs(): Promise<DocsGenerationResult> {
    try {
      const readmePath = path.join(this.config.sourcePath, 'README.md');
      let readmeContent = '';

      try {
        readmeContent = await fs.readFile(readmePath, 'utf-8');
      } catch {
        readmeContent = `# ${this.config.moduleName}\n\nAPI Documentation\n`;
      }

      // Generate basic API docs structure
      const docsContent = this.generateBasicMarkdown(readmeContent);

      const outputFile = path.join(this.config.outputPath, 'index.md');
      await fs.writeFile(outputFile, docsContent);

      return {
        success: true,
        outputPath: this.config.outputPath,
        filesGenerated: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate basic markdown documentation structure
   */
  private generateBasicMarkdown(readmeContent: string): string {
    return `# ${this.config.moduleName} API Documentation

${readmeContent}

---

## API Reference

This module provides the following API:

### Installation

\`\`\`bash
npm install ${this.config.moduleName}
\`\`\`

### Usage

\`\`\`typescript
import { ${this.config.moduleName} } from '${this.config.moduleName}';
\`\`\`

### Methods

_Note: Full API documentation requires TypeDoc. Install TypeDoc to generate complete documentation._

---

Generated on ${new Date().toISOString()}
`;
  }

  /**
   * Count generated documentation files
   */
  private async countGeneratedFiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.config.outputPath, { recursive: true });
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Generate deployment manifest for static site hosting
   */
  private async generateDeploymentManifest(): Promise<void> {
    const manifest = {
      moduleId: this.config.moduleId,
      moduleName: this.config.moduleName,
      generatedAt: new Date().toISOString(),
      outputPath: this.config.outputPath,
      baseUrl: this.config.baseUrl,
      version: '1.0.0',
    };

    const manifestPath = path.join(this.config.outputPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Deploy documentation to static site
   */
  async deploy(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // This would integrate with your static site hosting (e.g., Vercel, Netlify, S3)
      // For now, we'll just return the local path
      const url = this.config.baseUrl
        ? `${this.config.baseUrl}/${this.config.moduleId}`
        : `file://${this.config.outputPath}`;

      return {
        success: true,
        url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate SDK documentation (for client libraries)
   */
  async generateSDKDocs(sdkPath: string): Promise<DocsGenerationResult> {
    const sdkConfig: DocsConfig = {
      ...this.config,
      sourcePath: sdkPath,
      outputPath: path.join(this.config.outputPath, 'sdk'),
    };

    const generator = new DocsGenerator(sdkConfig);
    return generator.generate();
  }

  /**
   * Generate documentation index for all modules
   */
  static async generateIndex(
    modules: Array<{ id: string; name: string; url: string }>,
    outputPath: string,
  ): Promise<void> {
    const indexContent = `# Developer Documentation Index

## Available Modules

${modules
  .map(
    (module) => `### [${module.name}](./${module.id}/)
- Module ID: \`${module.id}\`
- [View Documentation](${module.url})
`,
  )
  .join('\n')}

---

Last updated: ${new Date().toISOString()}
`;

    await fs.mkdir(outputPath, { recursive: true });
    await fs.writeFile(path.join(outputPath, 'index.md'), indexContent);
  }
}

/**
 * Convenience function to generate docs for a module
 */
export async function generateModuleDocs(
  config: DocsConfig,
): Promise<DocsGenerationResult> {
  const generator = new DocsGenerator(config);
  return generator.generate();
}

/**
 * Convenience function to generate and deploy docs
 */
export async function generateAndDeployDocs(
  config: DocsConfig,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const generator = new DocsGenerator(config);
  const result = await generator.generate();

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return generator.deploy();
}

