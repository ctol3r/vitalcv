/**
 * DecisionNarrativeGenerator
 *
 * Transforms ExplanationGraph into human-readable narrative.
 * Includes causal links and policy references.
 */

import type {
  ExplanationGraph,
  ExplanationNode,
  ExplanationEdge,
  ExplanationNodeType,
  ExplanationEdgeType,
} from '../graph/builder.js';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'explainability-narrative-generator' });

/**
 * Narrative section types
 */
export enum NarrativeSectionType {
  SUMMARY = 'summary',
  DECISION_POINT = 'decision_point',
  SIGNAL_ANALYSIS = 'signal_analysis',
  RULE_EVALUATION = 'rule_evaluation',
  MODULE_EXECUTION = 'module_execution',
  KERNEL_EXECUTION = 'kernel_execution',
  OUTCOME = 'outcome',
  CAUSAL_CHAIN = 'causal_chain',
}

/**
 * Narrative section
 */
export interface NarrativeSection {
  /** Section type */
  type: NarrativeSectionType;
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Related node IDs */
  nodeIds: string[];
  /** Related edge IDs */
  edgeIds: string[];
  /** Policy references */
  policyReferences?: string[];
  /** Causal links */
  causalLinks?: Array<{
    from: string;
    to: string;
    relationship: string;
  }>;
}

/**
 * Complete narrative
 */
export interface DecisionNarrative {
  /** Narrative ID */
  id: string;
  /** Narrative title */
  title: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Sections */
  sections: NarrativeSection[];
  /** Executive summary */
  executiveSummary: string;
  /** Full narrative text */
  fullText: string;
}

/**
 * Generator for decision narratives
 */
export class DecisionNarrativeGenerator {
  /**
   * Generate narrative from explanation graph
   */
  generate(graph: ExplanationGraph): DecisionNarrative {
    const sections: NarrativeSection[] = [];

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(graph);

    // Generate sections for each node type
    const signalNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.SIGNAL_COLLECTION
    );
    if (signalNodes.length > 0) {
      sections.push(this.generateSignalAnalysisSection(graph, signalNodes));
    }

