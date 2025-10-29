'use client';

/**
 * SearchableCredentialList
 *
 * Searchable and filterable credential list for the wallet
 */

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CredentialPdfExport } from './CredentialPdfExport';

interface Credential {
  id: string;
  type: string;
  issuer: string;
  subject: string;
  status: 'active' | 'revoked' | 'expired';
  issuedDate: string;
  expiresDate?: string;
  txHash?: string;
  network?: string;
}

interface SearchableCredentialListProps {
  credentials: Credential[];
  onCredentialClick?: (credential: Credential) => void;
  selectedCredentialId?: string;
}

export function SearchableCredentialList({
  credentials,
  onCredentialClick,
  selectedCredentialId,
}: SearchableCredentialListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked' | 'expired'>('all');

  // Filter credentials based on search and status
  const filteredCredentials = useMemo(() => {
    return credentials.filter((credential) => {
      // Status filter
      if (statusFilter !== 'all' && credential.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          credential.id.toLowerCase().includes(query) ||
          credential.type.toLowerCase().includes(query) ||
          credential.issuer.toLowerCase().includes(query) ||
          credential.subject.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [credentials, searchQuery, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'revoked':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'expired':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              My Credentials
            </CardTitle>
            <CardDescription>
              {credentials.length} total • {filteredCredentials.length} shown
            </CardDescription>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="search">Search Credentials</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by ID, type, issuer, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-40">
            <Label htmlFor="status-filter">Filter by Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as 'all' | 'active' | 'revoked' | 'expired')
              }
            >
              <SelectTrigger id="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Empty State */}
        {filteredCredentials.length === 0 ? (
          <EmptyState
            type={credentials.length === 0 ? 'no-credentials' : 'no-search-results'}
            title={
              credentials.length === 0 ? 'No Credentials Yet' : `No results for "${searchQuery}"`
            }
            description={
              credentials.length === 0
                ? 'Complete the claim wizard to receive your first verifiable credential.'
                : 'Try adjusting your search or filters.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredCredentials.map((credential) => (
              <button
                key={credential.id}
                onClick={() => onCredentialClick?.(credential)}
                className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                  selectedCredentialId === credential.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                aria-pressed={selectedCredentialId === credential.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{credential.type}</h3>
                      <Badge className={getStatusColor(credential.status)}>
                        {credential.status.charAt(0).toUpperCase() + credential.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <strong>ID:</strong> <code className="text-xs">{credential.id}</code>
                      </p>
                      <p>
                        <strong>Issuer:</strong> {credential.issuer}
                      </p>
                      <p>
                        <strong>Subject:</strong> {credential.subject}
                      </p>
                      <p>
                        <strong>Issued:</strong>{' '}
                        {new Date(credential.issuedDate).toLocaleDateString()}
                        {credential.expiresDate &&
                          ` • Expires: ${new Date(credential.expiresDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex flex-col gap-2">
                    <CredentialPdfExport credential={credential} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
