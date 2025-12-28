'use client'

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Loader2, Send } from 'lucide-react';

export function EarlyAccessSection() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('clinician');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const resp = await fetch('/api/early-access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || 'Request failed');
      }
      setMessage("You're on the list.");
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="early-access" className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-4xl">
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Request Early Access</CardTitle>
            <CardDescription>
              Tell us how you want to engage and we&apos;ll send you an invite without extra steps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="early-email">Email</Label>
                <Input
                  id="early-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@healthsystem.org"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="early-role">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinician">Clinician</SelectItem>
                    <SelectItem value="issuer">Issuer (health system)</SelectItem>
                    <SelectItem value="verifier">Verifier (staffing partner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={loading} className="min-w-[200px]">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Request Early Access
                    </>
                  )}
                </Button>
                {message && (
                  <div className="text-sm text-emerald-700 font-medium" data-testid="early-success">
                    {message}
                  </div>
                )}
              </div>
              {error && (
                <div className="md:col-span-2">
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
