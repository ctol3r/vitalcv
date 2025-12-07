/**
 * OpenCode Automation Adapter - B140B-AGENT-028
 *
 * Integration with OpenCode for Plan→Build backend task automation:
 * - Repository synchronization
 * - Automated code generation
 * - Testing and validation
 * - Action logging to transcript store
 * - Stub runs for verification
 */

import { z } from 'zod';
import { transcriptStore, TranscriptType } from './transcriptStore';
import { nistGenAITagging } from '../../infra/compliance/genaiTags';
import { riskScoringAdapter } from './riskScoring';

// ============================================================
// SCHEMAS
// ============================================================

export const AutomationTaskSchema = z.object({
  agentId: z.string(),
  taskType: z.enum([
    'code_generation',
    'test_generation',
    'api_implementation',
    'schema_migration',
    'documentation',
    'bug_fix',
  ]),
  specification: z.string(),
  repoUrl: z.string(),
  targetPath: z.string(),
  branch: z.string().default('main'),
  context: z.record(z.any()).optional(),
});

export type AutomationTask = z.infer<typeof AutomationTaskSchema>;

export const AutomationResultSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  agentId: z.string(),

  // Status
  status: z.enum(['success', 'partial', 'failed']),

  // Generated artifacts
  artifacts: z.array(z.object({
    type: z.enum(['code', 'test', 'documentation', 'config', 'migration']),
    path: z.string(),
    content: z.string().optional(),
    size: z.number(),
  })),

  // Validation
  testsRun: z.number(),
  testsPassed: z.number(),
  testsFailed: z.number(),

  // Quality metrics
  codeQuality: z.object({
    complexity: z.number(),
    maintainability: z.number(),
    coverage: z.number().optional(),
  }).optional(),

  // Logs
  logs: z.array(z.string()),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),

  // Metadata
  duration: z.number(), // milliseconds
  transcriptId: z.string(),
  timestamp: z.date(),
});

export type AutomationResult = z.infer<typeof AutomationResultSchema>;

export const RepoSyncConfigSchema = z.object({
  repoUrl: z.string(),
  branch: z.string(),
  syncInterval: z.number().optional(), // minutes
  autoSync: z.boolean().default(false),
  webhookUrl: z.string().optional(),
});

export type RepoSyncConfig = z.infer<typeof RepoSyncConfigSchema>;

// ============================================================
// OPENCODE ADAPTER CLASS
// ============================================================

export class OpenCodeAdapter {
  private static instance: OpenCodeAdapter;
  private taskHistory: Map<string, AutomationResult> = new Map();
  private syncConfigs: Map<string, RepoSyncConfig> = new Map();

  private constructor() {}

  static getInstance(): OpenCodeAdapter {
    if (!OpenCodeAdapter.instance) {
      OpenCodeAdapter.instance = new OpenCodeAdapter();
    }
    return OpenCodeAdapter.instance;
  }

  /**
   * Execute automation task
   */
  async executeTask(task: AutomationTask): Promise<AutomationResult> {
    const validated = AutomationTaskSchema.parse(task);
    const startTime = Date.now();

    // Create transcript
    const transcript = transcriptStore.create({
      agentId: validated.agentId,
      type: TranscriptType.WORKFLOW,
      tags: ['opencode', validated.taskType],
      metadata: { repoUrl: validated.repoUrl, targetPath: validated.targetPath },
    });

    transcriptStore.addEntry(transcript.id, {
      timestamp: new Date(),
      role: 'system',
      content: `Starting automation: ${validated.taskType} - ${validated.specification}`,
    });

    // Score the request
    const riskResult = await riskScoringAdapter.scoreAction({
      agentId: validated.agentId,
      action: 'code_automation',
      input: validated.specification,
      context: { taskType: validated.taskType },
    });

    // Tag with NIST
    nistGenAITagging.tagEvent({
      id: `automation-${Date.now()}`,
      eventType: 'high_risk_action',
      agentId: validated.agentId,
      data: {
        taskType: validated.taskType,
        riskScore: riskResult.riskScore,
      },
    });

    try {
      // Step 1: Sync repository
      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'agent',
        content: 'Step 1: Synchronizing repository...',
      });

      await this.syncRepo(validated.repoUrl, validated.branch);

