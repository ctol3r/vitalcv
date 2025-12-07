/**
 * B235C-API-025: Postman Collection Generator
 *
 * Generates Postman collections from API definitions; includes environment variables
 * for API keys; versioned per API version; downloadable via DeveloperPortal.
 */

import fs from 'fs/promises';
import path from 'path';
import { GraphQLSchema, buildSchema, GraphQLObjectType } from 'graphql';

export interface PostmanCollectionOptions {
  apiVersion: string;
  apiBaseUrl: string;
  collectionName?: string;
  includeAuth?: boolean;
  includeExamples?: boolean;
}

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
    version?: string;
  };
  auth?: {
    type: string;
    [key: string]: any;
  };
  variable?: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  item: PostmanItem[];
}

export interface PostmanItem {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  description?: string;
}

export interface PostmanRequest {
  method: string;
  header?: Array<{
    key: string;
    value: string;
    type?: string;
  }>;
  body?: {
    mode: string;
    graphql?: {
      query: string;
      variables?: string;
    };
    raw?: string;
  };
  url?: {
    raw: string;
    host: string[];
    path: string[];
  };
  description?: string;
}

export class PostmanCollectionGenerator {
  private schema: GraphQLSchema | null = null;
  private openApiSpec: any = null;

  /**
   * Load GraphQL schema
   */
  async loadGraphQLSchema(schemaPathOrContent: string): Promise<void> {
    let schemaContent: string;

    if (schemaPathOrContent.includes('type ') || schemaPathOrContent.includes('type Query')) {
      schemaContent = schemaPathOrContent;
    } else {
      schemaContent = await fs.readFile(schemaPathOrContent, 'utf-8');
    }

    this.schema = buildSchema(schemaContent);
  }

