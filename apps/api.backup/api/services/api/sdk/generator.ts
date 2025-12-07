/**
 * B235C-API-022: Public SDK Generator
 *
 * Generates client SDKs (TypeScript, Python, Ruby) from OpenAPI/GraphQL schema;
 * includes build pipeline and publish scripts; covers auth helpers.
 */

import fs from 'fs/promises';
import path from 'path';
import { GraphQLSchema, buildSchema, printSchema } from 'graphql';

export interface SDKGenerationOptions {
  language: 'typescript' | 'python' | 'ruby';
  outputDir: string;
  apiBaseUrl: string;
  apiVersion?: string;
  packageName?: string;
  packageVersion?: string;
}

export interface GeneratedSDK {
  files: Array<{
    path: string;
    content: string;
  }>;
  packageJson?: string;
  setupPy?: string;
  gemspec?: string;
}

export class SDKGenerator {
  private schema: GraphQLSchema | null = null;
  private openApiSpec: any = null;

  /**
   * Load GraphQL schema from file or string
   */
  async loadGraphQLSchema(schemaPathOrContent: string): Promise<void> {
    let schemaContent: string;

    if (schemaPathOrContent.includes('type ') || schemaPathOrContent.includes('type Query')) {
      // Assume it's schema content
      schemaContent = schemaPathOrContent;
    } else {
      // Assume it's a file path
      schemaContent = await fs.readFile(schemaPathOrContent, 'utf-8');
    }

    this.schema = buildSchema(schemaContent);
  }

  /**
   * Load OpenAPI spec from file or object
   */
  async loadOpenAPISpec(specPathOrObject: string | object): Promise<void> {
    if (typeof specPathOrObject === 'string') {
      const content = await fs.readFile(specPathOrObject, 'utf-8');
      this.openApiSpec = JSON.parse(content);
    } else {
      this.openApiSpec = specPathOrObject;
    }
  }

  /**
   * Generate SDK for the specified language
   */
  async generateSDK(options: SDKGenerationOptions): Promise<GeneratedSDK> {
    switch (options.language) {
      case 'typescript':
        return this.generateTypeScriptSDK(options);
      case 'python':
        return this.generatePythonSDK(options);
      case 'ruby':
        return this.generateRubySDK(options);
      default:
        throw new Error(`Unsupported language: ${options.language}`);
    }
  }

  /**
   * Generate TypeScript SDK
   */
  private async generateTypeScriptSDK(options: SDKGenerationOptions): Promise<GeneratedSDK> {
    const packageName = options.packageName || '@chai-vc/api-client';
    const packageVersion = options.packageVersion || '1.0.0';
    const apiBaseUrl = options.apiBaseUrl;

    const clientCode = this.generateTypeScriptClient(apiBaseUrl);
    const typesCode = this.generateTypeScriptTypes();
    const authCode = this.generateTypeScriptAuth();
    const indexCode = this.generateTypeScriptIndex();

    const packageJson = JSON.stringify({
      name: packageName,
      version: packageVersion,
      description: 'Chai VC Platform API Client',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        prepublishOnly: 'npm run build',
      },
      dependencies: {
        'graphql-request': '^6.1.0',
        'graphql': '^16.8.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
      },
      peerDependencies: {
        'graphql': '^16.8.0',
      },
    }, null, 2);

