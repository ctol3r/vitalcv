/**
 * B235C-API-028: Public API Changelog Viewer
 *
 * Displays a chronological changelog of API updates, deprecations, and version changes;
 * supports filtering by version and search; highlights breaking changes.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AlertTriangle, Search, Calendar, Tag } from 'lucide-react';

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  type: 'feature' | 'bugfix' | 'deprecation' | 'breaking' | 'security';
  title: string;
  description: string;
  affectedEndpoints?: string[];
  migrationGuide?: string;
}

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: '1',
    version: '2.1.0',
    date: '2025-11-15',
    type: 'feature',
    title: 'Added pagination support to all list queries',
    description: 'All list queries now support cursor-based pagination with improved performance.',
    affectedEndpoints: ['credentials', 'searchOrganizations', 'modules', 'communityPosts'],
  },
  {
    id: '2',
    version: '2.0.0',
    date: '2025-11-01',
    type: 'breaking',
    title: 'GraphQL API v2.0 - Major Update',
    description: 'Complete redesign of the GraphQL API with improved type safety and new features.',
    affectedEndpoints: ['*'],
    migrationGuide: 'https://docs.example.com/migration/v2',
  },
  {
    id: '3',
    version: '1.9.5',
    date: '2025-10-20',
    type: 'deprecation',
    title: 'Deprecated legacy credential query',
    description: 'The `getCredential` query is deprecated. Use `credential` instead.',
    affectedEndpoints: ['getCredential'],
  },
  {
    id: '4',
    version: '1.9.0',
    date: '2025-10-10',
    type: 'feature',
    title: 'Added community posts API',
    description: 'New endpoints for accessing community forum posts and discussions.',
    affectedEndpoints: ['communityPosts', 'communityPost'],
  },
  {
    id: '5',
    version: '1.8.2',
    date: '2025-09-28',
    type: 'bugfix',
    title: 'Fixed pagination cursor handling',
    description: 'Resolved issue where pagination cursors were not properly validated.',
    affectedEndpoints: ['credentials', 'searchOrganizations'],
  },
  {
    id: '6',
    version: '1.8.0',
    date: '2025-09-15',
    type: 'feature',
    title: 'Added marketplace modules API',
    description: 'New endpoints for browsing and searching marketplace modules.',
    affectedEndpoints: ['modules', 'module'],
  },
  {
    id: '7',
    version: '1.7.0',
    date: '2025-08-30',
    type: 'security',
    title: 'Enhanced API key validation',
    description: 'Improved security measures for API key authentication and rate limiting.',
    affectedEndpoints: ['*'],
  },
  {
    id: '8',
    version: '1.6.5',
    date: '2025-08-15',
    type: 'deprecation',
    title: 'Deprecated organization search without filters',
    description: 'Organization search now requires at least one filter parameter.',
    affectedEndpoints: ['searchOrganizations'],
  },
];

const VERSIONS = Array.from(new Set(CHANGELOG_ENTRIES.map(e => e.version))).sort((a, b) => {
  // Simple version comparison (for semantic versions)
  return b.localeCompare(a, undefined, { numeric: true });
});

export default function ChangelogViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filteredEntries = CHANGELOG_ENTRIES.filter(entry => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.affectedEndpoints?.some(ep => ep.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesVersion = selectedVersion === 'all' || entry.version === selectedVersion;
    const matchesType = selectedType === 'all' || entry.type === selectedType;

    return matchesSearch && matchesVersion && matchesType;
  });

  const getTypeBadgeVariant = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'breaking':
        return 'destructive';
      case 'deprecation':
        return 'outline';
      case 'security':
        return 'default';
      case 'feature':
        return 'default';
      case 'bugfix':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Changelog</CardTitle>
              <CardDescription>
                Track API updates, deprecations, and breaking changes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search changelog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Versions</option>
              {VERSIONS.map(v => (
                <option key={v} value={v}>v{v}</option>
              ))}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Types</option>
              <option value="feature">Features</option>
              <option value="bugfix">Bug Fixes</option>
              <option value="deprecation">Deprecations</option>
              <option value="breaking">Breaking Changes</option>
              <option value="security">Security</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredEntries.map(entry => (
              <Card key={entry.id} className={entry.type === 'breaking' ? 'border-destructive' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getTypeBadgeVariant(entry.type)}>
                          {entry.type}
                        </Badge>
                        {entry.type === 'breaking' && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Breaking Change
                          </Badge>
                        )}
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          v{entry.version}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(entry.date).toLocaleDateString()}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{entry.description}</p>

                  {entry.affectedEndpoints && entry.affectedEndpoints.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        Affected Endpoints:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.affectedEndpoints.map(ep => (
                          <Badge key={ep} variant="outline" className="text-xs">
                            {ep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.migrationGuide && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={entry.migrationGuide} target="_blank" rel="noopener noreferrer">
                        View Migration Guide
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEntries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No changelog entries found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

