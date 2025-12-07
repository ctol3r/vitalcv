/**
 * Task 203.50 — Add admin UI view: active issuance sessions
 * Frontend admin page for viewing OIDC sessions
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Session {
  code: string;
  credentialType: string;
  credentialConfigurationId: string;
  userId?: string;
  subjectDid?: string;
  npi?: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  attemptCount: number;
  scope?: string;
}

interface SessionStats {
  total: number;
  active: number;
  used: number;
  expired: number;
  byCredentialType: Record<string, number>;
}

export default function OIDCSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, []);

  const fetchSessions = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/oidc/admin/sessions');
      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/oidc/admin/sessions/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCleanup = async () => {
    try {
      const response = await fetch('/api/oidc/admin/sessions/cleanup', {
        method: 'POST',
      });
      const data = await response.json();
      alert(`Cleaned up ${data.cleaned} expired sessions`);
      fetchSessions();
      fetchStats();
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      await fetch(`/api/oidc/admin/sessions/${code}`, {
        method: 'DELETE',
      });
      fetchSessions();
      fetchStats();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const getSessionStatus = (session: Session) => {
    if (session.isUsed) {
      return <Badge variant="default">Used</Badge>;
    }
    if (new Date(session.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge variant="secondary">Active</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OIDC Issuance Sessions</h1>
          <p className="text-gray-600">Manage active credential issuance sessions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCleanup}>
            <Trash2 className="mr-2 h-4 w-4" />
            Cleanup Expired
          </Button>
          <Button onClick={fetchSessions} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.used}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Pre-authorized codes and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Credential Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500">
                    No active sessions
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.code}>
                    <TableCell className="font-mono text-xs">
                      {session.code}
                    </TableCell>
                    <TableCell>{session.credentialType}</TableCell>
                    <TableCell>
                      {session.userId || session.subjectDid || 'Anonymous'}
                    </TableCell>
                    <TableCell>{getSessionStatus(session)}</TableCell>
                    <TableCell>
                      {new Date(session.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {new Date(session.expiresAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{session.attemptCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(session.code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credential Type Distribution */}
      {stats && Object.keys(stats.byCredentialType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribution by Credential Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byCredentialType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="font-medium">{type}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

