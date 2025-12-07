/**
 * B235C-API-023: API Documentation Generator
 *
 * Produces static and interactive documentation pages from GraphQL comments
 * and OpenAPI specs; includes code examples and error glossary; integrates with DeveloperPortal.
 */

import fs from 'fs/promises';
import path from 'path';
import { GraphQLSchema, buildSchema, printSchema, GraphQLObjectType, GraphQLField, GraphQLInputObjectType } from 'graphql';

export interface DocumentationOptions {
  outputDir: string;
  format: 'html' | 'markdown' | 'json';
  includeExamples?: boolean;
  includeErrorGlossary?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export interface DocumentationPage {
  title: string;
  content: string;
  path: string;
  sections: DocumentationSection[];
}

export interface DocumentationSection {
  title: string;
  content: string;
  codeExamples?: CodeExample[];
}

export interface CodeExample {
  language: string;
  code: string;
  description?: string;
}

export class DocumentationGenerator {
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
   * Generate documentation
   */
  async generate(options: DocumentationOptions): Promise<DocumentationPage[]> {
    if (!this.schema) {
      throw new Error('GraphQL schema not loaded');
    }

    const pages: DocumentationPage[] = [];

    // Generate overview page
    pages.push(await this.generateOverviewPage(options));

    // Generate queries documentation
    pages.push(await this.generateQueriesPage(options));

    // Generate types documentation
    pages.push(await this.generateTypesPage(options));

    // Generate mutations documentation (if any)
    if (this.schema.getMutationType()) {
      pages.push(await this.generateMutationsPage(options));
    }

    // Generate error glossary
    if (options.includeErrorGlossary !== false) {
      pages.push(await this.generateErrorGlossaryPage(options));
    }

    // Generate authentication page
    pages.push(await this.generateAuthPage(options));

    return pages;
  }

