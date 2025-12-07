import { DefaultGraphSchema, GraphSchemaRegistry } from '../schemaRegistry.js';
import { GraphData, createEmptyGraph } from '../types.js';
import { GraphMetadata, GraphNodeType, createGraphNode, mergeMetadata } from '../models/GraphNode.js';
import { GraphEdge, GraphRelationType, createGraphEdge } from '../models/GraphEdge.js';

export interface ClinicianGraphInput {
  id: string;
  npi?: string;
  name?: string;
  state: string;
  org: OrgInput;
  metadata?: GraphMetadata;
}

export interface OrgInput {
  id: string;
  name: string;
  type?: string;
  state?: string;
  metadata?: GraphMetadata;
}

export interface LicenseInput {
  id: string;
  state: string;
  number?: string;
  category?: string;
  status?: string;
  boardId?: string;
  boardName?: string;
  metadata?: GraphMetadata;
}

export interface BoardCertificationInput {
  id: string;
  boardId: string;
  name: string;
  licenseIds?: string[];
  metadata?: GraphMetadata;
}

export interface DeaRegistrationInput {
  id: string;
  licenseId?: string;
  schedule?: string;
  metadata?: GraphMetadata;
}

export interface PecosEnrollmentInput {
  id: string;
  status: string;
  orgId?: string;
  metadata?: GraphMetadata;
}

export interface MedicaidEnrollmentInput {
  id: string;
  state: string;
  metadata?: GraphMetadata;
}

export interface PayerEnrollmentInput {
  id: string;
  payerId: string;
  payerName: string;
  requiresPecos?: boolean;
  requiresMedicaid?: boolean;
  conflictsWith?: string[];
  metadata?: GraphMetadata;
}

export interface PrivilegeInput {
  id: string;
  facilityId: string;
  facilityName: string;
  licenseIds: string[];
  payerEnrollmentIds?: string[];
  metadata?: GraphMetadata;
}

export interface CredentialVcInput {
  id: string;
  type: string;
  subjectId: string;
  issuerOrgId?: string;
  metadata?: GraphMetadata;
}

export interface CredentialEventInput {
  id: string;
  type: string;
  relatesToId: string;
  metadata?: GraphMetadata;
}

export interface CompactMembershipInput {
  id: string;
  compactCode: string;
  state: string;
  metadata?: GraphMetadata;
}

export interface GraphBuilderInput {
  clinician: ClinicianGraphInput;
  licenses: LicenseInput[];
  boardCertifications?: BoardCertificationInput[];
  deaRegistrations?: DeaRegistrationInput[];
  pecosEnrollment?: PecosEnrollmentInput;
  medicaidEnrollments?: MedicaidEnrollmentInput[];
  payerEnrollments?: PayerEnrollmentInput[];
  privileges?: PrivilegeInput[];
  vcs?: CredentialVcInput[];
  events?: CredentialEventInput[];
  compactMemberships?: CompactMembershipInput[];
}

export interface GraphBuilderOptions {
  schemaRegistry?: GraphSchemaRegistry;
}

export class GraphBuilder {
  private readonly schema: GraphSchemaRegistry;

  constructor(options?: GraphBuilderOptions) {
    this.schema = options?.schemaRegistry ?? DefaultGraphSchema;
  }

