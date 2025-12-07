/**
 * B226A-INT-001: FhirTefcaConnector
 *
 * Fetches provider enrollment, credential updates, and event notifications
 * from TEFCA FHIR endpoints. Writes updates to local queue and portfolio.
 * Handles auth tokens and paging.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';
import Queue from 'bull';

const log = getServiceLogger('interop/tefca/fhirConnector');
const prisma = new PrismaClient();

// Queue for processing TEFCA events
const tefcaQueue = new Queue('tefca-events', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

interface TefcaAuthToken {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  refreshToken?: string;
}

interface TefcaFhirResource {
  resourceType: string;
  id: string;
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
  [key: string]: any;
}

interface TefcaFhirBundle {
  resourceType: 'Bundle';
  type: 'searchset' | 'history' | 'collection';
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry?: Array<{
    resource: TefcaFhirResource;
    fullUrl?: string;
  }>;
}

interface ProviderEnrollment {
  npi: string;
  enrollmentId: string;
  status: string;
  enrollmentDate?: Date;
  lastUpdated?: Date;
  metadata?: Record<string, any>;
}

interface CredentialUpdate {
  credentialId: string;
  npi: string;
  credentialType: string;
  status: string;
  issuedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

interface EventNotification {
  eventId: string;
  eventType: string;
  npi?: string;
  timestamp: Date;
  payload: Record<string, any>;
}

class FhirTefcaConnector {
  private authToken: TefcaAuthToken | null = null;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenEndpoint: string;

  constructor() {
    this.baseUrl = process.env.TEFCA_FHIR_BASE_URL || 'https://api.tefca.gov/fhir';
    this.clientId = process.env.TEFCA_CLIENT_ID || '';
    this.clientSecret = process.env.TEFCA_CLIENT_SECRET || '';
    this.tokenEndpoint = process.env.TEFCA_TOKEN_ENDPOINT || `${this.baseUrl}/oauth/token`;
  }

  /**
   * Get or refresh authentication token
   */
  private async getAuthToken(): Promise<string> {
    if (this.authToken && this.authToken.expiresAt > new Date()) {
      return this.authToken.accessToken;
    }

    log.info('Fetching new TEFCA auth token');

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'fhir/Provider.read fhir/Credential.read fhir/Event.read',
        }),
      });

      if (!response.ok) {
        throw new Error(`TEFCA auth failed: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      const expiresIn = tokenData.expires_in || 3600;

      this.authToken = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000), // Refresh 60s early
        refreshToken: tokenData.refresh_token,
      };

      log.info('TEFCA auth token obtained', { expiresAt: this.authToken.expiresAt });
      return this.authToken.accessToken;
    } catch (error) {
      log.error('Failed to obtain TEFCA auth token', { error });
      throw error;
    }
  }

  /**
   * Fetch FHIR resources with paging support
   */
  private async fetchFhirResource(
    resourceType: string,
    params: Record<string, string> = {},
    pageToken?: string
  ): Promise<TefcaFhirBundle> {
    const token = await this.getAuthToken();
    const url = new URL(`${this.baseUrl}/${resourceType}`, this.baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Add paging token if provided
    if (pageToken) {
      url.searchParams.append('_page', pageToken);
    }

    log.debug('Fetching FHIR resource', { resourceType, url: url.toString() });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all pages of a FHIR resource
   */
  private async fetchAllPages(
    resourceType: string,
    params: Record<string, string> = {}
  ): Promise<TefcaFhirResource[]> {
    const allResources: TefcaFhirResource[] = [];
    let pageToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const bundle = await this.fetchFhirResource(resourceType, params, pageToken);

      if (bundle.entry) {
        allResources.push(...bundle.entry.map(e => e.resource));
      }

      // Check for next page link
      const nextLink = bundle.link?.find(l => l.relation === 'next');
      if (nextLink) {
        const nextUrl = new URL(nextLink.url);
        pageToken = nextUrl.searchParams.get('_page') || undefined;
        hasMore = !!pageToken;
      } else {
        hasMore = false;
      }

      log.debug('Fetched page', { resourceType, count: bundle.entry?.length || 0, hasMore });
    }

    return allResources;
  }

  /**
   * Fetch provider enrollment data
   */
  async fetchProviderEnrollments(since?: Date): Promise<ProviderEnrollment[]> {
    log.info('Fetching provider enrollments', { since });

    const params: Record<string, string> = {
      _sort: '_lastUpdated',
    };

    if (since) {
      params['_lastUpdated'] = `ge${since.toISOString()}`;
    }

    const resources = await this.fetchAllPages('Provider', params);

    return resources.map(resource => ({
      npi: resource.identifier?.find((id: any) => id.system === 'http://hl7.org/fhir/sid/us-npi')?.value || '',
      enrollmentId: resource.id,
      status: resource.status || 'unknown',
      enrollmentDate: resource.period?.start ? new Date(resource.period.start) : undefined,
      lastUpdated: resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated) : undefined,
      metadata: resource,
    })).filter(e => e.npi); // Filter out entries without NPI
  }

  /**
   * Fetch credential updates
   */
  async fetchCredentialUpdates(since?: Date): Promise<CredentialUpdate[]> {
    log.info('Fetching credential updates', { since });

    const params: Record<string, string> = {
      _sort: '_lastUpdated',
    };

    if (since) {
      params['_lastUpdated'] = `ge${since.toISOString()}`;
    }

    const resources = await this.fetchAllPages('Credential', params);

    return resources.map(resource => ({
      credentialId: resource.id,
      npi: resource.subject?.identifier?.value || '',
      credentialType: resource.type?.coding?.[0]?.code || 'unknown',
      status: resource.status || 'unknown',
      issuedAt: resource.issued ? new Date(resource.issued) : undefined,
      expiresAt: resource.expirationDate ? new Date(resource.expirationDate) : undefined,
      metadata: resource,
    })).filter(c => c.npi); // Filter out entries without NPI
  }

  /**
   * Fetch event notifications
   */
  async fetchEventNotifications(since?: Date): Promise<EventNotification[]> {
    log.info('Fetching event notifications', { since });

    const params: Record<string, string> = {
      _sort: '_lastUpdated',
    };

    if (since) {
      params['_lastUpdated'] = `ge${since.toISOString()}`;
    }

    const resources = await this.fetchAllPages('Event', params);

    return resources.map(resource => ({
      eventId: resource.id,
      eventType: resource.type?.coding?.[0]?.code || 'unknown',
      npi: resource.subject?.identifier?.value,
      timestamp: resource.timestamp ? new Date(resource.timestamp) : new Date(),
      payload: resource,
    }));
  }

  /**
   * Write enrollment updates to portfolio
   */
  private async writeEnrollmentToPortfolio(enrollment: ProviderEnrollment): Promise<void> {
    try {
      // Update or create NpiClaim record
      await prisma.npiClaim.upsert({
        where: { npi: enrollment.npi },
        update: {
          updatedAt: new Date(),
          // Store enrollment metadata in tags or evidence
          tags: {
            ...(await prisma.npiClaim.findUnique({ where: { npi: enrollment.npi } }))?.tags as any || {},
            tefcaEnrollment: {
              enrollmentId: enrollment.enrollmentId,
              status: enrollment.status,
              lastUpdated: enrollment.lastUpdated,
            },
          },
        },
        create: {
          npi: enrollment.npi,
          userId: 'system', // Will need to link to actual user
          level: 0,
          tags: {
            tefcaEnrollment: {
              enrollmentId: enrollment.enrollmentId,
              status: enrollment.status,
              enrollmentDate: enrollment.enrollmentDate,
            },
          },
        },
      });

      log.debug('Written enrollment to portfolio', { npi: enrollment.npi });
    } catch (error) {
      log.error('Failed to write enrollment to portfolio', { npi: enrollment.npi, error });
      throw error;
    }
  }

  /**
   * Write credential update to portfolio
   */
  private async writeCredentialToPortfolio(update: CredentialUpdate): Promise<void> {
    try {
      // Find user by NPI
      const npiClaim = await prisma.npiClaim.findUnique({
        where: { npi: update.npi },
      });

      if (!npiClaim) {
        log.warn('NPI claim not found for credential update', { npi: update.npi });
        return;
      }

      // Upsert credential
      await prisma.credential.upsert({
        where: {
          id: update.credentialId,
        },
        update: {
          status: update.status,
          expiresAt: update.expiresAt,
          updatedAt: new Date(),
        },
        create: {
          id: update.credentialId,
          name: update.credentialType,
          issuer: 'TEFCA',
          type: update.credentialType,
          status: update.status,
          issuedAt: update.issuedAt,
          expiresAt: update.expiresAt,
          userId: npiClaim.userId,
        },
      });

      log.debug('Written credential to portfolio', { credentialId: update.credentialId });
    } catch (error) {
      log.error('Failed to write credential to portfolio', { credentialId: update.credentialId, error });
      throw error;
    }
  }

  /**
   * Queue event notification for processing
   */
  private async queueEventNotification(event: EventNotification): Promise<void> {
    try {
      await tefcaQueue.add('tefca-event', {
        eventId: event.eventId,
        eventType: event.eventType,
        npi: event.npi,
        timestamp: event.timestamp,
        payload: event.payload,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      log.debug('Queued event notification', { eventId: event.eventId });
    } catch (error) {
      log.error('Failed to queue event notification', { eventId: event.eventId, error });
      throw error;
    }
  }

  /**
   * Main sync method - fetches and processes all updates
   */
  async sync(since?: Date): Promise<{
    enrollments: number;
    credentials: number;
    events: number;
  }> {
    log.info('Starting TEFCA FHIR sync', { since });

    try {
      // Fetch all updates
      const [enrollments, credentials, events] = await Promise.all([
        this.fetchProviderEnrollments(since),
        this.fetchCredentialUpdates(since),
        this.fetchEventNotifications(since),
      ]);

      // Write enrollments to portfolio
      for (const enrollment of enrollments) {
        await this.writeEnrollmentToPortfolio(enrollment);
      }

      // Write credentials to portfolio
      for (const credential of credentials) {
        await this.writeCredentialToPortfolio(credential);
      }

      // Queue events for processing
      for (const event of events) {
        await this.queueEventNotification(event);
      }

      log.info('TEFCA FHIR sync completed', {
        enrollments: enrollments.length,
        credentials: credentials.length,
        events: events.length,
      });

      return {
        enrollments: enrollments.length,
        credentials: credentials.length,
        events: events.length,
      };
    } catch (error) {
      log.error('TEFCA FHIR sync failed', { error });
      throw error;
    }
  }
}

export const fhirTefcaConnector = new FhirTefcaConnector();
export default fhirTefcaConnector;

