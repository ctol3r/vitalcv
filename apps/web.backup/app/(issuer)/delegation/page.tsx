'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Shield } from 'lucide-react';

const AVAILABLE_SCOPES = [
  { id: 'approve_claims', label: 'Approve Claims' },
  { id: 'upload_docs', label: 'Upload Documents' },
  { id: 'verify_info', label: 'Verify Information' },
  { id: 'view_reports', label: 'View Reports' },
];

export default function DelegationPage() {
  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState<{
    asDelegator: any[];
    asDelegate: any[];
  }>({ asDelegator: [], asDelegate: [] });

  const [assignEmail, setAssignEmail] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  const fetchDelegations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.listDelegations();
      if (res.error) throw new Error(res.error);
      setDelegations(res.data || { asDelegator: [], asDelegate: [] });
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load delegations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmail || selectedScopes.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an email and select at least one scope.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAssigning(true);
      const res = await apiClient.assignDelegation({
        delegateEmail: assignEmail,
        scopes: selectedScopes,
      });

      if (res.error) throw new Error(res.error);

      toast({
        title: 'Success',
        description: 'Delegate assigned successfully',
      });

      setAssignEmail('');
      setSelectedScopes([]);
      fetchDelegations();
    } catch (error: any) {
        console.error(error);
        toast({
            title: 'Error',
            description: error.message || 'Failed to assign delegate',
            variant: 'destructive',
        });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await apiClient.removeDelegation(id);
      if (res.error) throw new Error(res.error);

      toast({
        title: 'Success',
        description: 'Delegation removed',
      });
      fetchDelegations();
    } catch (error: any) {
       toast({
            title: 'Error',
            description: error.message || 'Failed to remove delegation',
            variant: 'destructive',
        });
    }
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes(prev =>
      prev.includes(scopeId)
        ? prev.filter(id => id !== scopeId)
        : [...prev, scopeId]
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Delegation Management</h1>
            <p className="text-muted-foreground mt-2">
              Assign roles to other users to act on behalf of your organization.
            </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assign New Delegate</CardTitle>
            <CardDescription>Grant permissions to another user.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAssign} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  placeholder="colleague@example.com"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <div key={scope.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`scope-${scope.id}`}
                        checked={selectedScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                      />
                      <Label htmlFor={`scope-${scope.id}`} className="text-sm font-normal">
                        {scope.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={assigning} className="w-full">
                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Assign Delegate
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Delegations</CardTitle>
            <CardDescription>Users you have delegated authority to.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : delegations.asDelegator.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No active delegations.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delegations.asDelegator.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.delegate?.email || 'Unknown'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {d.scopes.map((s: string) => (
                            <span key={s} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {s}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {delegations.asDelegate.length > 0 && (
          <Card>
              <CardHeader>
                  <CardTitle>Your Delegated Roles</CardTitle>
                  <CardDescription>Roles assigned to you by others.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Delegator</TableHead>
                              <TableHead>Scopes</TableHead>
                              <TableHead>Assigned At</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {delegations.asDelegate.map((d: any) => (
                              <TableRow key={d.id}>
                                  <TableCell>{d.delegator?.email || 'Unknown'}</TableCell>
                                  <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                          {d.scopes.map((s: string) => (
                                              <span key={s} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                                  {s}
                                              </span>
                                          ))}
                                      </div>
                                  </TableCell>
                                  <TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      )}
    </div>
  );
}