  /**
   * Load OpenAPI spec
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
   * Generate Postman collection
   */
  async generate(options: PostmanCollectionOptions): Promise<PostmanCollection> {
    if (!this.schema) {
      throw new Error('GraphQL schema not loaded');
    }

    const collectionName = options.collectionName || `Chai VC Platform API v${options.apiVersion}`;

    const collection: PostmanCollection = {
      info: {
        name: collectionName,
        description: `Postman collection for Chai VC Platform API v${options.apiVersion}`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        version: options.apiVersion,
      },
      variable: [
        {
          key: 'base_url',
          value: options.apiBaseUrl,
          type: 'string',
        },
        {
          key: 'api_key',
          value: 'YOUR_API_KEY',
          type: 'string',
        },
      ],
      item: [],
    };

    // Add authentication
    if (options.includeAuth !== false) {
      collection.auth = {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{api_key}}',
            type: 'string',
          },
        ],
      };
    }

    // Generate query requests
    const queryItems = await this.generateQueryItems(options);
    if (queryItems.length > 0) {
      collection.item.push({
        name: 'Queries',
        description: 'GraphQL query operations',
        item: queryItems,
      });
    }

    // Generate mutation requests
    const mutationItems = await this.generateMutationItems(options);
    if (mutationItems.length > 0) {
      collection.item.push({
        name: 'Mutations',
        description: 'GraphQL mutation operations',
        item: mutationItems,
      });
    }

    return collection;
  }

  /**
   * Generate query items
   */
  private async generateQueryItems(options: PostmanCollectionOptions): Promise<PostmanItem[]> {
    if (!this.schema) {
      return [];
    }

    const queryType = this.schema.getQueryType();
    if (!queryType) {
      return [];
    }

    const items: PostmanItem[] = [];
    const fields = queryType.getFields();

    for (const [fieldName, field] of Object.entries(fields)) {
      const query = this.buildQueryExample(fieldName, field);
      const variables = this.buildVariablesExample(field.args);

      items.push({
        name: fieldName,
        description: field.description || `Query ${fieldName}`,
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Authorization',
              value: 'Bearer {{api_key}}',
            },
            {
              key: 'X-API-Key',
              value: '{{api_key}}',
            },
          ],
          body: {
            mode: 'graphql',
            graphql: {
              query,
              variables: variables ? JSON.stringify(variables, null, 2) : undefined,
            },
          },
          url: {
            raw: '{{base_url}}/graphql',
            host: ['{{base_url}}'],
            path: ['graphql'],
          },
        },
      });
    }

    return items;
  }

  /**
   * Generate mutation items
   */
  private async generateMutationItems(options: PostmanCollectionOptions): Promise<PostmanItem[]> {
    if (!this.schema) {
      return [];
    }

    const mutationType = this.schema.getMutationType();
    if (!mutationType) {
      return [];
    }

    const items: PostmanItem[] = [];
    const fields = mutationType.getFields();

    for (const [fieldName, field] of Object.entries(fields)) {
      const mutation = this.buildMutationExample(fieldName, field);
      const variables = this.buildVariablesExample(field.args);

      items.push({
        name: fieldName,
        description: field.description || `Mutation ${fieldName}`,
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Authorization',
              value: 'Bearer {{api_key}}',
            },
            {
              key: 'X-API-Key',
              value: '{{api_key}}',
            },
          ],
          body: {
            mode: 'graphql',
            graphql: {
              query: mutation,
              variables: variables ? JSON.stringify(variables, null, 2) : undefined,
            },
          },
          url: {
            raw: '{{base_url}}/graphql',
            host: ['{{base_url}}'],
            path: ['graphql'],
          },
        },
      });
    }

    return items;
  }

  /**
   * Build query example
   */
  private buildQueryExample(fieldName: string, field: any): string {
    const args = field.args.map((arg: any) => {
      const type = this.getTypeString(arg.type);
      return `$${arg.name}: ${type}`;
    });

    const argsString = args.length > 0 ? `(${args.join(', ')})` : '';
    const fieldArgs = field.args.map((arg: any) => `${arg.name}: $${arg.name}`).join(', ');
    const fieldArgsString = fieldArgs ? `(${fieldArgs})` : '';

    return `query ${this.capitalize(fieldName)}${args.length > 0 ? `(${args.join(', ')})` : ''} {
  ${fieldName}${fieldArgsString} {
    id
    name
  }
}`;
  }

  /**
   * Build mutation example
   */
  private buildMutationExample(fieldName: string, field: any): string {
    const args = field.args.map((arg: any) => {
      const type = this.getTypeString(arg.type);
      return `$${arg.name}: ${type}`;
    });

    const fieldArgs = field.args.map((arg: any) => `${arg.name}: $${arg.name}`).join(', ');
    const fieldArgsString = fieldArgs ? `(${fieldArgs})` : '';

    return `mutation ${this.capitalize(fieldName)}${args.length > 0 ? `(${args.join(', ')})` : ''} {
  ${fieldName}${fieldArgsString} {
    id
  }
}`;
  }

  /**
   * Build variables example
   */
  private buildVariablesExample(args: any[]): Record<string, any> | null {
    if (args.length === 0) {
      return null;
    }

    const variables: Record<string, any> = {};
    for (const arg of args) {
      const type = this.getTypeString(arg.type);
      if (type.includes('String')) {
        variables[arg.name] = 'example';
      } else if (type.includes('Int')) {
        variables[arg.name] = 1;
      } else if (type.includes('Float')) {
        variables[arg.name] = 1.0;
      } else if (type.includes('Boolean')) {
        variables[arg.name] = true;
      } else if (type.includes('ID')) {
        variables[arg.name] = 'example-id';
      } else {
        variables[arg.name] = null;
      }
    }

    return variables;
  }

  /**
   * Get type string representation
   */
  private getTypeString(type: any): string {
    if (type.name) return type.name;
    if (type.ofType) {
      const inner = this.getTypeString(type.ofType);
      if (type.kind === 'NON_NULL') return `${inner}!`;
      if (type.kind === 'LIST') return `[${inner}]`;
      return inner;
    }
    return type.kind || 'String';
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate Postman environment file
   */
  generateEnvironment(apiBaseUrl: string, apiKey?: string): any {
    return {
      name: 'Chai VC Platform API',
      values: [
        {
          key: 'base_url',
          value: apiBaseUrl,
          type: 'default',
          enabled: true,
        },
        {
          key: 'api_key',
          value: apiKey || 'YOUR_API_KEY',
          type: 'secret',
          enabled: true,
        },
      ],
      _postman_variable_scope: 'environment',
    };
  }

  /**
   * Write collection to file
   */
  async writeCollection(collection: PostmanCollection, outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(collection, null, 2), 'utf-8');
  }

  /**
   * Write environment to file
   */
  async writeEnvironment(environment: any, outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(environment, null, 2), 'utf-8');
  }
}

