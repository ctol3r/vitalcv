/**
 * @vitalcv/career-graph — the Provider Career Graph contract.
 *
 * Types, projection rules, the gap register, and the authorization matrix.
 * No storage, no queries, no rendering: a projection service reads these rules
 * and builds subgraphs from canonical records.
 */

export type {
  CareerGraphEdge,
  CareerGraphEdgeType,
  CareerGraphNode,
  CareerGraphNodeType,
  CareerSubgraphResponse,
  GraphProvenance,
} from './types';

export type { EdgeProjection, NodeProjection } from './projection';
export { EDGE_PROJECTIONS, NODE_PROJECTIONS } from './projection';

export type { EdgeGap, GapReason, NodeGap } from './gaps';
export { EDGE_GAPS, NODE_GAPS } from './gaps';

export type { Denial, GraphPerspective, PerspectiveRule } from './authorization';
export { DENIALS, PERSPECTIVE_RULES } from './authorization';
