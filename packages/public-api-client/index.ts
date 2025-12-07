/**
 * B235A-API-006: PublicAPIClientLibrary
 *
 * Provides a TypeScript client library for third-party developers to call the public API.
 * Supports GraphQL and REST.
 * Includes typings, auth helpers, error handling.
 */

export interface ClientConfig {
  /**
   * Base URL of the public API
   */
  baseUrl: string;

  /**
   * API key for authentication
   */
  apiKey?: string;

  /**
   * OAuth token for authentication
   */
  oauthToken?: string;

  /**
   * API version (default: v1)
   */
  version?: 'v1' | 'v2';

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
  }>;
}

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
}

export interface Credential {
  id: string;
  name: string;
  issuer: string;
  type: string;
  issuedAt: string;
  expiresAt: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  providerNpi: string | null;
}

export interface CredentialConnection {
  items: Credential[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Organization {
  id: string;
  name: string;
  region: string | null;
  specialty: string | null;
  averageRating: number | null;
  ratingCount: number;
  description: string | null;
}

export interface OrganizationConnection {
  items: Organization[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Module {
  id: string;
  name: string;
  version: string;
  description: string;
  vendorId: string;
  vendorName: string;
  capabilities: string[];
  price: number;
  currency: string;
  licenseType: 'PERPETUAL' | 'SUBSCRIPTION' | 'TRIAL' | 'ONE_TIME';
  averageRating: number | null;
  ratingCount: number;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  language: string;
  version: string;
  isPublic: boolean;
}

export interface CommunityPost {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  tags: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  reactionCount: number;
}

export interface CommunityPostConnection {
  items: CommunityPost[];
  pageInfo: PageInfo;
  totalCount: number;
}

export class PublicAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'PublicAPIError';
  }
}

/**
 * Public API Client
 */
export class PublicAPIClient {
  private config: Required<ClientConfig>;

  constructor(config: ClientConfig) {
    if (!config.baseUrl) {
      throw new Error('baseUrl is required');
    }

    if (!config.apiKey && !config.oauthToken) {
      throw new Error('Either apiKey or oauthToken is required');
    }

    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey || '',
      oauthToken: config.oauthToken || '',
      version: config.version || 'v1',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Get base URL with version
   */
  private getBaseUrl(): string {
    return `${this.config.baseUrl}/api/public/${this.config.version}`;
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): string {
    if (this.config.oauthToken) {
      return `Bearer ${this.config.oauthToken}`;
    }
    return `Bearer ${this.config.apiKey}`;
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
          'Accept': `application/vnd.chai-vc.${this.config.version}+json`,
          'X-API-Version': this.config.version,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new PublicAPIError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PublicAPIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PublicAPIError('Request timeout', 408);
      }

      throw new PublicAPIError(
        error instanceof Error ? error.message : 'Unknown error',
        0
      );
    }
  }

  /**
   * Execute GraphQL query
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    const url = `${this.getBaseUrl()}/graphql`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
          'Accept': `application/vnd.chai-vc.${this.config.version}+json`,
          'X-API-Version': this.config.version,
        },
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new PublicAPIError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      const result: GraphQLResponse<T> = await response.json();

      if (result.errors && result.errors.length > 0) {
        throw new PublicAPIError(
          result.errors[0].message,
          400,
          result.errors
        );
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PublicAPIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PublicAPIError('Request timeout', 408);
      }

      throw new PublicAPIError(
        error instanceof Error ? error.message : 'Unknown error',
        0
      );
    }
  }

  /**
   * Get credential by ID
   */
  async getCredential(id: string): Promise<Credential> {
    const query = `
      query GetCredential($id: ID!) {
        credential(id: $id) {
          id
          name
          issuer
          type
          issuedAt
          expiresAt
          status
          providerNpi
        }
      }
    `;

    const result = await this.query<{ credential: Credential }>(query, { id });
    if (!result.data?.credential) {
      throw new PublicAPIError('Credential not found', 404);
    }
    return result.data.credential;
  }

  /**
   * Search credentials
   */
  async searchCredentials(params: {
    providerNpi?: string;
    specialty?: string;
    type?: string;
    status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    pagination?: PaginationInput;
  }): Promise<CredentialConnection> {
    const query = `
      query SearchCredentials(
        $providerNpi: String
        $specialty: String
        $type: String
        $status: CredentialStatus
        $pagination: PaginationInput
      ) {
        credentials(
          providerNpi: $providerNpi
          specialty: $specialty
          type: $type
          status: $status
          pagination: $pagination
        ) {
          items {
            id
            name
            issuer
            type
            issuedAt
            expiresAt
            status
            providerNpi
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            nextCursor
            previousCursor
          }
          totalCount
        }
      }
    `;

    const result = await this.query<{ credentials: CredentialConnection }>(
      query,
      params
    );
    return result.data!.credentials;
  }

  /**
   * Search organizations
   */
  async searchOrganizations(params: {
    query?: string;
    region?: string;
    specialty?: string;
    pagination?: PaginationInput;
  }): Promise<OrganizationConnection> {
    const query = `
      query SearchOrganizations(
        $query: String
        $region: String
        $specialty: String
        $pagination: PaginationInput
      ) {
        searchOrganizations(
          query: $query
          region: $region
          specialty: $specialty
          pagination: $pagination
        ) {
          items {
            id
            name
            region
            specialty
            averageRating
            ratingCount
            description
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            nextCursor
            previousCursor
          }
          totalCount
        }
      }
    `;

    const result = await this.query<{ searchOrganizations: OrganizationConnection }>(
      query,
      params
    );
    return result.data!.searchOrganizations;
  }

  /**
   * Get organization by ID
   */
  async getOrganization(id: string): Promise<Organization> {
    const query = `
      query GetOrganization($id: ID!) {
        organization(id: $id) {
          id
          name
          region
          specialty
          averageRating
          ratingCount
          description
        }
      }
    `;

    const result = await this.query<{ organization: Organization }>(query, { id });
    if (!result.data?.organization) {
      throw new PublicAPIError('Organization not found', 404);
    }
    return result.data.organization;
  }
}

/**
 * Create a new Public API client instance
 */
export function createClient(config: ClientConfig): PublicAPIClient {
  return new PublicAPIClient(config);
}

// Default export
export default PublicAPIClient;

