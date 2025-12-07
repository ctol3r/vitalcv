'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminUserApi } from '@/lib/admin/api';
import { UserSearchResult } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Search,
  Shield,
  Link2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Mail,
  Ban,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { UserDetailPanel } from '@/components/admin/UserDetailPanel';
import { cn } from '@/lib/utils';

export default function AdminUserDirectoryPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  const searchUsers = useCallback(async () => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await adminUserApi.searchUsers(query);
      setUsers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchUsers]);

  const handleAction = async (action: string, userId: string, ...args: any[]) => {
    try {
      switch (action) {
        case 'resendInvite':
          await adminUserApi.resendInvite(userId);
          break;
        case 'clearTasks':
          await adminUserApi.clearStuckTasks(userId);
          break;
        case 'renewAnchors':
          await adminUserApi.renewChainAnchors(userId);
          break;
        case 'refreshCredentials':
          await adminUserApi.refreshCredentials(userId);
          break;
        case 'forceVerification':
          await adminUserApi.forceVerificationRerun(userId);
          break;
        case 'block':
          await adminUserApi.blockUser(userId, args[0] || 'Admin action');
          break;
        case 'unblock':
          await adminUserApi.unblockUser(userId);
          break;
      }
      // Refresh user details if selected
      if (selectedUser?.id === userId) {
        const updated = await adminUserApi.getUserDetails(userId);
        setSelectedUser(updated);
      }
      // Refresh search results
      searchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Directory</h1>
        <p className="text-muted-foreground">
          Search and manage clinicians, recruiters, and hospitals
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
          <CardDescription>
            Search by email, name, NPI, or other identifiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {query ? 'No users found' : 'Enter a search query to find users'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <Card
                  key={user.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedUser?.id === user.id && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedUser(user)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{user.email}</span>
                          {user.name && (
                            <span className="text-sm text-muted-foreground">({user.name})</span>
                          )}
                        </div>
                        {user.npi && (
                          <p className="text-sm text-muted-foreground mb-2">NPI: {user.npi}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="outline">
                              {role}
                            </Badge>
                          ))}
                          <Badge
                            variant={
                              user.complianceStatus === 'compliant'
                                ? 'default'
                                : user.complianceStatus === 'warning'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {user.complianceStatus}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {user.trustScore !== undefined && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Trust:</span>{' '}
                            <span className="font-medium">{user.trustScore}</span>
                          </div>
                        )}
                        <Badge
                          variant={
                            user.chainStatus === 'synced'
                              ? 'default'
                              : user.chainStatus === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {user.chainStatus}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* User Detail Panel */}
        <div>
          {selectedUser ? (
            <UserDetailPanel
              user={selectedUser}
              onAction={handleAction}
              onClose={() => setSelectedUser(null)}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a user to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

