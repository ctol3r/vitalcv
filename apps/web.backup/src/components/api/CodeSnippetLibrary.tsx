/**
 * B235C-API-024: Code Snippet Library
 *
 * Provides reusable snippets in multiple languages for common tasks
 * (fetch credentials, create contracts, search providers); searchable; copy-to-clipboard.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Search } from 'lucide-react';

interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  languages: {
    [key: string]: string;
  };
}

const SNIPPETS: CodeSnippet[] = [
  {
    id: 'fetch-credentials',
    title: 'Fetch Credentials',
    description: 'Query credentials for a provider by NPI',
    category: 'Credentials',
    tags: ['credentials', 'query', 'npi'],
    languages: {
      typescript: `import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient('https://api.example.com/graphql', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const query = \`query GetCredentials($npi: String!) {
  credentials(providerNpi: $npi) {
    items {
      id
      name
      issuer
      type
      status
      issuedAt
      expiresAt
    }
    totalCount
  }
}\`;

const variables = {
  npi: '1234567890',
};

const data = await client.request(query, variables);
console.log(data.credentials);`,
      python: `from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

transport = RequestsHTTPTransport(
    url='https://api.example.com/graphql',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

client = Client(transport=transport, fetch_schema_from_transport=True)

query = gql("""
  query GetCredentials($npi: String!) {
    credentials(providerNpi: $npi) {
      items {
        id
        name
        issuer
        type
        status
        issuedAt
        expiresAt
      }
      totalCount
    }
  }
""")

variables = {'npi': '1234567890'}
result = client.execute(query, variable_values=variables)
print(result)`,
      curl: `curl -X POST https://api.example.com/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query GetCredentials($npi: String!) { credentials(providerNpi: $npi) { items { id name issuer type status } totalCount } }",
    "variables": {"npi": "1234567890"}
  }'`,
    },
  },
  {
    id: 'search-providers',
    title: 'Search Providers',
    description: 'Search for providers by specialty and region',
    category: 'Providers',
    tags: ['search', 'providers', 'specialty'],
    languages: {
      typescript: `const query = \`query SearchProviders($specialty: String, $region: String) {
  searchOrganizations(
    specialty: $specialty
    region: $region
    pagination: { limit: 20 }
  ) {
    items {
      id
      name
      region
      specialty
      averageRating
      ratingCount
    }
    pageInfo {
      hasNextPage
      nextCursor
    }
    totalCount
  }
}\`;

const variables = {
  specialty: 'Cardiology',
  region: 'CA',
};

const data = await client.request(query, variables);`,
      python: `query = gql("""
  query SearchProviders($specialty: String, $region: String) {
    searchOrganizations(
      specialty: $specialty
      region: $region
      pagination: { limit: 20 }
    ) {
      items {
        id
        name
        region
        specialty
        averageRating
        ratingCount
      }
      pageInfo {
        hasNextPage
        nextCursor
      }
      totalCount
    }
  }
""")

variables = {'specialty': 'Cardiology', 'region': 'CA'}
result = client.execute(query, variable_values=variables)`,
      curl: `curl -X POST https://api.example.com/graphql \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query SearchProviders($specialty: String, $region: String) { searchOrganizations(specialty: $specialty, region: $region) { items { id name region specialty } totalCount } }",
    "variables": {"specialty": "Cardiology", "region": "CA"}
  }'`,
    },
  },
  {
    id: 'list-modules',
    title: 'List Marketplace Modules',
    description: 'Browse available modules in the marketplace',
    category: 'Marketplace',
    tags: ['modules', 'marketplace', 'browse'],
    languages: {
      typescript: `const query = \`query ListModules($capability: String) {
  modules(capability: $capability) {
    id
    name
    version
    description
    vendorName
    capabilities
    price
    currency
    licenseType
    averageRating
    ratingCount
  }
}\`;

const variables = {
  capability: 'credentialing',
};

const data = await client.request(query, variables);`,
      python: `query = gql("""
  query ListModules($capability: String) {
    modules(capability: $capability) {
      id
      name
      version
      description
      vendorName
      capabilities
      price
      currency
      licenseType
      averageRating
      ratingCount
    }
  }
""")

variables = {'capability': 'credentialing'}
result = client.execute(query, variable_values=variables)`,
      curl: `curl -X POST https://api.example.com/graphql \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query ListModules($capability: String) { modules(capability: $capability) { id name description vendorName price } }",
    "variables": {"capability": "credentialing"}
  }'`,
    },
  },
  {
    id: 'get-contract-template',
    title: 'Get Contract Template',
    description: 'Retrieve a contract template by ID',
    category: 'Contracts',
    tags: ['contracts', 'templates'],
    languages: {
      typescript: `const query = \`query GetContractTemplate($id: ID!) {
  contractTemplate(id: $id) {
    id
    name
    description
    language
    version
    isPublic
  }
}\`;

const variables = {
  id: 'template_123',
};

const data = await client.request(query, variables);`,
      python: `query = gql("""
  query GetContractTemplate($id: ID!) {
    contractTemplate(id: $id) {
      id
      name
      description
      language
      version
      isPublic
    }
  }
""")

variables = {'id': 'template_123'}
result = client.execute(query, variable_values=variables)`,
      curl: `curl -X POST https://api.example.com/graphql \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query GetContractTemplate($id: ID!) { contractTemplate(id: $id) { id name description language version } }",
    "variables": {"id": "template_123"}
  }'`,
    },
  },
  {
    id: 'community-posts',
    title: 'List Community Posts',
    description: 'Fetch community posts with filtering',
    category: 'Community',
    tags: ['community', 'posts', 'forum'],
    languages: {
      typescript: `const query = \`query ListCommunityPosts($category: String, $tags: [String!]) {
  communityPosts(category: $category, tags: $tags) {
    items {
      id
      title
      content
      category
      tags
      commentCount
      reactionCount
      createdAt
    }
    pageInfo {
      hasNextPage
      nextCursor
    }
    totalCount
  }
}\`;

const variables = {
  category: 'API Support',
  tags: ['graphql', 'help'],
};

const data = await client.request(query, variables);`,
      python: `query = gql("""
  query ListCommunityPosts($category: String, $tags: [String!]) {
    communityPosts(category: $category, tags: $tags) {
      items {
        id
        title
        content
        category
        tags
        commentCount
        reactionCount
        createdAt
      }
      pageInfo {
        hasNextPage
        nextCursor
      }
      totalCount
    }
  }
""")

variables = {'category': 'API Support', 'tags': ['graphql', 'help']}
result = client.execute(query, variable_values=variables)`,
      curl: `curl -X POST https://api.example.com/graphql \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "query ListCommunityPosts($category: String, $tags: [String!]) { communityPosts(category: $category, tags: $tags) { items { id title category tags } totalCount } }",
    "variables": {"category": "API Support", "tags": ["graphql", "help"]}
  }'`,
    },
  },
];

export default function CodeSnippetLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['all', ...Array.from(new Set(SNIPPETS.map(s => s.category)))];

  const filteredSnippets = SNIPPETS.filter(snippet => {
    const matchesSearch =
      snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || snippet.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Code Snippet Library</CardTitle>
              <CardDescription>
                Reusable code examples in multiple languages
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search snippets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <TabsList>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              {filteredSnippets.map(snippet => {
                const code = snippet.languages[selectedLanguage] || snippet.languages.typescript;
                return (
                  <Card key={snippet.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{snippet.title}</CardTitle>
                          <CardDescription>{snippet.description}</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(code, snippet.id)}
                        >
                          {copiedId === snippet.id ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {snippet.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted rounded-md p-4 text-sm overflow-auto">
                        <code>{code}</code>
                      </pre>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Tabs>

          {filteredSnippets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No snippets found matching your search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

