"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface Migration {
  version: string;
  name: string;
}

interface InfraStatus {
  currentVersion: string;
  availableMigrations: Migration[];
}

export default function InfrastructurePage() {
  const [status, setStatus] = useState<InfraStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/infra/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: "Failed to fetch status" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleApply = async (version: string) => {
      setActionLoading(true);
      setMessage(null);
      try {
          const res = await fetch(`/api/infra/apply`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetVersion: version })
          });
          if (!res.ok) throw new Error(await res.text());
          setMessage({ type: 'success', text: "Migration applied successfully" });
          fetchStatus();
      } catch (e: any) {
          setMessage({ type: 'error', text: e.message });
      } finally {
          setActionLoading(false);
      }
  };

  const handleRollback = async (version: string) => {
      if (!confirm(`Are you sure you want to rollback to ${version}?`)) return;
      setActionLoading(true);
      setMessage(null);
      try {
          const res = await fetch(`/api/infra/rollback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetVersion: version })
          });
          if (!res.ok) throw new Error(await res.text());
          setMessage({ type: 'success', text: "Rollback recorded successfully" });
          fetchStatus();
      } catch (e: any) {
          setMessage({ type: 'error', text: e.message });
      } finally {
          setActionLoading(false);
      }
  }

  if (loading && !status) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const upgrades = status?.availableMigrations.filter(m => {
      // Simple string comparison might be enough if format is consistent,
      // but ideally use semver. Here we rely on array order from backend if sorted.
      // Or just filter out versions <= current.
      // Assuming backend returns sorted list, we can just check inequality.
      return m.version > (status.currentVersion || '0.0.0');
  }) || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Infrastructure Management</h1>

      {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
          </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-mono">{status?.currentVersion || 'Unknown'}</div>
          <div className="text-sm text-muted-foreground mt-1">
             System running version {status?.currentVersion}. {status?.availableMigrations.length} total versions known.
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>Available Upgrades</CardTitle>
          </CardHeader>
          <CardContent>
              {upgrades.length === 0 ? (
                  <p className="text-muted-foreground">System is up to date.</p>
              ) : (
                  <div className="space-y-4">
                      {upgrades.map(u => (
                          <div key={u.version} className="flex items-center justify-between border p-4 rounded-lg">
                              <div>
                                  <div className="font-bold">{u.version}</div>
                                  <div className="text-sm text-gray-500">{u.name}</div>
                              </div>
                              <Button
                                disabled={actionLoading}
                                onClick={() => handleApply(u.version)}
                              >
                                  {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Apply Migration
                              </Button>
                          </div>
                      ))}
                  </div>
              )}
          </CardContent>
      </Card>

       <Card>
          <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
               <div className="flex items-center justify-between border border-red-200 bg-red-50 p-4 rounded-lg">
                   <div>
                       <div className="font-bold text-red-800">Rollback</div>
                       <div className="text-sm text-red-600">Revert to base version (0.0.0)</div>
                   </div>
                    <Button
                        variant="destructive"
                        disabled={actionLoading || status?.currentVersion === '0.0.0'}
                        onClick={() => handleRollback('0.0.0')}
                      >
                          Rollback to 0.0.0
                      </Button>
               </div>
          </CardContent>
       </Card>
    </div>
  );
}

