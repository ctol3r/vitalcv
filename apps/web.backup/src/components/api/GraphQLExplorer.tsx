/**
 * B235C-API-029: GraphQL Explorer
 *
 * Visual tool to explore the GraphQL schema (types, queries, mutations);
 * supports building queries via UI; generates code snippets; integrates with Playground.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, ChevronDown, Copy, Code, Search } from 'lucide-react';

interface GraphQLType {
  kind: string;
  name: string;
  description?: string;
  fields?: GraphQLField[];
  inputFields?: GraphQLInputField[];
  enumValues?: GraphQLEnumValue[];
  possibleTypes?: GraphQLType[];
  interfaces?: GraphQLType[];
}

interface GraphQLField {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  args?: GraphQLInputValue[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLInputValue {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  defaultValue?: string;
}

interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLTypeRef {
  kind: string;
  name?: string;
  ofType?: GraphQLTypeRef;
}

interface GraphQLSchema {
  queryType?: { name: string };
  mutationType?: { name: string };
  types: GraphQLType[];
}

interface Props {
  schema?: GraphQLSchema;
  onQuerySelect?: (query: string) => void;
}

export default function GraphQLExplorer({ schema, onQuerySelect }: Props) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['Query']));
  const [selectedType, setSelectedType] = useState<GraphQLType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedQuery, setGeneratedQuery] = useState('');

  useEffect(() => {
    if (schema?.queryType) {
      setExpandedTypes(new Set([schema.queryType.name]));
    }
  }, [schema]);

  const toggleType = (typeName: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(typeName)) {
      newExpanded.delete(typeName);
    } else {
      newExpanded.add(typeName);
    }
    setExpandedTypes(newExpanded);
  };

  const getTypeName = (typeRef: GraphQLTypeRef): string => {
    if (typeRef.name) return typeRef.name;
    if (typeRef.ofType) return getTypeName(typeRef.ofType);
    return typeRef.kind;
  };

  const getTypeDisplay = (typeRef: GraphQLTypeRef): string => {
    const name = getTypeName(typeRef);
    if (typeRef.kind === 'NON_NULL') {
      return `${getTypeDisplay(typeRef.ofType!)}!`;
    }
    if (typeRef.kind === 'LIST') {
      return `[${getTypeDisplay(typeRef.ofType!)}]`;
    }
    return name;
  };

  const generateQueryFromField = (field: GraphQLField, depth: number = 0): string => {
    if (depth > 3) return ''; // Prevent deep nesting

    const typeName = getTypeName(field.type);
    const type = schema?.types.find(t => t.name === typeName);

    let query = field.name;

    // Add arguments
    if (field.args && field.args.length > 0) {
      const args = field.args.map(arg => {
        const argType = getTypeDisplay(arg.type);
        return `${arg.name}: $${arg.name}`;
      }).join(', ');
      query += `(${args})`;
    }

    // Add subfields if it's an object type
    if (type && type.fields && type.fields.length > 0 && depth < 2) {
      const subfields = type.fields
        .filter(f => !f.name.startsWith('__'))
        .slice(0, 5) // Limit to 5 fields
        .map(f => generateQueryFromField(f, depth + 1))
        .filter(Boolean)
        .join('\n    ');

      if (subfields) {
        query += ` {\n    ${subfields}\n  }`;
      }
    }

    return query;
  };

  const handleFieldClick = (field: GraphQLField) => {
    const query = generateQueryFromField(field);
    setGeneratedQuery(query);
    if (onQuerySelect) {
      onQuerySelect(query);
    }
  };

  const filteredTypes = schema?.types.filter(type => {
    if (!type.name || type.name.startsWith('__')) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        type.name.toLowerCase().includes(query) ||
        type.description?.toLowerCase().includes(query) ||
        type.fields?.some(f => f.name.toLowerCase().includes(query))
      );
    }
    return true;
  }) || [];

  const queryType = schema?.types.find(t => t.name === schema.queryType?.name);
  const mutationType = schema?.types.find(t => t.name === schema.mutationType?.name);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>GraphQL Schema Explorer</CardTitle>
              <CardDescription>Explore types, queries, and mutations</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search schema..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="queries">
            <TabsList>
              <TabsTrigger value="queries">Queries</TabsTrigger>
              <TabsTrigger value="mutations">Mutations</TabsTrigger>
              <TabsTrigger value="types">All Types</TabsTrigger>
            </TabsList>

            <TabsContent value="queries" className="mt-4">
              {queryType ? (
                <TypeTree
                  type={queryType}
                  schema={schema!}
                  expanded={expandedTypes.has(queryType.name)}
                  onToggle={() => toggleType(queryType.name)}
                  onFieldClick={handleFieldClick}
                  getTypeName={getTypeName}
                  getTypeDisplay={getTypeDisplay}
                />
              ) : (
                <div className="text-sm text-muted-foreground">No query type found</div>
              )}
            </TabsContent>

            <TabsContent value="mutations" className="mt-4">
              {mutationType ? (
                <TypeTree
                  type={mutationType}
                  schema={schema!}
                  expanded={expandedTypes.has(mutationType.name)}
                  onToggle={() => toggleType(mutationType.name)}
                  onFieldClick={handleFieldClick}
                  getTypeName={getTypeName}
                  getTypeDisplay={getTypeDisplay}
                />
              ) : (
                <div className="text-sm text-muted-foreground">No mutation type found</div>
              )}
            </TabsContent>

            <TabsContent value="types" className="mt-4">
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTypes.map((type) => (
                  <TypeTree
                    key={type.name}
                    type={type}
                    schema={schema!}
                    expanded={expandedTypes.has(type.name)}
                    onToggle={() => toggleType(type.name)}
                    onFieldClick={handleFieldClick}
                    getTypeName={getTypeName}
                    getTypeDisplay={getTypeDisplay}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {generatedQuery && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Query</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedQuery);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-md p-4 text-sm overflow-auto">
              {`query {\n  ${generatedQuery}\n}`}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TypeTree({
  type,
  schema,
  expanded,
  onToggle,
  onFieldClick,
  getTypeName,
  getTypeDisplay,
}: {
  type: GraphQLType;
  schema: GraphQLSchema;
  expanded: boolean;
  onToggle: () => void;
  onFieldClick: (field: GraphQLField) => void;
  getTypeName: (ref: GraphQLTypeRef) => string;
  getTypeDisplay: (ref: GraphQLTypeRef) => string;
}) {
  const hasFields = (type.fields && type.fields.length > 0) ||
                   (type.inputFields && type.inputFields.length > 0) ||
                   (type.enumValues && type.enumValues.length > 0);

  return (
    <div className="border rounded-md">
      <div
        className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
        onClick={hasFields ? onToggle : undefined}
      >
        {hasFields && (
          expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        )}
        <div className="flex-1">
          <div className="font-semibold">{type.name}</div>
          {type.description && (
            <div className="text-xs text-muted-foreground">{type.description}</div>
          )}
        </div>
        <Badge variant="outline">{type.kind}</Badge>
      </div>

      {expanded && hasFields && (
        <div className="border-t pl-4">
          {type.fields && type.fields.length > 0 && (
            <div className="py-2 space-y-1">
              {type.fields
                .filter(f => !f.name.startsWith('__'))
                .map((field) => (
                  <div
                    key={field.name}
                    className="p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => onFieldClick(field)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{field.name}</span>
                        {field.args && field.args.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({field.args.map(a => a.name).join(', ')})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getTypeDisplay(field.type)}
                      </Badge>
                    </div>
                    {field.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {field.description}
                      </div>
                    )}
                    {field.isDeprecated && (
                      <Badge variant="destructive" className="text-xs mt-1">
                        Deprecated: {field.deprecationReason}
                      </Badge>
                    )}
                  </div>
                ))}
            </div>
          )}

          {type.inputFields && type.inputFields.length > 0 && (
            <div className="py-2 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Input Fields:</div>
              {type.inputFields.map((field) => (
                <div key={field.name} className="p-2 text-sm">
                  <span className="font-medium">{field.name}</span>
                  <Badge variant="outline" className="text-xs ml-2">
                    {getTypeDisplay(field.type)}
                  </Badge>
                  {field.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {field.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {type.enumValues && type.enumValues.length > 0 && (
            <div className="py-2 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Enum Values:</div>
              <div className="flex flex-wrap gap-1">
                {type.enumValues.map((val) => (
                  <Badge key={val.name} variant="outline" className="text-xs">
                    {val.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