  /**
   * Generate overview page
   */
  private async generateOverviewPage(options: DocumentationOptions): Promise<DocumentationPage> {
    const sections: DocumentationSection[] = [
      {
        title: 'Introduction',
        content: `# API Documentation

Welcome to the Chai VC Platform API documentation. This API provides programmatic access to credential data, organizations, marketplace modules, and more.

## Base URL

\`${process.env.API_BASE_URL || 'https://api.example.com'}\`

## Authentication

All API requests require authentication via API key. Include your API key in the request headers:

\`\`\`
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
\`\`\`

## Rate Limits

- **Free tier**: 1,000 requests per hour
- **Pro tier**: 10,000 requests per hour
- **Enterprise**: Custom limits

## GraphQL Endpoint

\`POST /graphql\`

All queries and mutations are sent to a single GraphQL endpoint.`,
        codeExamples: options.includeExamples ? [
          {
            language: 'curl',
            code: `curl -X POST https://api.example.com/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query { credentials { items { id name } } }"
  }'`,
          },
        ] : undefined,
      },
    ];

    return {
      title: 'API Overview',
      path: 'overview',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  /**
   * Generate queries documentation page
   */
  private async generateQueriesPage(options: DocumentationOptions): Promise<DocumentationPage> {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const queryType = this.schema.getQueryType();
    if (!queryType) {
      return {
        title: 'Queries',
        path: 'queries',
        content: 'No queries available',
        sections: [],
      };
    }

    const fields = queryType.getFields();
    const sections: DocumentationSection[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const fieldType = field.type;
      const description = field.description || `Query ${fieldName}`;

      // Build query example
      const args = field.args.map(arg => {
        const argType = this.getTypeString(arg.type);
        return `  $${arg.name}: ${argType}`;
      }).join('\n');

      const queryExample = `query ${this.capitalize(fieldName)}(${args ? args + '\n' : ''}) {
  ${fieldName}${this.formatArgs(field.args)} {
    ${this.getExampleFields(fieldType)}
  }
}`;

      sections.push({
        title: fieldName,
        content: `${description}\n\n**Return Type**: \`${this.getTypeString(fieldType)}\`\n\n**Arguments**:\n${this.formatArguments(field.args)}`,
        codeExamples: options.includeExamples ? [
          {
            language: 'graphql',
            code: queryExample,
            description: `Example query for ${fieldName}`,
          },
          {
            language: 'typescript',
            code: `const query = \`${queryExample}\`;\nconst result = await client.request(query);`,
          },
        ] : undefined,
      });
    }

    return {
      title: 'Queries',
      path: 'queries',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  /**
   * Generate types documentation page
   */
  private async generateTypesPage(options: DocumentationOptions): Promise<DocumentationPage> {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const typeMap = this.schema.getTypeMap();
    const sections: DocumentationSection[] = [];

    for (const [typeName, type] of Object.entries(typeMap)) {
      // Skip internal types and scalars
      if (typeName.startsWith('__') || typeName === 'Query' || typeName === 'Mutation') {
        continue;
      }

      if (type instanceof GraphQLObjectType) {
        const fields = type.getFields();
        const fieldsDoc = Object.entries(fields)
          .map(([fieldName, field]) => {
            const fieldType = this.getTypeString(field.type);
            const desc = field.description ? ` - ${field.description}` : '';
            return `- **${fieldName}**: \`${fieldType}\`${desc}`;
          })
          .join('\n');

        sections.push({
          title: typeName,
          content: `${type.description || `Type: ${typeName}`}\n\n**Fields**:\n\n${fieldsDoc}`,
        });
      } else if (type instanceof GraphQLInputObjectType) {
        const fields = type.getFields();
        const fieldsDoc = Object.entries(fields)
          .map(([fieldName, field]) => {
            const fieldType = this.getTypeString(field.type);
            const desc = field.description ? ` - ${field.description}` : '';
            return `- **${fieldName}**: \`${fieldType}\`${desc}`;
          })
          .join('\n');

        sections.push({
          title: typeName,
          content: `${type.description || `Input Type: ${typeName}`}\n\n**Fields**:\n\n${fieldsDoc}`,
        });
      }
    }

    return {
      title: 'Types',
      path: 'types',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  /**
   * Generate mutations documentation page
   */
  private async generateMutationsPage(options: DocumentationOptions): Promise<DocumentationPage> {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const mutationType = this.schema.getMutationType();
    if (!mutationType) {
      return {
        title: 'Mutations',
        path: 'mutations',
        content: 'No mutations available',
        sections: [],
      };
    }

    const fields = mutationType.getFields();
    const sections: DocumentationSection[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const description = field.description || `Mutation ${fieldName}`;
      const mutationExample = `mutation ${this.capitalize(fieldName)}(${this.formatArgs(field.args)}) {
  ${fieldName} {
    ${this.getExampleFields(field.type)}
  }
}`;

      sections.push({
        title: fieldName,
        content: `${description}\n\n**Arguments**:\n${this.formatArguments(field.args)}`,
        codeExamples: options.includeExamples ? [
          {
            language: 'graphql',
            code: mutationExample,
          },
        ] : undefined,
      });
    }

    return {
      title: 'Mutations',
      path: 'mutations',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  /**
   * Generate error glossary page
   */
  private async generateErrorGlossaryPage(options: DocumentationOptions): Promise<DocumentationPage> {
    const errors = [
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        description: 'The request did not include a valid API key or authentication token.',
        statusCode: 401,
      },
      {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        description: 'The API key does not have the required scopes for this operation.',
        statusCode: 403,
      },
      {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        description: 'The requested resource does not exist.',
        statusCode: 404,
      },
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        description: 'Too many requests. Please wait before retrying.',
        statusCode: 429,
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        description: 'The request contains invalid or missing required fields.',
        statusCode: 400,
      },
      {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        description: 'An unexpected error occurred. Please try again later.',
        statusCode: 500,
      },
    ];

    const sections: DocumentationSection[] = [
      {
        title: 'Error Response Format',
        content: `All errors follow a consistent format:

\`\`\`json
{
  "errors": [
    {
      "message": "Error message",
      "extensions": {
        "code": "ERROR_CODE",
        "statusCode": 400
      }
    }
  ]
}
\`\`\``,
      },
      {
        title: 'Error Codes',
        content: errors.map(err =>
          `### ${err.code} (${err.statusCode})\n\n**Message**: ${err.message}\n\n**Description**: ${err.description}`
        ).join('\n\n'),
      },
    ];

    return {
      title: 'Error Glossary',
      path: 'errors',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  /**
   * Generate authentication page
   */
  private async generateAuthPage(options: DocumentationOptions): Promise<DocumentationPage> {
    const sections: DocumentationSection[] = [
      {
        title: 'API Keys',
        content: `## Getting an API Key

1. Sign up for a developer account
2. Navigate to the Developer Portal
3. Create a new API key
4. Copy and securely store your API key

## Using API Keys

Include your API key in all requests:

\`\`\`
Authorization: Bearer YOUR_API_KEY
X-API-Key: YOUR_API_KEY
\`\`\`

## Scopes

API keys can have different scopes that control access:

- \`read:credentials\` - Read credential data
- \`read:organizations\` - Read organization data
- \`read:modules\` - Read marketplace modules
- \`read:contracts\` - Read contract templates
- \`read:community\` - Read community posts`,
        codeExamples: options.includeExamples ? [
          {
            language: 'curl',
            code: `curl -X POST https://api.example.com/graphql \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"query": "query { ... }"}'`,
          },
        ] : undefined,
      },
    ];

    return {
      title: 'Authentication',
      path: 'authentication',
      content: this.formatContent(sections, options.format),
      sections,
    };
  }

  // Helper methods
  private formatContent(sections: DocumentationSection[], format: string): string {
    if (format === 'markdown') {
      return sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');
    }
    if (format === 'json') {
      return JSON.stringify(sections, null, 2);
    }
    // HTML format would require more complex templating
    return sections.map(s => `<h2>${s.title}</h2>\n<p>${s.content}</p>`).join('\n');
  }

  private getTypeString(type: any): string {
    if (type.name) return type.name;
    if (type.ofType) {
      const inner = this.getTypeString(type.ofType);
      if (type.kind === 'NON_NULL') return `${inner}!`;
      if (type.kind === 'LIST') return `[${inner}]`;
      return inner;
    }
    return type.kind || 'Unknown';
  }

  private formatArguments(args: any[]): string {
    if (args.length === 0) return 'None';
    return args.map(arg => {
      const type = this.getTypeString(arg.type);
      const desc = arg.description ? ` - ${arg.description}` : '';
      const defaultValue = arg.defaultValue !== undefined ? ` (default: ${JSON.stringify(arg.defaultValue)})` : '';
      return `- **${arg.name}**: \`${type}\`${desc}${defaultValue}`;
    }).join('\n');
  }

  private formatArgs(args: any[]): string {
    if (args.length === 0) return '';
    const argStrings = args.map(arg => {
      const type = this.getTypeString(arg.type);
      return `$${arg.name}: ${type}`;
    });
    return `(\n    ${argStrings.join(',\n    ')}\n  )`;
  }

  private getExampleFields(type: any): string {
    // Simplified - would need to traverse the type to get actual fields
    return 'id\n    name';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Write documentation to disk
   */
  async writeDocumentation(pages: DocumentationPage[], outputDir: string, format: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    for (const page of pages) {
      const extension = format === 'json' ? 'json' : format === 'html' ? 'html' : 'md';
      const filePath = path.join(outputDir, `${page.path}.${extension}`);
      await fs.writeFile(filePath, page.content, 'utf-8');
    }
  }
}

