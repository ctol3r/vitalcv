/**
 * Interstate Compact Service
 *
 * Manages multi-state compact data:
 * - IMLC (Interstate Medical Licensure Compact)
 * - NLC (Nurse Licensure Compact) with 60-day residency rule
 * - PSYPACT (Psychology Interjurisdictional Compact) - APIT/TAP
 * - PT Compact, OT Compact
 * - APRN Compact (reserved for future)
 */

export type CompactType =
  | 'IMLC'
  | 'NLC'
  | 'PSYPACT'
  | 'PT'
  | 'OT'
  | 'APRN'
  | 'COUNSELING'
  | 'AUDIOLOGY';

export interface CompactMatrixEntry {
  id: string;
  compact: CompactType;
  state: string; // 2-letter code
  status: 'active' | 'pending' | 'inactive';
  specialRules?: CompactSpecialRules;
  effectiveDate?: Date;
  lastVerified: Date;
}

export interface CompactSpecialRules {
  nlc60DayResidency?: boolean;
  psypactApitOnly?: boolean;
  psypactTapOnly?: boolean;
  // Extensible for other compact-specific rules
  [key: string]: any;
}

export interface CompactQueryParams {
  compact?: CompactType;
  state?: string;
  status?: 'active' | 'pending' | 'inactive';
}

export class CompactService {
  /**
   * Query compact matrix
   */
  async queryCompacts(
    params: CompactQueryParams
  ): Promise<CompactMatrixEntry[]> {
    // TODO: Database query with filters
    // SELECT * FROM compact_matrix WHERE ...
    throw new Error('Not implemented');
  }

  /**
   * Get all states participating in a given compact
   */
  async getCompactStates(compact: CompactType): Promise<string[]> {
    const entries = await this.queryCompacts({ compact, status: 'active' });
    return entries.map((e) => e.state);
  }

  /**
   * Check if a state is a member of a specific compact
   */
  async isStateMember(
    compact: CompactType,
    state: string
  ): Promise<boolean> {
    const entries = await this.queryCompacts({ compact, state, status: 'active' });
    return entries.length > 0;
  }

  /**
   * Get special rules for a state in a compact
   */
  async getSpecialRules(
    compact: CompactType,
    state: string
  ): Promise<CompactSpecialRules | null> {
    const entries = await this.queryCompacts({ compact, state });
    if (entries.length === 0) return null;
    return entries[0].specialRules || null;
  }

  /**
   * Seed compact matrix from YAML
   */
  async seedCompactMatrix(yamlData: any): Promise<void> {
    // TODO: Parse YAML and bulk insert
    // Include:
    // - 50 states + DC, Guam, territories where applicable
    // - NLC with 60-day residency rule
    // - PSYPACT with APIT/TAP flags
    throw new Error('Not implemented');
  }

  /**
   * Validate NLC 60-day residency rule
   */
  async validateNLC60DayResidency(
    state: string,
    residencyDays: number
  ): Promise<boolean> {
    const rules = await this.getSpecialRules('NLC', state);
    if (rules?.nlc60DayResidency) {
      return residencyDays >= 60;
    }
    return true; // No special rule, passes by default
  }

  /**
   * Check PSYPACT authorization type (APIT vs TAP)
   */
  async checkPsypactAuthType(
    state: string,
    authType: 'APIT' | 'TAP'
  ): Promise<boolean> {
    const rules = await this.getSpecialRules('PSYPACT', state);
    if (!rules) return false;

    if (authType === 'APIT' && rules.psypactApitOnly === true) return true;
    if (authType === 'TAP' && rules.psypactTapOnly === true) return true;

    // If no restrictions, both types allowed
    if (!rules.psypactApitOnly && !rules.psypactTapOnly) return true;

    return false;
  }
}

export const compactService = new CompactService();

