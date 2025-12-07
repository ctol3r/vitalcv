/**
 * B226A-INT-002: LicensingBoardIntegrationService
 *
 * Connects to state licensing board APIs to get real-time license status,
 * disciplinary actions, and renewal dates. Updates Enrollment and Reputation services.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('interop/licensing/licensingBoardService');
const prisma = new PrismaClient();

interface LicenseStatus {
  licenseNumber: string;
  state: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' | 'PENDING';
  issueDate?: Date;
  expirationDate?: Date;
  renewalDate?: Date;
  licenseType: string;
  specialty?: string;
}

interface DisciplinaryAction {
  actionId: string;
  licenseNumber: string;
  state: string;
  actionType: string;
  actionDate: Date;
  description: string;
  status: 'ACTIVE' | 'RESOLVED' | 'APPEALED';
  penalty?: string;
  metadata?: Record<string, any>;
}

interface BoardApiConfig {
  baseUrl: string;
  apiKey?: string;
  authToken?: string;
  timeout?: number;
}

class LicensingBoardIntegrationService {
  private readonly boardConfigs: Map<string, BoardApiConfig> = new Map();

  constructor() {
    // Initialize board configurations from environment
    // Format: LICENSING_BOARD_{STATE}_URL, LICENSING_BOARD_{STATE}_API_KEY
    const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];

    states.forEach(state => {
      const baseUrl = process.env[`LICENSING_BOARD_${state}_URL`];
      const apiKey = process.env[`LICENSING_BOARD_${state}_API_KEY`];

      if (baseUrl) {
        this.boardConfigs.set(state, {
          baseUrl,
          apiKey,
          timeout: 30000,
        });
      }
    });
  }

  /**
   * Get configuration for a specific state board
   */
  private getBoardConfig(state: string): BoardApiConfig | null {
    return this.boardConfigs.get(state.toUpperCase()) || null;
  }

  /**
   * Make authenticated API request to licensing board
   */
  private async makeBoardRequest(
    state: string,
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<any> {
    const config = this.getBoardConfig(state);
    if (!config) {
      throw new Error(`No configuration found for state: ${state}`);
    }

    const url = new URL(endpoint, config.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    log.debug('Making licensing board request', { state, endpoint, url: url.toString() });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Licensing board API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout for ${state} licensing board`);
      }
      throw error;
    }
  }

  /**
   * Get license status from state board
   */
  async getLicenseStatus(
    licenseNumber: string,
    state: string
  ): Promise<LicenseStatus | null> {
    log.info('Fetching license status', { licenseNumber, state });

    try {
      const data = await this.makeBoardRequest(state, '/api/licenses/status', {
        licenseNumber,
      });

      return {
        licenseNumber: data.licenseNumber || licenseNumber,
        state: data.state || state,
        status: this.mapStatus(data.status),
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined,
        licenseType: data.licenseType || 'unknown',
        specialty: data.specialty,
      };
    } catch (error) {
      log.error('Failed to fetch license status', { licenseNumber, state, error });
      return null;
    }
  }

  /**
   * Get disciplinary actions for a license
   */
  async getDisciplinaryActions(
    licenseNumber: string,
    state: string,
    since?: Date
  ): Promise<DisciplinaryAction[]> {
    log.info('Fetching disciplinary actions', { licenseNumber, state, since });

    try {
      const params: Record<string, string> = { licenseNumber };
      if (since) {
        params.since = since.toISOString();
      }

      const data = await this.makeBoardRequest(state, '/api/licenses/disciplinary', params);
      const actions = Array.isArray(data) ? data : (data.actions || []);

      return actions.map((action: any) => ({
        actionId: action.id || action.actionId,
        licenseNumber: action.licenseNumber || licenseNumber,
        state: action.state || state,
        actionType: action.actionType || action.type || 'unknown',
        actionDate: new Date(action.actionDate || action.date),
        description: action.description || action.summary || '',
        status: this.mapActionStatus(action.status),
        penalty: action.penalty,
        metadata: action,
      }));
    } catch (error) {
      log.error('Failed to fetch disciplinary actions', { licenseNumber, state, error });
      return [];
    }
  }

  /**
   * Get renewal dates for a license
   */
  async getRenewalDates(
    licenseNumber: string,
    state: string
  ): Promise<Date | null> {
    log.info('Fetching renewal dates', { licenseNumber, state });

    try {
      const status = await this.getLicenseStatus(licenseNumber, state);
      return status?.renewalDate || status?.expirationDate || null;
    } catch (error) {
      log.error('Failed to fetch renewal dates', { licenseNumber, state, error });
      return null;
    }
  }

  /**
   * Update enrollment service with license status
   */
  private async updateEnrollmentService(
    npi: string,
    licenseStatus: LicenseStatus
  ): Promise<void> {
    try {
      // Find NPI claim
      const npiClaim = await prisma.npiClaim.findUnique({
        where: { npi },
      });

      if (!npiClaim) {
        log.warn('NPI claim not found for license update', { npi });
        return;
      }

      // Update or create state license verification
      // Note: This assumes a StateLicenseVerification model exists
      // If not, we'll store in tags/evidence
      await prisma.npiClaim.update({
        where: { npi },
        data: {
          tags: {
            ...(npiClaim.tags as any || {}),
            licenses: {
              ...((npiClaim.tags as any)?.licenses || {}),
              [licenseStatus.state]: {
                licenseNumber: licenseStatus.licenseNumber,
                status: licenseStatus.status,
                expirationDate: licenseStatus.expirationDate,
                renewalDate: licenseStatus.renewalDate,
                lastChecked: new Date(),
              },
            },
          },
          updatedAt: new Date(),
        },
      });

      log.debug('Updated enrollment service with license status', { npi, state: licenseStatus.state });
    } catch (error) {
      log.error('Failed to update enrollment service', { npi, error });
      throw error;
    }
  }

  /**
   * Update reputation service with disciplinary actions
   */
  private async updateReputationService(
    npi: string,
    actions: DisciplinaryAction[]
  ): Promise<void> {
    try {
      // Import reputation service if available
      // For now, we'll store in audit events
      for (const action of actions) {
        await prisma.auditEvent.create({
          data: {
            type: 'LICENSING_DISCIPLINARY_ACTION',
            subjectNpi: npi,
            data: {
              actionId: action.actionId,
              state: action.state,
              actionType: action.actionType,
              actionDate: action.actionDate,
              description: action.description,
              status: action.status,
              penalty: action.penalty,
            },
          },
        });
      }

      log.debug('Updated reputation service with disciplinary actions', { npi, count: actions.length });
    } catch (error) {
      log.error('Failed to update reputation service', { npi, error });
      throw error;
    }
  }

  /**
   * Sync license data for a provider
   */
  async syncProviderLicenseData(
    npi: string,
    licenseNumber: string,
    state: string
  ): Promise<{
    licenseStatus: LicenseStatus | null;
    disciplinaryActions: DisciplinaryAction[];
    renewalDate: Date | null;
  }> {
    log.info('Syncing provider license data', { npi, licenseNumber, state });

    try {
      const [licenseStatus, disciplinaryActions, renewalDate] = await Promise.all([
        this.getLicenseStatus(licenseNumber, state),
        this.getDisciplinaryActions(licenseNumber, state),
        this.getRenewalDates(licenseNumber, state),
      ]);

      // Update enrollment service
      if (licenseStatus) {
        await this.updateEnrollmentService(npi, licenseStatus);
      }

      // Update reputation service
      if (disciplinaryActions.length > 0) {
        await this.updateReputationService(npi, disciplinaryActions);
      }

      log.info('Provider license data synced', {
        npi,
        state,
        hasStatus: !!licenseStatus,
        actionsCount: disciplinaryActions.length,
        hasRenewalDate: !!renewalDate,
      });

      return {
        licenseStatus,
        disciplinaryActions,
        renewalDate,
      };
    } catch (error) {
      log.error('Failed to sync provider license data', { npi, licenseNumber, state, error });
      throw error;
    }
  }

  /**
   * Map external status to internal status
   */
  private mapStatus(externalStatus: string): LicenseStatus['status'] {
    const status = externalStatus?.toUpperCase() || '';
    if (status.includes('ACTIVE') || status.includes('VALID')) return 'ACTIVE';
    if (status.includes('SUSPEND')) return 'SUSPENDED';
    if (status.includes('REVOKE')) return 'REVOKED';
    if (status.includes('EXPIRE')) return 'EXPIRED';
    if (status.includes('PENDING')) return 'PENDING';
    return 'ACTIVE'; // Default
  }

  /**
   * Map external action status to internal status
   */
  private mapActionStatus(externalStatus: string): DisciplinaryAction['status'] {
    const status = externalStatus?.toUpperCase() || '';
    if (status.includes('RESOLVE') || status.includes('CLOSED')) return 'RESOLVED';
    if (status.includes('APPEAL')) return 'APPEALED';
    return 'ACTIVE'; // Default
  }
}

export const licensingBoardService = new LicensingBoardIntegrationService();
export default licensingBoardService;