  build(input: GraphBuilderInput): GraphData {
    if (!input.clinician) {
      throw new Error('GraphBuilder requires clinician context');
    }

    const graph = createEmptyGraph();
    const edgeKeys = new Set<string>();

    const ensureNode = (nodeId: string, nodeType: GraphNodeType, metadata: GraphMetadata = {}): string => {
      const existing = graph.nodes.get(nodeId);
      if (existing) {
        const merged = mergeMetadata(existing.metadata, metadata);
        graph.nodes.set(nodeId, { ...existing, metadata: merged });
        return nodeId;
      }

      graph.nodes.set(nodeId, createGraphNode({ nodeId, nodeType, metadata }));
      return nodeId;
    };

    const addEdge = (
      sourceNodeId: string,
      targetNodeId: string,
      relationType: GraphRelationType,
      metadata: GraphMetadata = {},
      weight = 1
    ): void => {
      const key = `${sourceNodeId}->${relationType}:${targetNodeId}`;
      if (edgeKeys.has(key)) {
        return;
      }

      const edge = createGraphEdge({ sourceNodeId, targetNodeId, relationType, metadata, weight });
      this.schema.assertEdgeAllowed(edge, graph.nodes);
      graph.edges.push(edge);
      edgeKeys.add(key);
    };

    const clinicianId = ensureClinician(input.clinician, ensureNode);
    const orgId = ensureOrg(input.clinician.org, ensureNode);
    addEdge(clinicianId, orgId, 'BELONGS_TO', {
      relationship: 'employed_by',
    });

    const homeStateId = ensureStateNode(input.clinician.state, ensureNode);
    addEdge(clinicianId, homeStateId, 'ELIGIBLE_IN', { reason: 'home_state' });

    const boardIndex = buildBoardIndex(input.boardCertifications);
    const payerIndex = new Map<string, string>();
    const payerIdIndex = new Map<string, string>();

    input.compactMemberships?.forEach((membership) => {
      const compactId = ensureCompactNode(membership, ensureNode);
      addEdge(clinicianId, compactId, 'ELIGIBLE_IN', {
        compact: membership.compactCode,
      });

      const stateId = ensureStateNode(membership.state, ensureNode);
      addEdge(compactId, stateId, 'ELIGIBLE_IN', { compact: membership.compactCode });
    });

    input.licenses.forEach((license) => {
      const licenseId = ensureLicenseNode(license, ensureNode);
      addEdge(clinicianId, licenseId, 'HAS_LICENSE', { status: license.status ?? 'active' });

      const licenseStateId = ensureStateNode(license.state, ensureNode);
      addEdge(licenseId, licenseStateId, 'ISSUED_BY', { state: license.state });
      addEdge(clinicianId, licenseStateId, 'ELIGIBLE_IN', { via: licenseId });

      const boardNodeId = resolveBoardForLicense(license, boardIndex, ensureNode);
      if (boardNodeId) {
        addEdge(licenseId, boardNodeId, 'VERIFIED_BY', {
          boardId: boardNodeId,
        });
      }
    });

    input.deaRegistrations?.forEach((dea) => {
      const deaId = ensureNode(dea.id, 'DEA', {
        schedule: dea.schedule,
      });
      addEdge(clinicianId, deaId, 'HAS_LICENSE', { category: 'DEA' });
      if (dea.licenseId) {
        addEdge(deaId, dea.licenseId, 'DEPENDS_ON', { reason: 'linked_license' });
      }
    });

    const pecosId = input.pecosEnrollment
      ? ensurePecosNode(input.pecosEnrollment, orgId, ensureNode)
      : undefined;
    if (pecosId) {
      addEdge(clinicianId, pecosId, 'DEPENDS_ON', { scope: 'PECOS' });
    }

    const medicaidIds =
      input.medicaidEnrollments?.map((enrollment) => {
        const medicaidId = ensureMedicaidNode(enrollment, ensureNode);
        addEdge(clinicianId, medicaidId, 'DEPENDS_ON', { program: 'MEDICAID' });
        const medicaidState = ensureStateNode(enrollment.state, ensureNode);
        addEdge(medicaidId, medicaidState, 'BELONGS_TO', { program: 'MEDICAID' });
        return medicaidId;
      }) ?? [];

    input.payerEnrollments?.forEach((enrollment) => {
      const payerNodeId = ensureNode(enrollment.payerId, 'PAYER', {
        payerName: enrollment.payerName,
        enrollmentId: enrollment.id,
      });
      payerIndex.set(enrollment.id, payerNodeId);
      payerIdIndex.set(enrollment.payerId, payerNodeId);
    });

    input.payerEnrollments?.forEach((enrollment) => {
      const payerNodeId = payerIdIndex.get(enrollment.payerId);
      if (!payerNodeId) {
        return;
      }

      addEdge(clinicianId, payerNodeId, 'DEPENDS_ON', { relationship: 'contracted' });

      if (enrollment.requiresPecos && pecosId) {
        addEdge(payerNodeId, pecosId, 'DEPENDS_ON', { reason: 'pecos_required' });
      }

      if (enrollment.requiresMedicaid && medicaidIds.length > 0) {
        medicaidIds.forEach((medicaidId) => {
          addEdge(payerNodeId, medicaidId, 'DEPENDS_ON', { reason: 'medicaid_panel' });
        });
      }

      enrollment.conflictsWith?.forEach((conflictKey) => {
        const conflictNodeId = payerIdIndex.get(conflictKey) ?? payerIndex.get(conflictKey);
        if (conflictNodeId) {
          addEdge(payerNodeId, conflictNodeId, 'IN_CONFLICT_WITH', {
            reason: 'network_overlap',
          });
        }
      });
    });

    input.privileges?.forEach((privilege) => {
      const privilegeNodeId = ensureNode(privilege.id, 'PRIVILEGE', privilege.metadata ?? {});
      const facilityOrgId = ensureOrg(
        {
          id: privilege.facilityId,
          name: privilege.facilityName,
        },
        ensureNode
      );
      addEdge(privilegeNodeId, facilityOrgId, 'BELONGS_TO', { reason: 'facility' });

      privilege.licenseIds.forEach((licenseId) => {
        addEdge(privilegeNodeId, licenseId, 'DEPENDS_ON', { relationship: 'credential_dependency' });
      });

      privilege.payerEnrollmentIds?.forEach((enrollmentId) => {
        const payerNodeId = payerIndex.get(enrollmentId);
        if (payerNodeId) {
          addEdge(privilegeNodeId, payerNodeId, 'DEPENDS_ON', { relationship: 'payer_requirement' });
        }
      });
    });

    input.vcs?.forEach((vc) => {
      const vcNodeId = ensureNode(vc.id, 'VC', {
        type: vc.type,
      });
      addEdge(vcNodeId, clinicianId, 'BELONGS_TO', { subject: 'clinician' });
      addEdge(vcNodeId, vc.subjectId, 'DEPENDS_ON', { reason: 'credential_subject' });

      if (vc.issuerOrgId) {
        ensureOrg(
          {
            id: vc.issuerOrgId,
            name: vc.issuerOrgId,
          },
          ensureNode
        );
        addEdge(vcNodeId, vc.issuerOrgId, 'VERIFIED_BY', { role: 'issuer' });
      } else {
        addEdge(vcNodeId, orgId, 'VERIFIED_BY', { role: 'issuer' });
      }
    });

    input.events?.forEach((event) => {
      const eventNodeId = ensureNode(event.id, 'EVENT', {
        type: event.type,
      });
      addEdge(eventNodeId, clinicianId, 'BELONGS_TO', { scope: 'credential_timeline' });
      addEdge(eventNodeId, event.relatesToId, 'DEPENDS_ON', { type: event.type });
    });

    return graph;
  }
}