      // Step 2: Analyze context
      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'agent',
        content: 'Step 2: Analyzing context and requirements...',
      });

      const context = await this.analyzeContext(validated);

      // Step 3: Generate code
      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'agent',
        content: `Step 3: Generating ${validated.taskType}...`,
      });

      const artifacts = await this.generateArtifacts(validated, context);

      // Step 4: Run tests
      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'agent',
        content: 'Step 4: Running tests and validation...',
      });

      const testResults = await this.runTests(artifacts);

      const duration = Date.now() - startTime;

      const result: AutomationResult = {
        id: `automation-${Date.now()}`,
        taskId: `task-${Date.now()}`,
        agentId: validated.agentId,
        status: testResults.passed === testResults.total ? 'success' : 'partial',
        artifacts,
        testsRun: testResults.total,
        testsPassed: testResults.passed,
        testsFailed: testResults.failed,
        codeQuality: testResults.quality,
        logs: testResults.logs,
        warnings: testResults.warnings,
        errors: testResults.errors,
        duration,
        transcriptId: transcript.id,
        timestamp: new Date(),
      };

      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'system',
        content: `Automation completed: ${result.status}. Generated ${artifacts.length} artifacts.`,
      });

      transcriptStore.complete(transcript.id);

      this.taskHistory.set(result.id, result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      transcriptStore.addEntry(transcript.id, {
        timestamp: new Date(),
        role: 'system',
        content: `Automation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      transcriptStore.complete(transcript.id);

      const result: AutomationResult = {
        id: `automation-${Date.now()}`,
        taskId: `task-${Date.now()}`,
        agentId: validated.agentId,
        status: 'failed',
        artifacts: [],
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        logs: [],
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        transcriptId: transcript.id,
        timestamp: new Date(),
      };

      this.taskHistory.set(result.id, result);

      return result;
    }
  }

  /**
   * Configure repository sync
   */
  configureRepoSync(config: RepoSyncConfig): void {
    const validated = RepoSyncConfigSchema.parse(config);
    this.syncConfigs.set(validated.repoUrl, validated);
  }

  /**
   * Get sync config
   */
  getSyncConfig(repoUrl: string): RepoSyncConfig | undefined {
    return this.syncConfigs.get(repoUrl);
  }

  /**
   * Sync repository (stub)
   */
  private async syncRepo(repoUrl: string, branch: string): Promise<void> {
    // Simulate repo sync
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Analyze context (stub)
   */
  private async analyzeContext(task: AutomationTask): Promise<{
    existingFiles: string[];
    dependencies: string[];
    patterns: string[];
  }> {
    // Simulate context analysis
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      existingFiles: [
        'src/services/agents/registry.ts',
        'src/services/agents/router.ts',
      ],
      dependencies: ['zod', 'crypto'],
      patterns: ['singleton', 'adapter'],
    };
  }

  /**
   * Generate artifacts (stub)
   */
  private async generateArtifacts(
    task: AutomationTask,
    context: any
  ): Promise<Array<{
    type: 'code' | 'test' | 'documentation' | 'config' | 'migration';
    path: string;
    content?: string;
    size: number;
  }>> {
    // Simulate artifact generation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const artifacts: Array<any> = [];

    switch (task.taskType) {
      case 'code_generation':
        artifacts.push({
          type: 'code',
          path: `${task.targetPath}/generated.ts`,
          size: 2048,
        });
        artifacts.push({
          type: 'test',
          path: `${task.targetPath}/__tests__/generated.test.ts`,
          size: 1024,
        });
        break;

      case 'test_generation':
        artifacts.push({
          type: 'test',
          path: `${task.targetPath}/__tests__/suite.test.ts`,
          size: 3072,
        });
        break;

      case 'api_implementation':
        artifacts.push({
          type: 'code',
          path: `${task.targetPath}/api.ts`,
          size: 4096,
        });
        artifacts.push({
          type: 'documentation',
          path: `${task.targetPath}/README.md`,
          size: 512,
        });
        break;

      case 'schema_migration':
        artifacts.push({
          type: 'migration',
          path: `migrations/${Date.now()}_migration.sql`,
          size: 1536,
        });
        break;

      case 'documentation':
        artifacts.push({
          type: 'documentation',
          path: `${task.targetPath}/docs.md`,
          size: 2048,
        });
        break;

      case 'bug_fix':
        artifacts.push({
          type: 'code',
          path: `${task.targetPath}/fixed.ts`,
          size: 1024,
        });
        artifacts.push({
          type: 'test',
          path: `${task.targetPath}/__tests__/regression.test.ts`,
          size: 768,
        });
        break;
    }

    return artifacts;
  }

  /**
   * Run tests (stub)
   */
  private async runTests(artifacts: any[]): Promise<{
    total: number;
    passed: number;
    failed: number;
    quality: {
      complexity: number;
      maintainability: number;
      coverage: number;
    };
    logs: string[];
    warnings: string[];
    errors: string[];
  }> {
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 800));

    const testArtifacts = artifacts.filter(a => a.type === 'test');
    const total = Math.max(testArtifacts.length * 3, 5);
    const passed = Math.floor(total * 0.9);
    const failed = total - passed;

    return {
      total,
      passed,
      failed,
      quality: {
        complexity: 6.5,
        maintainability: 82,
        coverage: 85,
      },
      logs: [
        'Running test suite...',
        `${passed}/${total} tests passed`,
        'Code quality checks passed',
      ],
      warnings: failed > 0 ? [`${failed} tests failed`] : [],
      errors: [],
    };
  }

  /**
   * Generate API implementation
   */
  async generateAPI(params: {
    agentId: string;
    specification: string;
    repoUrl: string;
    apiPath: string;
  }): Promise<AutomationResult> {
    return this.executeTask({
      agentId: params.agentId,
      taskType: 'api_implementation',
      specification: params.specification,
      repoUrl: params.repoUrl,
      targetPath: params.apiPath,
      branch: 'main',
    });
  }

  /**
   * Generate tests
   */
  async generateTests(params: {
    agentId: string;
    targetFile: string;
    repoUrl: string;
    testPath: string;
  }): Promise<AutomationResult> {
    return this.executeTask({
      agentId: params.agentId,
      taskType: 'test_generation',
      specification: `Generate tests for ${params.targetFile}`,
      repoUrl: params.repoUrl,
      targetPath: params.testPath,
      branch: 'main',
    });
  }

  /**
   * Fix bugs
   */
  async fixBug(params: {
    agentId: string;
    bugDescription: string;
    repoUrl: string;
    filePath: string;
  }): Promise<AutomationResult> {
    return this.executeTask({
      agentId: params.agentId,
      taskType: 'bug_fix',
      specification: params.bugDescription,
      repoUrl: params.repoUrl,
      targetPath: params.filePath,
      branch: 'main',
    });
  }

  /**
   * Get task history
   */
  getTaskHistory(agentId?: string): AutomationResult[] {
    const results = Array.from(this.taskHistory.values());
    if (agentId) {
      return results.filter(r => r.agentId === agentId);
    }
    return results;
  }

  /**
   * Get task result
   */
  getTaskResult(id: string): AutomationResult | undefined {
    return this.taskHistory.get(id);
  }

  /**
   * Get statistics
   */
  getStatistics(agentId?: string): {
    total: number;
    successful: number;
    partial: number;
    failed: number;
    avgDuration: number;
    avgTestPassRate: number;
    byTaskType: Record<string, number>;
  } {
    let results = Array.from(this.taskHistory.values());

    if (agentId) {
      results = results.filter(r => r.agentId === agentId);
    }

    if (results.length === 0) {
      return {
        total: 0,
        successful: 0,
        partial: 0,
        failed: 0,
        avgDuration: 0,
        avgTestPassRate: 0,
        byTaskType: {},
      };
    }

    const successful = results.filter(r => r.status === 'success').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    const testsTotal = results.reduce((sum, r) => sum + r.testsRun, 0);
    const testsPassed = results.reduce((sum, r) => sum + r.testsPassed, 0);
    const avgTestPassRate = testsTotal > 0 ? testsPassed / testsTotal : 0;

    const byTaskType: Record<string, number> = {};
    // Note: taskType is not in the result schema, so we'll leave this empty for now

    return {
      total: results.length,
      successful,
      partial,
      failed,
      avgDuration,
      avgTestPassRate,
      byTaskType,
    };
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.taskHistory.clear();
    this.syncConfigs.clear();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const opencodeAdapter = OpenCodeAdapter.getInstance();
export default opencodeAdapter;

