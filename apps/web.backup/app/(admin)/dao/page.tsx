'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Vote } from 'lucide-react';

interface DAOProposal {
  id: string;
  orgId: string;
  title: string;
  description: string;
  proposerId: string;
  status: string;
  createdAt: string;
}

export default function DAOPage() {
  const [proposals, setProposals] = useState<DAOProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dao/proposals');
      if (res.ok) {
        const data = await res.json();
        setProposals(data);
      }
    } catch (error) {
      console.error('Failed to fetch proposals', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/dao/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          orgId: 'default-org', // In real app, get from context
          proposerId: 'current-user', // In real app, get from auth context
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        setTitle('');
        setDescription('');
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to create proposal', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (proposalId: string, vote: string) => {
    try {
      const res = await fetch('/api/dao/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          voterId: 'current-user', // In real app, get from auth context
          vote,
        }),
      });

      if (res.ok) {
        // Ideally refresh votes or show success
        alert('Vote cast successfully!');
      }
    } catch (error) {
      console.error('Failed to vote', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DAO Portal</h1>
          <p className="text-muted-foreground">Manage proposals and voting for the organization.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'New Proposal'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Proposal</CardTitle>
            <CardDescription>Submit a new proposal for the DAO to vote on.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Proposal title"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your proposal..."
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Proposal
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center p-8 border rounded-lg bg-muted/10">
            <p className="text-muted-foreground">No proposals found. Create one to get started.</p>
          </div>
        ) : (
          proposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{proposal.title}</CardTitle>
                    <CardDescription>
                      Proposer: {proposal.proposerId} • Created: {new Date(proposal.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={proposal.status === 'passed' ? 'default' : proposal.status === 'failed' ? 'destructive' : 'secondary'}>
                    {proposal.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-6 text-sm leading-relaxed">{proposal.description}</p>

                <div className="flex items-center gap-4 pt-4 border-t">
                  <div className="flex-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Cast Vote</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleVote(proposal.id, 'yes')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Yes
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleVote(proposal.id, 'no')}>
                        <XCircle className="mr-2 h-4 w-4" />
                        No
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleVote(proposal.id, 'abstain')}>
                        <Vote className="mr-2 h-4 w-4" />
                        Abstain
                      </Button>
                    </div>
                  </div>

                  <div className="text-right">
                     {/* Placeholder for weight summaries */}
                    <p className="text-xs text-muted-foreground">Current Weight</p>
                    <p className="text-lg font-bold">0.0</p>
                  </div>
                </div>

                {proposal.status === 'passed' && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground font-mono flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Chain Anchor: 0x7f...3a2b
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