type NodeEnsurer = (nodeId: string, nodeType: GraphNodeType, metadata?: GraphMetadata) => string;

function ensureClinician(clinician: ClinicianGraphInput, ensureNode: NodeEnsurer): string {
  return ensureNode(clinician.id, 'CLINICIAN', {
    npi: clinician.npi,
    name: clinician.name,
    ...clinician.metadata,
  });
}

function ensureOrg(org: OrgInput, ensureNode: NodeEnsurer): string {
  return ensureNode(org.id, 'ORG', {
    name: org.name,
    type: org.type,
    state: org.state,
    ...org.metadata,
  });
}

function ensureStateNode(state: string, ensureNode: NodeEnsurer): string {
  return ensureNode(stateNodeId(state), 'STATE', { state });
}

function ensureLicenseNode(license: LicenseInput, ensureNode: NodeEnsurer): string {
  return ensureNode(license.id, 'LICENSE', {
    number: license.number,
    state: license.state,
    category: license.category,
    status: license.status,
    ...license.metadata,
  });
}

function ensureCompactNode(membership: CompactMembershipInput, ensureNode: NodeEnsurer): string {
  return ensureNode(membership.id, 'COMPACT', {
    compactCode: membership.compactCode,
    state: membership.state,
    ...membership.metadata,
  });
}

function ensurePecosNode(
  pecos: PecosEnrollmentInput,
  orgId: string,
  ensureNode: NodeEnsurer
): string {
  const nodeId = ensureNode(pecos.id, 'PECOS', {
    status: pecos.status,
    orgId: pecos.orgId ?? orgId,
    ...pecos.metadata,
  });
  return nodeId;
}

function ensureMedicaidNode(enrollment: MedicaidEnrollmentInput, ensureNode: NodeEnsurer): string {
  return ensureNode(enrollment.id, 'MEDICAID', {
    state: enrollment.state,
    ...enrollment.metadata,
  });
}

function buildBoardIndex(inputs?: BoardCertificationInput[]): Map<string, BoardCertificationInput> {
  const index = new Map<string, BoardCertificationInput>();
  inputs?.forEach((cert) => {
    index.set(cert.boardId, cert);
  });
  return index;
}

function resolveBoardForLicense(
  license: LicenseInput,
  boardIndex: Map<string, BoardCertificationInput>,
  ensureNode: NodeEnsurer
): string | undefined {
  if (!license.boardId && !license.boardName) {
    return undefined;
  }

  const boardId = license.boardId ?? `board-${license.boardName}`;
  const boardEntry = boardIndex.get(boardId);

  return ensureNode(boardId, 'BOARD', {
    name: boardEntry?.name ?? license.boardName,
  });
}

function stateNodeId(code: string): string {
  return `state-${code.toUpperCase()}`;
}