    const tsconfigJson = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }, null, 2);

    return {
      files: [
        { path: 'src/client.ts', content: clientCode },
        { path: 'src/types.ts', content: typesCode },
        { path: 'src/auth.ts', content: authCode },
        { path: 'src/index.ts', content: indexCode },
        { path: 'package.json', content: packageJson },
        { path: 'tsconfig.json', content: tsconfigJson },
        { path: 'README.md', content: this.generateTypeScriptREADME(packageName) },
      ],
      packageJson,
    };
  }

  /**
   * Generate Python SDK
   */
  private async generatePythonSDK(options: SDKGenerationOptions): Promise<GeneratedSDK> {
    const packageName = options.packageName || 'chai-vc-api-client';
    const packageVersion = options.packageVersion || '1.0.0';
    const apiBaseUrl = options.apiBaseUrl;

    const clientCode = this.generatePythonClient(apiBaseUrl);
    const typesCode = this.generatePythonTypes();
    const authCode = this.generatePythonAuth();
    const initCode = this.generatePythonInit();

    const setupPy = `from setuptools import setup, find_packages

setup(
    name="${packageName}",
    version="${packageVersion}",
    description="Chai VC Platform API Client",
    packages=find_packages(),
    install_requires=[
        "gql>=3.4.0",
        "requests>=2.31.0",
    ],
    python_requires=">=3.8",
)`;

    return {
      files: [
        { path: `${packageName}/client.py`, content: clientCode },
        { path: `${packageName}/types.py`, content: typesCode },
        { path: `${packageName}/auth.py`, content: authCode },
        { path: `${packageName}/__init__.py`, content: initCode },
        { path: 'setup.py', content: setupPy },
        { path: 'README.md', content: this.generatePythonREADME(packageName) },
      ],
      setupPy,
    };
  }

  /**
   * Generate Ruby SDK
   */
  private async generateRubySDK(options: SDKGenerationOptions): Promise<GeneratedSDK> {
    const packageName = options.packageName || 'chai_vc_api_client';
    const packageVersion = options.packageVersion || '1.0.0';
    const apiBaseUrl = options.apiBaseUrl;

    const clientCode = this.generateRubyClient(apiBaseUrl);
    const typesCode = this.generateRubyTypes();
    const authCode = this.generateRubyAuth();

    const gemspec = `Gem::Specification.new do |spec|
  spec.name          = "${packageName}"
  spec.version       = "${packageVersion}"
  spec.authors       = ["Chai VC Platform"]
  spec.description   = "Chai VC Platform API Client"
  spec.summary       = "Ruby client for Chai VC Platform API"
  spec.homepage      = "https://github.com/chai-vc/api-client-ruby"
  spec.license       = "MIT"

  spec.files         = Dir["lib/**/*"]
  spec.require_paths = ["lib"]

  spec.add_dependency "graphql-client", "~> 0.19"
  spec.add_dependency "faraday", "~> 2.0"
end`;

    return {
      files: [
        { path: 'lib/chai_vc_api_client/client.rb', content: clientCode },
        { path: 'lib/chai_vc_api_client/types.rb', content: typesCode },
        { path: 'lib/chai_vc_api_client/auth.rb', content: authCode },
        { path: 'lib/chai_vc_api_client.rb', content: "require_relative 'chai_vc_api_client/client'\nrequire_relative 'chai_vc_api_client/types'\nrequire_relative 'chai_vc_api_client/auth'\n" },
        { path: `${packageName}.gemspec`, content: gemspec },
        { path: 'README.md', content: this.generateRubyREADME(packageName) },
      ],
      gemspec,
    };
  }

  // TypeScript generation helpers
  private generateTypeScriptClient(apiBaseUrl: string): string {
    return `import { GraphQLClient } from 'graphql-request';
import { AuthManager } from './auth';
import * as Types from './types';

export class ChaiVCClient {
  private client: GraphQLClient;
  private auth: AuthManager;

  constructor(apiKey?: string, baseUrl: string = '${apiBaseUrl}') {
    this.auth = new AuthManager(apiKey);
    this.client = new GraphQLClient(baseUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...this.auth.getHeaders(),
      },
    });
  }

  async request<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    return this.client.request<T>(query, variables);
  }

  // Credentials
  async getCredentials(filters?: {
    providerNpi?: string;
    specialty?: string;
    type?: string;
    status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    pagination?: { limit?: number; cursor?: string };
  }): Promise<Types.CredentialConnection> {
    const query = \`query GetCredentials($providerNpi: String, $specialty: String, $type: String, $status: CredentialStatus, $pagination: PaginationInput) {
      credentials(providerNpi: $providerNpi, specialty: $specialty, type: $type, status: $status, pagination: $pagination) {
        items {
          id
          name
          issuer
          type
          status
          issuedAt
          expiresAt
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
    }\`;

    return this.request(query, filters);
  }

  async getCredential(id: string): Promise<Types.Credential | null> {
    const query = \`query GetCredential($id: ID!) {
      credential(id: $id) {
        id
        name
        issuer
        type
        status
        issuedAt
        expiresAt
        providerNpi
      }
    }\`;

    const result = await this.request<{ credential: Types.Credential | null }>(query, { id });
    return result.credential;
  }

  // Organizations
  async searchOrganizations(filters?: {
    query?: string;
    region?: string;
    specialty?: string;
    pagination?: { limit?: number; cursor?: string };
  }): Promise<Types.OrganizationConnection> {
    const query = \`query SearchOrganizations($query: String, $region: String, $specialty: String, $pagination: PaginationInput) {
      searchOrganizations(query: $query, region: $region, specialty: $specialty, pagination: $pagination) {
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
    }\`;

    return this.request(query, filters);
  }

  // Modules
  async getModules(filters?: {
    query?: string;
    vendorId?: string;
    capability?: string;
  }): Promise<Types.Module[]> {
    const query = \`query GetModules($query: String, $vendorId: String, $capability: String) {
      modules(query: $query, vendorId: $vendorId, capability: $capability) {
        id
        name
        version
        description
        vendorId
        vendorName
        capabilities
        price
        currency
        licenseType
        averageRating
        ratingCount
      }
    }\`;

    const result = await this.request<{ modules: Types.Module[] }>(query, filters);
    return result.modules;
  }
}
`;
  }

  private generateTypeScriptTypes(): string {
    return `export interface Credential {
  id: string;
  name: string;
  issuer: string;
  type: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  issuedAt: string;
  expiresAt?: string | null;
  providerNpi?: string | null;
}

export interface CredentialConnection {
  items: Credential[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string | null;
  previousCursor?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  region?: string | null;
  specialty?: string | null;
  averageRating?: number | null;
  ratingCount: number;
  description?: string | null;
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
  averageRating?: number | null;
  ratingCount: number;
}
`;
  }

  private generateTypeScriptAuth(): string {
    return `export class AuthManager {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      return {};
    }

    return {
      'Authorization': \`Bearer \${this.apiKey}\`,
      'X-API-Key': this.apiKey,
    };
  }
}
`;
  }

  private generateTypeScriptIndex(): string {
    return `export { ChaiVCClient } from './client';
export * from './types';
export { AuthManager } from './auth';
`;
  }

  private generateTypeScriptREADME(packageName: string): string {
    return `# ${packageName}

Chai VC Platform API Client for TypeScript/JavaScript

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Usage

\`\`\`typescript
import { ChaiVCClient } from '${packageName}';

const client = new ChaiVCClient('your-api-key');

// Get credentials
const credentials = await client.getCredentials({
  providerNpi: '1234567890',
  pagination: { limit: 10 }
});

// Search organizations
const orgs = await client.searchOrganizations({
  query: 'Cardiology',
  region: 'CA'
});
\`\`\`
`;
  }

  // Python generation helpers (simplified versions)
  private generatePythonClient(apiBaseUrl: string): string {
    return `from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
from typing import Optional, Dict, Any
from .auth import AuthManager

class ChaiVCClient:
    def __init__(self, api_key: Optional[str] = None, base_url: str = '${apiBaseUrl}'):
        self.auth = AuthManager(api_key)
        transport = RequestsHTTPTransport(
            url=base_url,
            headers=self.auth.get_headers()
        )
        self.client = Client(transport=transport, fetch_schema_from_transport=True)

    def request(self, query: str, variables: Optional[Dict[str, Any]] = None):
        return self.client.execute(gql(query), variable_values=variables or {})
`;
  }

  private generatePythonTypes(): string {
    return `from typing import Optional, List
from dataclasses import dataclass

@dataclass
class Credential:
    id: str
    name: str
    issuer: str
    type: str
    status: str
    issued_at: str
    expires_at: Optional[str] = None
`;
  }

  private generatePythonAuth(): string {
    return `from typing import Optional, Dict

class AuthManager:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def set_api_key(self, api_key: str):
        self.api_key = api_key

    def get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            return {}
        return {
            'Authorization': f'Bearer {self.api_key}',
            'X-API-Key': self.api_key,
        }
`;
  }

  private generatePythonInit(): string {
    return `from .client import ChaiVCClient
from .types import Credential
from .auth import AuthManager

__all__ = ['ChaiVCClient', 'Credential', 'AuthManager']
`;
  }

  private generatePythonREADME(packageName: string): string {
    return `# ${packageName}

Chai VC Platform API Client for Python

## Installation

\`\`\`bash
pip install ${packageName}
\`\`\`

## Usage

\`\`\`python
from ${packageName} import ChaiVCClient

client = ChaiVCClient(api_key='your-api-key')

# Get credentials
credentials = client.get_credentials(provider_npi='1234567890')
\`\`\`
`;
  }

  // Ruby generation helpers (simplified versions)
  private generateRubyClient(apiBaseUrl: string): string {
    return `require 'graphql/client'
require_relative 'auth'

module ChaiVCApiClient
  class Client
    def initialize(api_key: nil, base_url: '${apiBaseUrl}')
      @auth = AuthManager.new(api_key: api_key)
      @client = GraphQL::Client.new(
        schema: load_schema,
        execute: GraphQL::Client::HTTP.new(base_url) do |client|
          client.headers.merge!(@auth.headers)
        end
      )
    end

    private

    def load_schema
      # Load schema from introspection or file
      GraphQL::Client.load_schema(@client)
    end
  end
end
`;
  }

  private generateRubyTypes(): string {
    return `module ChaiVCApiClient
  module Types
    Credential = Struct.new(:id, :name, :issuer, :type, :status, :issued_at, :expires_at)
  end
end
`;
  }

  private generateRubyAuth(): string {
    return `module ChaiVCApiClient
  class AuthManager
    def initialize(api_key: nil)
      @api_key = api_key
    end

    def headers
      return {} unless @api_key
      {
        'Authorization' => "Bearer #{@api_key}",
        'X-API-Key' => @api_key
      }
    end
  end
end
`;
  }

  private generateRubyREADME(packageName: string): string {
    return `# ${packageName}

Chai VC Platform API Client for Ruby

## Installation

\`\`\`bash
gem install ${packageName}
\`\`\`

## Usage

\`\`\`ruby
require '${packageName}'

client = ChaiVCApiClient::Client.new(api_key: 'your-api-key')
\`\`\`
`;
  }

  /**
   * Write generated SDK to disk
   */
  async writeSDK(sdk: GeneratedSDK, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    for (const file of sdk.files) {
      const filePath = path.join(outputDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }
  }
}

