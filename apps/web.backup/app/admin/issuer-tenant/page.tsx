"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function IssuerTenant() {
  const [tenant, setTenant] = useState('default');
  const [issuer, setIssuer] = useState('');
  const [auth, setAuth] = useState('');
  const [kid, setKid] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/issuer-tenant/${tenant}`);
      const data = await res.json();
      if (data.issuer_url) {
        setIssuer(data.issuer_url);
        setAuth(data.auth_url || '');
        setKid(data.kid || '');
        toast({
          title: 'Loaded',
          description: 'Tenant configuration loaded',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    try {
      await fetch(`${BASE}/api/issuer-tenant/${tenant}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          issuer_url: issuer,
          auth_url: auth,
          kid,
        }),
      });
      toast({
        title: 'Saved',
        description: 'Tenant configuration saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Issuer Tenant Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tenant ID</label>
              <div className="flex gap-2">
                <Input
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  placeholder="tenant id (e.g., default)"
                />
                <Button onClick={load} variant="outline" disabled={loading}>
                  Load
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Issuer URL <span className="text-red-500">*</span>
              </label>
              <Input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="https://issuer.example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Auth URL <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                value={auth}
                onChange={(e) => setAuth(e.target.value)}
                placeholder="https://auth.example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Key ID (kid) <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                value={kid}
                onChange={(e) => setKid(e.target.value)}
                placeholder="key-id-123"
              />
            </div>

            <Button onClick={save} disabled={loading || !issuer} className="w-full">
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

