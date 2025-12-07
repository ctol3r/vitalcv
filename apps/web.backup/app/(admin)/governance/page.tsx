"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Plus, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Policy {
  id: string;
  orgId: string;
  key: string;
  value: any;
  version: number;
  createdAt: string;
  updatedAt: string;
  txId?: string;
}

export default function GovernancePage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [open, setOpen] = useState(false);

  // Form state
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const orgId = "demo-org"; // Should come from context

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/governance?orgId=${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch policies');
      const data = await res.json();
      setPolicies(data);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: "Failed to fetch governance policies" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handlePropose = async () => {
    setActionLoading(true);
    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(newValue);
      } catch (e) {
        parsedValue = newValue; // Send as string if not JSON
      }

      const res = await fetch(`/api/governance/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, key: newKey, value: parsedValue })
      });

      if (!res.ok) throw new Error(await res.text());

      setMessage({ type: 'success', text: "Policy proposed successfully" });
      setOpen(false);
      setNewKey("");
      setNewValue("");
      fetchPolicies();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (policyId: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/governance/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policyId })
        });
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        setMessage({ type: 'success', text: `Policy anchored: ${data.txId?.slice(0, 10)}...` });
        fetchPolicies();
      } catch (e: any) {
        setMessage({ type: 'error', text: e.message });
      } finally {
        setActionLoading(false);
      }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Governance Console</h1>
          <p className="text-muted-foreground">Manage organization policies and on-chain anchors</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={fetchPolicies} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Propose Policy</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Propose New Policy</DialogTitle>
                        <DialogDescription>Create a new policy or update an existing one (increments version).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="key">Policy Key</Label>
                            <Input id="key" placeholder="e.g. auth.mfa.policy" value={newKey} onChange={e => setNewKey(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="value">Policy Value (JSON)</Label>
                            <Textarea id="value" placeholder='{"enabled": true}' value={newValue} onChange={e => setNewValue(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handlePropose} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Submit Proposal"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : policies.length === 0 ? (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No policies found. Propose one to get started.
                </CardContent>
            </Card>
        ) : (
            policies.map(policy => (
                <Card key={policy.id}>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-lg font-mono">{policy.key}</CardTitle>
                                <CardDescription>Version {policy.version} • Updated {new Date(policy.updatedAt).toLocaleDateString()}</CardDescription>
                            </div>
                            {policy.txId ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <Shield className="w-3 h-3 mr-1" /> Anchored
                                </Badge>
                            ) : (
                                <Button size="sm" variant="secondary" onClick={() => handleApprove(policy.id)} disabled={actionLoading}>
                                    Approve & Anchor
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md overflow-x-auto">
                            <pre className="text-xs">{JSON.stringify(policy.value, null, 2)}</pre>
                        </div>
                        {policy.txId && (
                            <div className="mt-2 text-xs text-muted-foreground font-mono">
                                Tx: {policy.txId}
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