    const decisionNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.SUPERVISOR_DECISION
    );
    if (decisionNodes.length > 0) {
      sections.push(
        ...decisionNodes.map((node) =>
          this.generateDecisionPointSection(graph, node)
        )
      );
    }

    const ruleNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.RULE_EVALUATION
    );
    if (ruleNodes.length > 0) {
      sections.push(
        ...ruleNodes.map((node) =>
          this.generateRuleEvaluationSection(graph, node)
        )
      );
    }

    const moduleNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.MODULE_INVOCATION
    );
    if (moduleNodes.length > 0) {
      sections.push(
        ...moduleNodes.map((node) =>
          this.generateModuleExecutionSection(graph, node)
        )
      );
    }

    const kernelNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.KERNEL_EXECUTION
    );
    if (kernelNodes.length > 0) {
      sections.push(
        ...kernelNodes.map((node) =>
          this.generateKernelExecutionSection(graph, node)
        )
      );
    }

    const outcomeNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.OUTCOME
    );
    if (outcomeNodes.length > 0) {
      sections.push(
        ...outcomeNodes.map((node) =>
          this.generateOutcomeSection(graph, node)
        )
      );
    }

    // Generate causal chain section
    const causalChain = this.generateCausalChainSection(graph);
    if (causalChain) {
      sections.push(causalChain);
    }

    // Generate full text
    const fullText = this.combineSections(sections);

    return {
      id: `narrative_${graph.id}`,
      title: this.generateTitle(graph),
      createdAt: new Date(),
      sections,
      executiveSummary,
      fullText,
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(graph: ExplanationGraph): string {
    const decisionNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.SUPERVISOR_DECISION
    );
    const outcomeNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.OUTCOME
    );

    if (decisionNodes.length === 0) {
      return 'No decisions were made in this explanation graph.';
    }

    const decisions = decisionNodes.map((node) => {
      const taskType = node.data.taskType as string;
      const decision = node.data.decision as string;
      return `${taskType}: ${decision}`;
    });

    const outcomes = outcomeNodes.map((node) => {
      const type = node.data.type as string;
      return type;
    });

    return `The supervisor made ${decisionNodes.length} decision(s): ${decisions.join(', ')}. ` +
      `This resulted in ${outcomeNodes.length} outcome(s): ${outcomes.join(', ')}. ` +
      `The decision process involved ${graph.nodes.length} steps and ${graph.edges.length} relationships.`;
  }

  /**
   * Generate title
   */
  private generateTitle(graph: ExplanationGraph): string {
    const decisionNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.SUPERVISOR_DECISION
    );
    if (decisionNodes.length > 0) {
      const taskType = decisionNodes[0].data.taskType as string;
      return `Decision Explanation: ${taskType}`;
    }
    return `Decision Explanation: ${graph.id}`;
  }

  /**
   * Generate signal analysis section
   */
  private generateSignalAnalysisSection(
    graph: ExplanationGraph,
    nodes: ExplanationNode[]
  ): NarrativeSection {
    const node = nodes[0];
    const signals = node.data.signals as Record<string, unknown>;

    let content = 'The system collected the following signals:\n\n';
    if (signals.drift) {
      const drift = signals.drift as Record<string, number>;
      content += `- Drift Signals: ${drift.openCount} open events (${drift.criticalCount} critical, ${drift.highCount} high)\n`;
    }
    if (signals.safety) {
      const safety = signals.safety as Record<string, number>;
      content += `- Safety Signals: ${safety.activeCount} active (${safety.criticalCount} critical, ${safety.highCount} high)\n`;
    }
    if (signals.compliance) {
      const compliance = signals.compliance as Record<string, number>;
      content += `- Compliance Failures: ${compliance.totalFailures} total (${compliance.recentFailures} recent)\n`;
    }
    if (signals.queue) {
      const queue = signals.queue as Record<string, number>;
      content += `- Queue Status: ${queue.pendingJobs} pending, ${queue.runningJobs} running\n`;
    }

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );

    return {
      type: NarrativeSectionType.SIGNAL_ANALYSIS,
      title: 'Signal Collection',
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
    };
  }

  /**
   * Generate decision point section
   */
  private generateDecisionPointSection(
    graph: ExplanationGraph,
    node: ExplanationNode
  ): NarrativeSection {
    const taskType = node.data.taskType as string;
    const decision = node.data.decision as string;
    const reason = node.data.reason as string;

    let content = `The supervisor evaluated whether to execute task: ${taskType}.\n\n`;
    content += `Decision: ${decision.toUpperCase()}\n`;
    content += `Reason: ${reason}\n`;

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );
    const incomingEdges = relatedEdges.filter((e) => e.target === node.id);
    const outgoingEdges = relatedEdges.filter((e) => e.source === node.id);

    if (incomingEdges.length > 0) {
      content += `\nThis decision was triggered by:\n`;
      for (const edge of incomingEdges) {
        const sourceNode = graph.nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          content += `- ${sourceNode.label} (${edge.label || edge.type})\n`;
        }
      }
    }

    if (outgoingEdges.length > 0) {
      content += `\nThis decision led to:\n`;
      for (const edge of outgoingEdges) {
        const targetNode = graph.nodes.find((n) => n.id === edge.target);
        if (targetNode) {
          content += `- ${targetNode.label} (${edge.label || edge.type})\n`;
        }
      }
    }

    const policyRefs: string[] = [];
    if (reason.includes('policy') || reason.includes('Policy')) {
      policyRefs.push(`Policy: ${taskType}`);
    }

    return {
      type: NarrativeSectionType.DECISION_POINT,
      title: `Decision: ${taskType}`,
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
      policyReferences: policyRefs.length > 0 ? policyRefs : undefined,
    };
  }

  /**
   * Generate rule evaluation section
   */
  private generateRuleEvaluationSection(
    graph: ExplanationGraph,
    node: ExplanationNode
  ): NarrativeSection {
    const ruleName = node.data.ruleName as string;
    const ruleType = node.data.ruleType as string;
    const passed = node.data.passed as boolean;
    const reason = node.data.reason as string;

    let content = `Rule: ${ruleName} (Type: ${ruleType})\n\n`;
    content += `Evaluation: ${passed ? 'PASSED' : 'FAILED'}\n`;
    content += `Reason: ${reason}\n`;

    if (node.data.details) {
      const details = node.data.details as Record<string, unknown>;
      content += `\nDetails:\n`;
      for (const [key, value] of Object.entries(details)) {
        content += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );

    return {
      type: NarrativeSectionType.RULE_EVALUATION,
      title: `Rule Evaluation: ${ruleName}`,
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
      policyReferences: [ruleName],
    };
  }

  /**
   * Generate module execution section
   */
  private generateModuleExecutionSection(
    graph: ExplanationGraph,
    node: ExplanationNode
  ): NarrativeSection {
    const moduleId = node.data.moduleId as string;
    const capability = node.data.capability as string;
    const outcome = node.data.outcome as
      | { success: boolean; result?: unknown; error?: string }
      | undefined;

    let content = `Module: ${moduleId}\n`;
    content += `Capability: ${capability}\n`;
    if (outcome) {
      content += `\nExecution: ${outcome.success ? 'SUCCESS' : 'FAILED'}\n`;
      if (outcome.error) {
        content += `Error: ${outcome.error}\n`;
      }
      if (outcome.result) {
        content += `Result: ${JSON.stringify(outcome.result, null, 2)}\n`;
      }
    }

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );

    return {
      type: NarrativeSectionType.MODULE_EXECUTION,
      title: `Module Execution: ${moduleId}`,
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
    };
  }

  /**
   * Generate kernel execution section
   */
  private generateKernelExecutionSection(
    graph: ExplanationGraph,
    node: ExplanationNode
  ): NarrativeSection {
    const kernelId = node.data.kernelId as string;
    const operation = node.data.operation as string;
    const result = node.data.result;

    let content = `Kernel: ${kernelId}\n`;
    content += `Operation: ${operation}\n`;
    if (result !== undefined) {
      content += `Result: ${JSON.stringify(result, null, 2)}\n`;
    }

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );

    return {
      type: NarrativeSectionType.KERNEL_EXECUTION,
      title: `Kernel Execution: ${kernelId}`,
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
    };
  }

  /**
   * Generate outcome section
   */
  private generateOutcomeSection(
    graph: ExplanationGraph,
    node: ExplanationNode
  ): NarrativeSection {
    const type = node.data.type as string;
    const result = node.data.result;

    let content = `Outcome Type: ${type}\n`;
    if (result !== undefined) {
      content += `Result: ${JSON.stringify(result, null, 2)}\n`;
    }

    const relatedEdges = graph.edges.filter(
      (e) => e.source === node.id || e.target === node.id
    );

    return {
      type: NarrativeSectionType.OUTCOME,
      title: `Outcome: ${type}`,
      content,
      nodeIds: [node.id],
      edgeIds: relatedEdges.map((e) => e.id),
    };
  }

  /**
   * Generate causal chain section
   */
  private generateCausalChainSection(
    graph: ExplanationGraph
  ): NarrativeSection | null {
    // Find paths from root to outcomes
    const rootNode = graph.nodes.find((n) => n.id === graph.rootNodeId);
    if (!rootNode) {
      return null;
    }

    const outcomeNodes = graph.nodes.filter(
      (n) => n.type === ExplanationNodeType.OUTCOME
    );
    if (outcomeNodes.length === 0) {
      return null;
    }

    const causalLinks: Array<{ from: string; to: string; relationship: string }> =
      [];

    // Build causal chains
    for (const outcomeNode of outcomeNodes) {
      const path = this.findPath(graph, rootNode.id, outcomeNode.id);
      if (path.length > 1) {
        for (let i = 0; i < path.length - 1; i++) {
          const edge = graph.edges.find(
            (e) => e.source === path[i] && e.target === path[i + 1]
          );
          if (edge) {
            causalLinks.push({
              from: path[i],
              to: path[i + 1],
              relationship: edge.label || edge.type,
            });
          }
        }
      }
    }

    if (causalLinks.length === 0) {
      return null;
    }

    let content = 'Causal Chain:\n\n';
    for (const link of causalLinks) {
      const fromNode = graph.nodes.find((n) => n.id === link.from);
      const toNode = graph.nodes.find((n) => n.id === link.to);
      if (fromNode && toNode) {
        content += `${fromNode.label} → ${toNode.label} (${link.relationship})\n`;
      }
    }

    return {
      type: NarrativeSectionType.CAUSAL_CHAIN,
      title: 'Causal Chain',
      content,
      nodeIds: [],
      edgeIds: [],
      causalLinks,
    };
  }

  /**
   * Find path between two nodes using BFS
   */
  private findPath(
    graph: ExplanationGraph,
    fromId: string,
    toId: string
  ): string[] {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: fromId, path: [fromId] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === toId) {
        return path;
      }

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      const outgoingEdges = graph.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          queue.push({ nodeId: edge.target, path: [...path, edge.target] });
        }
      }
    }

    return [];
  }

  /**
   * Combine sections into full text
   */
  private combineSections(sections: NarrativeSection[]): string {
    let text = '';
    for (const section of sections) {
      text += `\n## ${section.title}\n\n`;
      text += section.content;
      text += '\n';
    }
    return text.trim();
  }
}

/**
 * Create a new narrative generator
 */
export function createDecisionNarrativeGenerator(): DecisionNarrativeGenerator {
  return new DecisionNarrativeGenerator();
}

