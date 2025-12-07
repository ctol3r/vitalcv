/**
 * Professional Identity Graph
 * Task 2: Add Professional Identity Graph (specialties → credentials → roles)
 *
 * Models the professional identity as a graph structure connecting
 * specialties, credentials, and roles with weighted relationships.
 */

export interface Specialty {
  id: string;
  name: string;
  category: string;
  credentialCount: number;
  confidence: number;
}

export interface CredentialNode {
  id: string;
  type: string;
  issuer: string;
  issuedAt: Date;
  expiresAt?: Date;
  specialties: string[]; // Specialty IDs
  roles: string[]; // Role IDs
  value: number; // 0-1
}

export interface RoleNode {
  id: string;
  title: string;
  organization?: string;
  startDate: Date;
  endDate?: Date;
  specialties: string[]; // Specialty IDs
  credentials: string[]; // Credential IDs
  matchScore: number; // 0-1
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'specialty-credential' | 'credential-role' | 'specialty-role';
  weight: number; // 0-1
  evidence: string[];
}

export interface ProfessionalIdentityGraph {
  specialties: Map<string, Specialty>;
  credentials: Map<string, CredentialNode>;
  roles: Map<string, RoleNode>;
  edges: GraphEdge[];
  lastUpdated: Date;
}

export class ProfessionalIdentityGraph {
  private graph: ProfessionalIdentityGraph;

  constructor() {
    this.graph = {
      specialties: new Map(),
      credentials: new Map(),
      roles: new Map(),
      edges: [],
      lastUpdated: new Date(),
    };
  }

  /**
   * Add or update a specialty
   */
  addSpecialty(specialty: Specialty): void {
    this.graph.specialties.set(specialty.id, specialty);
    this.graph.lastUpdated = new Date();
  }

  /**
   * Add or update a credential
   */
  addCredential(credential: CredentialNode): void {
    this.graph.credentials.set(credential.id, credential);

    // Create edges to specialties
    credential.specialties.forEach((specialtyId) => {
      this.addEdge({
        from: specialtyId,
        to: credential.id,
        type: 'specialty-credential',
        weight: 1.0,
        evidence: [`Credential ${credential.id} required for specialty ${specialtyId}`],
      });
    });

    // Create edges to roles
    credential.roles.forEach((roleId) => {
      this.addEdge({
        from: credential.id,
        to: roleId,
        type: 'credential-role',
        weight: this.calculateCredentialRoleWeight(credential, roleId),
        evidence: [`Credential ${credential.id} enables role ${roleId}`],
      });
    });

    this.graph.lastUpdated = new Date();
  }

  /**
   * Add or update a role
   */
  addRole(role: RoleNode): void {
    this.graph.roles.set(role.id, role);

    // Create edges from credentials
    role.credentials.forEach((credentialId) => {
      this.addEdge({
        from: credentialId,
        to: role.id,
        type: 'credential-role',
        weight: 1.0,
        evidence: [`Role ${role.id} requires credential ${credentialId}`],
      });
    });

    // Create edges from specialties
    role.specialties.forEach((specialtyId) => {
      this.addEdge({
        from: specialtyId,
        to: role.id,
        type: 'specialty-role',
        weight: 0.8,
        evidence: [`Role ${role.id} aligns with specialty ${specialtyId}`],
      });
    });

    this.graph.lastUpdated = new Date();
  }

  /**
   * Find credentials for a specialty
   */
  getCredentialsForSpecialty(specialtyId: string): CredentialNode[] {
    const credentialIds = this.graph.edges
      .filter((e) => e.from === specialtyId && e.type === 'specialty-credential')
      .map((e) => e.to);

    return credentialIds
      .map((id) => this.graph.credentials.get(id))
      .filter((c): c is CredentialNode => c !== undefined);
  }

  /**
   * Find roles for a specialty
   */
  getRolesForSpecialty(specialtyId: string): RoleNode[] {
    const roleIds = this.graph.edges
      .filter((e) => e.from === specialtyId && e.type === 'specialty-role')
      .map((e) => e.to);

    return roleIds
      .map((id) => this.graph.roles.get(id))
      .filter((r): r is RoleNode => r !== undefined);
  }

