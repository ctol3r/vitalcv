/**
 * ExplanationGraphBuilder
 *
 * Builds a DAG (Directed Acyclic Graph) of decisions across supervisor, modules, and kernels.
 * Includes signals, rules, outcomes, and is exportable to JSON.
 */

import type { SupervisorSignals } from '../../supervisor/signals/signalCollector.js';
import type { SupervisorTaskType } from '@prisma/client';
import type { RoutingDecision } from '../../supervisor/integration/microkernelIntegration.js';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'explainability-graph-builder' });

/**
 * Node types in the explanation graph
 */
export enum ExplanationNodeType {
  /** Supervisor decision point */
  SUPERVISOR_DECISION = 'supervisor_decision',
  /** Module invocation */
  MODULE_INVOCATION = 'module_invocation',
  /** Kernel execution */
  KERNEL_EXECUTION = 'kernel_execution',
  /** Signal collection */
  SIGNAL_COLLECTION = 'signal_collection',
  /** Rule evaluation */
  RULE_EVALUATION = 'rule_evaluation',
  /** Outcome/result */
  OUTCOME = 'outcome',
}

/**
 * Edge types representing relationships
 */
export enum ExplanationEdgeType {
  /** Triggered by */
  TRIGGERED_BY = 'triggered_by',
  /** Depends on */
  DEPENDS_ON = 'depends_on',
  /** Evaluates */
  EVALUATES = 'evaluates',
  /** Produces */
  PRODUCES = 'produces',
  /** Blocks */
  BLOCKS = 'blocks',
  /** Routes to */
  ROUTES_TO = 'routes_to',
}

/**
 * Explanation node in the graph
 */
export interface ExplanationNode {
  /** Unique node ID */
  id: string;
  /** Node type */
  type: ExplanationNodeType;
  /** Human-readable label */
  label: string;
  /** Timestamp */
  timestamp: Date;
  /** Node-specific data */
  data: Record<string, unknown>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Explanation edge connecting nodes
 */
export interface ExplanationEdge {
  /** Unique edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type */
  type: ExplanationEdgeType;
  /** Edge label */
  label?: string;
  /** Edge-specific data */
  data?: Record<string, unknown>;
}

/**
 * Complete explanation graph
 */
export interface ExplanationGraph {
  /** Graph ID */
  id: string;
  /** Graph creation timestamp */
  createdAt: Date;
  /** Root node ID (entry point) */
  rootNodeId: string;
  /** All nodes */
  nodes: ExplanationNode[];
  /** All edges */
  edges: ExplanationEdge[];
  /** Graph metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context for building explanation graphs
 */
export interface ExplanationContext {
  /** Organization ID */
  orgId?: string;
  /** Task type being explained */
  taskType?: SupervisorTaskType;
  /** Signals at decision time */
  signals?: SupervisorSignals;
  /** Routing decisions made */
  routingDecisions?: RoutingDecision[];
  /** Policy violations */
  policyViolations?: Array<{
    taskType: SupervisorTaskType;
    reason: string;
    blockingTasks: SupervisorTaskType[];
  }>;
  /** Modules invoked */
  modulesInvoked?: Array<{
    moduleId: string;
    capability: string;
    timestamp: Date;
    outcome?: unknown;
  }>;
  /** Kernels executed */
  kernelsExecuted?: Array<{
    kernelId: string;
    operation: string;
    timestamp: Date;
    result?: unknown;
  }>;
  /** Final outcomes */
  outcomes?: Array<{
    type: string;
    result: unknown;
    timestamp: Date;
  }>;
}

/**
 * Builder for explanation graphs
 */
export class ExplanationGraphBuilder {
  private nodes: Map<string, ExplanationNode> = new Map();
  private edges: ExplanationEdge[] = [];
  private nodeCounter = 0;
  private edgeCounter = 0;
  private rootNodeId: string | null = null;

  /**
   * Create a new explanation graph builder
   */
  constructor(private graphId: string) {}

  /**
   * Add a supervisor decision node
   */
  addSupervisorDecision(
    taskType: SupervisorTaskType,
    decision: 'allowed' | 'blocked' | 'deferred',
    reason: string,
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.SUPERVISOR_DECISION,
      label: `Supervisor Decision: ${taskType}`,
      timestamp,
      data: {
        taskType,
        decision,
        reason,
      },
    };

    this.nodes.set(nodeId, node);
    if (!this.rootNodeId) {
      this.rootNodeId = nodeId;
    }

    return nodeId;
  }

