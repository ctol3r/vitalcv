/**
 * B235C-API-021: API Playground UI
 *
 * Interactive GraphQL playground with schema exploration, query/mutation execution,
 * header injection for API keys; supports saving queries and sharing links.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy, Play, Save, Share2, Download, Trash2, History } from 'lucide-react';

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  variables?: string;
  headers?: Record<string, string>;
  createdAt: string;
}

interface ExecutionHistory {
  id: string;
  query: string;
  variables?: string;
  response?: any;
  timestamp: string;
}

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || '/api/graphql';

export default function APIPlaygroundPage() {
  const [query, setQuery] = useState(`query {
  credentials(pagination: { limit: 10 }) {
    items {
      id
      name
      issuer
      status
    }
    pageInfo {
      hasNextPage
    }
    totalCount
  }
}`);
  const [variables, setVariables] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
  });
  const [apiKey, setApiKey] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('query');

  // Load saved queries from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('api-playground-queries');
    if (saved) {
      try {
        setSavedQueries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved queries:', e);
      }
    }

    const hist = localStorage.getItem('api-playground-history');
    if (hist) {
      try {
        setHistory(JSON.parse(hist).slice(0, 20)); // Keep last 20
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Load GraphQL schema
  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    setSchemaLoading(true);
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query IntrospectionQuery {
              __schema {
                queryType { name }
                mutationType { name }
                types {
                  ...FullType
                }
              }
            }
            fragment FullType on __Type {
              kind
              name
              description
              fields(includeDeprecated: true) {
                name
                description
                args {
                  ...InputValue
                }
                type {
                  ...TypeRef
                }
                isDeprecated
                deprecationReason
              }
              inputFields {
                ...InputValue
              }
              interfaces {
                ...TypeRef
              }
              enumValues(includeDeprecated: true) {
                name
                description
                isDeprecated
                deprecationReason
              }
              possibleTypes {
                ...TypeRef
              }
            }
            fragment InputValue on __InputValue {
              name
              description
              type { ...TypeRef }
              defaultValue
            }
            fragment TypeRef on __Type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                          ofType {
                            kind
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
        }),
      });

      const data = await response.json();
      if (data.data) {
        setSchema(data.data.__schema);
      }
    } catch (err) {
      console.error('Failed to load schema:', err);
    } finally {
      setSchemaLoading(false);
    }
  };

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const requestHeaders: Record<string, string> = {
        ...headers,
        'Content-Type': 'application/json',
      };

      // Add API key if provided
      if (apiKey) {
        requestHeaders['Authorization'] = `Bearer ${apiKey}`;
        requestHeaders['X-API-Key'] = apiKey;
      }

      let parsedVariables;
      try {
        parsedVariables = variables ? JSON.parse(variables) : undefined;
      } catch (e) {
        throw new Error('Invalid JSON in variables');
      }

      const startTime = Date.now();
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          query,
          variables: parsedVariables,
        }),
      });

      const endTime = Date.now();
      const data = await response.json();

      // Add to history
      const historyItem: ExecutionHistory = {
        id: Date.now().toString(),
        query,
        variables,
        response: data,
        timestamp: new Date().toISOString(),
      };

      const newHistory = [historyItem, ...history].slice(0, 20);
      setHistory(newHistory);
      localStorage.setItem('api-playground-history', JSON.stringify(newHistory));

      if (data.errors) {
        setError(JSON.stringify(data.errors, null, 2));
        setResponse({ ...data, executionTime: endTime - startTime });
      } else {
        setResponse({ ...data, executionTime: endTime - startTime });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [query, variables, headers, apiKey]);

  const saveQuery = () => {
    const name = prompt('Enter a name for this query:');
    if (!name) return;

    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      name,
      query,
      variables: variables || undefined,
      headers: Object.keys(headers).length > 1 ? headers : undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [newQuery, ...savedQueries];
    setSavedQueries(updated);
    localStorage.setItem('api-playground-queries', JSON.stringify(updated));
  };

  const loadQuery = (savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
    setVariables(savedQuery.variables || '');
    if (savedQuery.headers) {
      setHeaders(savedQuery.headers);
    }
  };

  const deleteQuery = (id: string) => {
    if (!confirm('Delete this saved query?')) return;
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('api-playground-queries', JSON.stringify(updated));
  };

  const shareQuery = () => {
    const shareData = {
      query,
      variables: variables || undefined,
      headers: Object.keys(headers).length > 1 ? headers : undefined,
    };

    const encoded = btoa(JSON.stringify(shareData));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      alert('Share link copied to clipboard!');
    });
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
  };

  // Load shared query from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (shareParam) {
      try {
        const data = JSON.parse(atob(shareParam));
        setQuery(data.query || '');
        setVariables(data.variables || '');
        if (data.headers) {
          setHeaders(data.headers);
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error('Failed to load shared query:', e);
      }
    }
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Playground</h1>
          <p className="text-muted-foreground mt-1">
            Interactive GraphQL playground with schema exploration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSchema} disabled={schemaLoading}>
            {schemaLoading ? 'Loading...' : 'Refresh Schema'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Playground */}
        <div className="lg:col-span-2 space-y-4">
          {/* Query Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Query Editor</CardTitle>
                  <CardDescription>Write and execute GraphQL queries</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={saveQuery}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={shareQuery}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button onClick={executeQuery} disabled={loading}>
                    <Play className="h-4 w-4 mr-2" />
                    {loading ? 'Executing...' : 'Execute'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">GraphQL Query</label>
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="font-mono text-sm min-h-[300px]"
                  placeholder="Enter your GraphQL query..."
                />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="query">Query</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                </TabsList>
                <TabsContent value="variables">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Variables (JSON)</label>
                    <Textarea
                      value={variables}
                      onChange={(e) => setVariables(e.target.value)}
                      className="font-mono text-sm min-h-[150px]"
                      placeholder='{"key": "value"}'
                    />
                  </div>
                </TabsContent>
                <TabsContent value="headers">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Header name"
                        value="Authorization"
                        disabled
                        className="flex-1"
                      />
                      <Input
                        placeholder="Bearer token or API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="flex-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your API key above. It will be added to the Authorization header.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Response */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>
                    {response && `Execution time: ${response.executionTime}ms`}
                  </CardDescription>
                </div>
                {response && (
                  <Button variant="outline" size="sm" onClick={copyResponse}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="text-center py-8 text-muted-foreground">Executing query...</div>
              )}
              {error && (
                <div className="bg-destructive/10 border border-destructive rounded-md p-4">
                  <pre className="text-sm text-destructive overflow-auto">
                    {error}
                  </pre>
                </div>
              )}
              {response && !error && (
                <pre className="bg-muted rounded-md p-4 text-sm overflow-auto max-h-[500px]">
                  {JSON.stringify(response, null, 2)}
                </pre>
              )}
              {!loading && !response && !error && (
                <div className="text-center py-8 text-muted-foreground">
                  Execute a query to see results
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Schema Explorer */}
          <Card>
            <CardHeader>
              <CardTitle>Schema Explorer</CardTitle>
              <CardDescription>Browse available types and queries</CardDescription>
            </CardHeader>
            <CardContent>
              {schemaLoading ? (
                <div className="text-sm text-muted-foreground">Loading schema...</div>
              ) : schema ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {schema.types
                    ?.filter((type: any) =>
                      type.name &&
                      !type.name.startsWith('__') &&
                      (type.kind === 'OBJECT' || type.kind === 'INPUT_OBJECT' || type.kind === 'ENUM')
                    )
                    .slice(0, 20)
                    .map((type: any) => (
                      <div key={type.name} className="p-2 border rounded text-sm">
                        <div className="font-semibold">{type.name}</div>
                        {type.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </div>
                        )}
                        {type.kind === 'ENUM' && type.enumValues && (
                          <div className="mt-2 space-y-1">
                            {type.enumValues.map((val: any) => (
                              <Badge key={val.name} variant="outline" className="text-xs">
                                {val.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No schema loaded</div>
              )}
            </CardContent>
          </Card>

          {/* Saved Queries */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Queries</CardTitle>
              <CardDescription>Quick access to your saved queries</CardDescription>
            </CardHeader>
            <CardContent>
              {savedQueries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No saved queries</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {savedQueries.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-muted cursor-pointer"
                      onClick={() => loadQuery(saved)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{saved.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {saved.query.substring(0, 50)}...
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuery(saved.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Recent query executions</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-sm text-muted-foreground">No history</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 border rounded hover:bg-muted cursor-pointer text-sm"
                      onClick={() => {
                        setQuery(item.query);
                        setVariables(item.variables || '');
                      }}
                    >
                      <div className="font-mono text-xs truncate">
                        {item.query.substring(0, 60)}...
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