  /**
   * Calculate credential value for a specialty
   */
  calculateCredentialValue(credentialId: string, specialtyId: string): number {
    const credential = this.graph.credentials.get(credentialId);
    if (!credential) return 0;

    const baseValue = credential.value;
    const specialtyMatch = credential.specialties.includes(specialtyId) ? 1.0 : 0.5;

    // Boost if credential enables multiple roles
    const roleCount = this.graph.edges.filter(
      (e) => e.from === credentialId && e.type === 'credential-role'
    ).length;
    const roleBoost = Math.min(0.2, roleCount * 0.05);

    return Math.min(1, baseValue * specialtyMatch + roleBoost);
  }

  /**
   * Get credential alignment score for a role
   */
  getCredentialAlignmentForRole(roleId: string): {
    credentials: Array<{ id: string; alignment: number; gap: boolean }>;
    overallScore: number;
  } {
    const role = this.graph.roles.get(roleId);
    if (!role) {
      return { credentials: [], overallScore: 0 };
    }

    const credentials = role.credentials.map((credId) => {
      const credential = this.graph.credentials.get(credId);
      if (!credential) {
        return { id: credId, alignment: 0, gap: true };
      }

      const edge = this.graph.edges.find(
        (e) => e.from === credId && e.to === roleId && e.type === 'credential-role'
      );

      return {
        id: credId,
        alignment: edge?.weight ?? 0.5,
        gap: !edge,
      };
    });

    const overallScore = credentials.reduce(
      (sum, c) => sum + c.alignment,
      0
    ) / Math.max(1, credentials.length);

    return { credentials, overallScore };
  }

  /**
   * Detect mismatches between credentials, roles, and regions
   */
  detectMismatches(region?: string): Array<{
    type: 'credential-role' | 'credential-specialty' | 'role-specialty';
    from: string;
    to: string;
    severity: 'high' | 'medium' | 'low';
    reason: string;
  }> {
    const mismatches: Array<{
      type: 'credential-role' | 'credential-specialty' | 'role-specialty';
      from: string;
      to: string;
      severity: 'high' | 'medium' | 'low';
      reason: string;
    }> = [];

    // Check credential-role mismatches
    this.graph.roles.forEach((role) => {
      role.credentials.forEach((credId) => {
        const credential = this.graph.credentials.get(credId);
        if (!credential) {
          mismatches.push({
            type: 'credential-role',
            from: credId,
            to: role.id,
            severity: 'high',
            reason: 'Credential not found in graph',
          });
        } else if (credential.expiresAt && credential.expiresAt < new Date()) {
          mismatches.push({
            type: 'credential-role',
            from: credId,
            to: role.id,
            severity: 'high',
            reason: 'Credential expired',
          });
        }
      });
    });

    // Check specialty alignment
    this.graph.credentials.forEach((credential) => {
      credential.specialties.forEach((specialtyId) => {
        if (!this.graph.specialties.has(specialtyId)) {
          mismatches.push({
            type: 'credential-specialty',
            from: credential.id,
            to: specialtyId,
            severity: 'medium',
            reason: 'Specialty not found in graph',
          });
        }
      });
    });

    return mismatches;
  }

  /**
   * Get the full graph structure
   */
  getGraph(): ProfessionalIdentityGraph {
    return {
      specialties: new Map(this.graph.specialties),
      credentials: new Map(this.graph.credentials),
      roles: new Map(this.graph.roles),
      edges: [...this.graph.edges],
      lastUpdated: this.graph.lastUpdated,
    };
  }

  private addEdge(edge: GraphEdge): void {
    // Avoid duplicates
    const exists = this.graph.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (!exists) {
      this.graph.edges.push(edge);
    }
  }

  private calculateCredentialRoleWeight(
    credential: CredentialNode,
    roleId: string
  ): number {
    const role = this.graph.roles.get(roleId);
    if (!role) return 0.5;

    // Base weight from credential value
    let weight = credential.value;

    // Boost if credential is listed in role's required credentials
    if (role.credentials.includes(credential.id)) {
      weight = Math.min(1, weight + 0.3);
    }

    // Boost if specialties align
    const sharedSpecialties = credential.specialties.filter((s) =>
      role.specialties.includes(s)
    );
    weight += sharedSpecialties.length * 0.1;

    return Math.min(1, weight);
  }
}