  /**
   * Add a signal collection node
   */
  addSignalCollection(
    signals: SupervisorSignals,
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.SIGNAL_COLLECTION,
      label: 'Signal Collection',
      timestamp,
      data: {
        signals: {
          drift: signals.drift,
          safety: signals.safety,
          compliance: signals.compliance,
          queue: signals.queue,
          ehrSync: signals.ehrSync,
          fusionDeltas: signals.fusionDeltas.length,
        },
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * Add a rule evaluation node
   */
  addRuleEvaluation(
    ruleName: string,
    ruleType: 'policy' | 'priority' | 'concurrency' | 'custom',
    evaluation: {
      passed: boolean;
      reason: string;
      details?: Record<string, unknown>;
    },
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.RULE_EVALUATION,
      label: `Rule Evaluation: ${ruleName}`,
      timestamp,
      data: {
        ruleName,
        ruleType,
        ...evaluation,
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * Add a module invocation node
   */
  addModuleInvocation(
    moduleId: string,
    capability: string,
    input: Record<string, unknown>,
    outcome?: {
      success: boolean;
      result?: unknown;
      error?: string;
    },
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.MODULE_INVOCATION,
      label: `Module: ${moduleId}`,
      timestamp,
      data: {
        moduleId,
        capability,
        input,
        outcome,
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * Add a kernel execution node
   */
  addKernelExecution(
    kernelId: string,
    operation: string,
    input: Record<string, unknown>,
    result?: unknown,
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.KERNEL_EXECUTION,
      label: `Kernel: ${kernelId}`,
      timestamp,
      data: {
        kernelId,
        operation,
        input,
        result,
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * Add an outcome node
   */
  addOutcome(
    type: string,
    result: unknown,
    timestamp: Date = new Date()
  ): string {
    const nodeId = this.generateNodeId();
    const node: ExplanationNode = {
      id: nodeId,
      type: ExplanationNodeType.OUTCOME,
      label: `Outcome: ${type}`,
      timestamp,
      data: {
        type,
        result,
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  /**
   * Add an edge between nodes
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: ExplanationEdgeType,
    label?: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      logger.warn('Attempted to add edge with non-existent node', {
        sourceId,
        targetId,
      });
      return;
    }

    const edgeId = this.generateEdgeId();
    const edge: ExplanationEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      label,
      data,
    };

    this.edges.push(edge);
  }

  /**
   * Build explanation graph from context
   */
  buildFromContext(context: ExplanationContext): ExplanationGraph {
    const signalNodeId = context.signals
      ? this.addSignalCollection(context.signals)
      : null;

    // Add supervisor decisions
    const decisionNodeIds: string[] = [];
    if (context.taskType) {
      const decision = context.policyViolations?.length
        ? 'blocked'
        : 'allowed';
      const reason = context.policyViolations?.length
        ? context.policyViolations[0].reason
        : 'Policy check passed';
      const decisionId = this.addSupervisorDecision(
        context.taskType,
        decision,
        reason
      );
      decisionNodeIds.push(decisionId);

      if (signalNodeId) {
        this.addEdge(
          signalNodeId,
          decisionId,
          ExplanationEdgeType.TRIGGERED_BY,
          'Signals triggered decision'
        );
      }
    }

    // Add rule evaluations
    if (context.policyViolations) {
      for (const violation of context.policyViolations) {
        const ruleNodeId = this.addRuleEvaluation(
          `Policy: ${violation.taskType}`,
          'policy',
          {
            passed: false,
            reason: violation.reason,
            details: {
              blockingTasks: violation.blockingTasks,
            },
          }
        );

        if (decisionNodeIds.length > 0) {
          this.addEdge(
            decisionNodeIds[0],
            ruleNodeId,
            ExplanationEdgeType.EVALUATES,
            'Policy evaluation'
          );
        }
      }
    }

    // Add module invocations
    const moduleNodeIds: string[] = [];
    if (context.modulesInvoked) {
      for (const module of context.modulesInvoked) {
        const moduleNodeId = this.addModuleInvocation(
          module.moduleId,
          module.capability,
          {},
          module.outcome
            ? {
                success: true,
                result: module.outcome,
              }
            : undefined,
          module.timestamp
        );
        moduleNodeIds.push(moduleNodeId);

        if (decisionNodeIds.length > 0) {
          this.addEdge(
            decisionNodeIds[0],
            moduleNodeId,
            ExplanationEdgeType.ROUTES_TO,
            `Routes to ${module.moduleId}`
          );
        }
      }
    }

    // Add kernel executions
    const kernelNodeIds: string[] = [];
    if (context.kernelsExecuted) {
      for (const kernel of context.kernelsExecuted) {
        const kernelNodeId = this.addKernelExecution(
          kernel.kernelId,
          kernel.operation,
          {},
          kernel.result,
          kernel.timestamp
        );
        kernelNodeIds.push(kernelNodeId);

        if (moduleNodeIds.length > 0) {
          this.addEdge(
            moduleNodeIds[moduleNodeIds.length - 1],
            kernelNodeId,
            ExplanationEdgeType.DEPENDS_ON,
            'Module depends on kernel'
          );
        }
      }
    }

    // Add outcomes
    const outcomeNodeIds: string[] = [];
    if (context.outcomes) {
      for (const outcome of context.outcomes) {
        const outcomeNodeId = this.addOutcome(
          outcome.type,
          outcome.result,
          outcome.timestamp
        );
        outcomeNodeIds.push(outcomeNodeId);

        // Connect to last module or kernel
        const lastNodeId =
          kernelNodeIds[kernelNodeIds.length - 1] ||
          moduleNodeIds[moduleNodeIds.length - 1] ||
          decisionNodeIds[decisionNodeIds.length - 1];

        if (lastNodeId) {
          this.addEdge(
            lastNodeId,
            outcomeNodeId,
            ExplanationEdgeType.PRODUCES,
            'Produces outcome'
          );
        }
      }
    }

    return this.build();
  }

  /**
   * Build the final explanation graph
   */
  build(metadata?: Record<string, unknown>): ExplanationGraph {
    if (!this.rootNodeId) {
      throw new Error('No root node set. Add at least one node before building.');
    }

    return {
      id: this.graphId,
      createdAt: new Date(),
      rootNodeId: this.rootNodeId,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      metadata,
    };
  }

  /**
   * Export graph to JSON
   */
  toJSON(): string {
    const graph = this.build();
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    return `node_${this.nodeCounter++}`;
  }

  /**
   * Generate unique edge ID
   */
  private generateEdgeId(): string {
    return `edge_${this.edgeCounter++}`;
  }
}

/**
 * Create a new explanation graph builder
 */
export function createExplanationGraphBuilder(
  graphId?: string
): ExplanationGraphBuilder {
  const id = graphId || `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return new ExplanationGraphBuilder(id);
}

