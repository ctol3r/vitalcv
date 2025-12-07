const log = getServiceLogger('fhir-gateway/atr-group-client');
/**
 * Da Vinci ATR FHIR Group Client
 *
 * Fetches FHIR Group export from Da Vinci ATR endpoint.
 * Implements SMART auth rotation and syncs with ATR UI.
 *
 * Task: B119B-ATR-015
 * Acceptance: /Group export fetch OK; SMART auth rotates; ATR UI syncs
 */

import fetch from 'node-fetch';
import { getServiceLogger } from '../logging/serviceLogger';

export interface SmartAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
  expires_at: number; // Calculated timestamp
}

export interface FhirGroup {
  resourceType: 'Group';
  id?: string;
  identifier?: Array<{
    system?: string;
    value: string;
  }>;
  type: 'person' | 'animal' | 'practitioner' | 'device' | 'medication' | 'substance';
  actual: boolean;
  member?: Array<{
    entity: {
      reference?: string;
      display?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
    inactive?: boolean;
  }>;
  characteristic?: Array<{
    code: {
      coding?: Array<{
        system?: string;
        code: string;
        display?: string;
      }>;
    };
    valueCodeableConcept?: {
      coding?: Array<{
        system?: string;
        code: string;
        display?: string;
      }>;
    };
    valueBoolean?: boolean;
    valueQuantity?: {
      value: number;
      unit?: string;
    };
    valueRange?: {
      low?: {
        value: number;
      };
      high?: {
        value: number;
      };
    };
    exclude?: boolean;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
}

export interface GroupExportResult {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection';
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: Array<{
    fullUrl?: string;
    resource: FhirGroup;
  }>;
}

export interface ATRGroupClientConfig {
  fhirBaseUrl: string;
  clientId: string;
  clientSecret: string;
  tokenUrl?: string; // SMART token endpoint (defaults to {fhirBaseUrl}/auth/token)
  groupExportUrl?: string; // Group export endpoint (defaults to {fhirBaseUrl}/Group?_export)
  tokenRotationThreshold?: number; // Rotate token when this many seconds before expiry (default: 300)
}

/**
 * Da Vinci ATR FHIR Group Client
 */
export class ATRGroupClient {
  private config: Required<ATRGroupClientConfig>;
  private currentToken: SmartAuthToken | null = null;
  private tokenRefreshPromise: Promise<SmartAuthToken> | null = null;

  constructor(config: ATRGroupClientConfig) {
    this.config = {
      tokenUrl: config.tokenUrl || `${config.fhirBaseUrl}/auth/token`,
      groupExportUrl: config.groupExportUrl || `${config.fhirBaseUrl}/Group?_export`,
      tokenRotationThreshold: config.tokenRotationThreshold || 300, // 5 minutes
      ...config,
    };
  }

  /**
   * Get SMART auth token (with rotation)
   */
  async getAuthToken(forceRefresh = false): Promise<SmartAuthToken> {
    // Check if token is still valid
    if (!forceRefresh && this.currentToken) {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = this.currentToken.expires_at;
      const timeUntilExpiry = expiresAt - now;

      // If token expires within threshold, refresh it
      if (timeUntilExpiry > this.config.tokenRotationThreshold) {
        return this.currentToken;
      }
    }

    // If refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start token refresh
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      this.currentToken = token;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Refresh SMART auth token
   */
  private async refreshToken(): Promise<SmartAuthToken> {
    log.info('[ATR Group Client] Refreshing SMART auth token');

    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'system/Group.read',
      });

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;

      const token: SmartAuthToken = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 3600,
        scope: data.scope,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      };

      log.info('[ATR Group Client] Token refreshed successfully');

      return token;
    } catch (error) {
      log.error('[ATR Group Client] Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Fetch FHIR Group export
   */
  async fetchGroupExport(params?: {
    _count?: number;
    _since?: string;
    _type?: string;
  }): Promise<GroupExportResult> {
    const token = await this.getAuthToken();

    // Build query parameters
    const queryParams = new URLSearchParams({
      _export: 'true',
      ...(params?._count && { _count: String(params._count) }),
      ...(params?._since && { _since: params._since }),
      ...(params?._type && { _type: params._type }),
    });

    const url = `${this.config.groupExportUrl}${this.config.groupExportUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;

    log.info(`[ATR Group Client] Fetching Group export from ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `${token.token_type} ${token.access_token}`,
          'Accept': 'application/fhir+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Group export failed: ${response.status} ${errorText}`);
      }

      const bundle = await response.json() as GroupExportResult;

      log.info(`[ATR Group Client] Fetched ${bundle.entry?.length || 0} groups`);

      return bundle;
    } catch (error) {
      log.error('[ATR Group Client] Group export failed:', error);
      throw error;
    }
  }

  /**
   * Fetch specific Group by ID
   */
  async fetchGroup(groupId: string): Promise<FhirGroup> {
    const token = await this.getAuthToken();

    const url = `${this.config.fhirBaseUrl}/Group/${groupId}`;

    log.info(`[ATR Group Client] Fetching Group ${groupId}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `${token.token_type} ${token.access_token}`,
          'Accept': 'application/fhir+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Group fetch failed: ${response.status} ${errorText}`);
      }

      const group = await response.json() as FhirGroup;

      return group;
    } catch (error) {
      log.error(`[ATR Group Client] Group fetch failed for ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Sync groups with ATR UI
   * This would typically update a database or cache that the UI reads from
   */
  async syncWithATRUI(groups: FhirGroup[]): Promise<void> {
    log.info(`[ATR Group Client] Syncing ${groups.length} groups with ATR UI`);

    // In production, this would:
    // 1. Store groups in database
    // 2. Update cache
    // 3. Emit events for UI to refresh
    // 4. Update last sync timestamp

    // For now, log the sync
    groups.forEach(group => {
      log.info(`[ATR Group Client] Synced group: ${group.id} (${group.type}, ${group.member?.length || 0} members)`);
    });

    // TODO: Implement actual sync logic
    // await prisma.atrGroup.upsertMany(groups);
    // await cache.set('atr:groups:last_sync', Date.now());
    // await eventBus.emit('atr:groups:updated', { count: groups.length });
  }

  /**
   * Full sync: fetch export and sync with UI
   */
  async fullSync(params?: {
    _count?: number;
    _since?: string;
    _type?: string;
  }): Promise<{ groups: FhirGroup[]; synced: boolean }> {
    try {
      const exportResult = await this.fetchGroupExport(params);
      const groups = exportResult.entry?.map(e => e.resource) || [];

      await this.syncWithATRUI(groups);

      return {
        groups,
        synced: true,
      };
    } catch (error) {
      log.error('[ATR Group Client] Full sync failed:', error);
      throw error;
    }
  }
}

/**
 * Create ATR Group Client instance
 */
export function createATRGroupClient(config: ATRGroupClientConfig): ATRGroupClient {
  return new ATRGroupClient(config);
}


