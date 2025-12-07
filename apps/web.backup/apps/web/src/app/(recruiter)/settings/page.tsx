'use client';

/**
 * Recruiter Settings View
 * Phase 6: Settings, Security & Handoff
 */

import { useRecruiter } from '@/contexts/RecruiterContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LogOut, Trash2, Shield } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RecruiterSettingsPage() {
  const { recruiterState } = useRecruiter();
  const { logout } = useSession();
  const router = useRouter();
  const [trustSensitivity, setTrustSensitivity] = useState(75);

  const handleLogout = () => {
    // Wipe candidate cache
    try {
      localStorage.removeItem('recruiter-candidate-cache');
      sessionStorage.clear();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
    logout();
    router.push('/login');
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your recruiter preferences and security settings.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your recruiter portal experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="trust-sensitivity">Trust Sensitivity</Label>
                <p className="text-sm text-muted-foreground">
                  Adjust how strictly trust scores are evaluated (0-100)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  id="trust-sensitivity"
                  min="0"
                  max="100"
                  value={trustSensitivity}
                  onChange={(e) => setTrustSensitivity(Number(e.target.value))}
                  className="w-32"
                />
                <span className="w-12 text-sm font-medium">{trustSensitivity}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recruiter Identity Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Optional: Verify your recruiter identity for enhanced access
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Shield className="mr-2 h-4 w-4" />
                Verify Identity
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Clear cached data and manage storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Candidate Cache</Label>
                <p className="text-sm text-muted-foreground">
                  Clear locally cached candidate data
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    localStorage.removeItem('recruiter-candidate-cache');
                    alert('Candidate cache cleared');
                  } catch (err) {
                    console.error('Failed to clear cache:', err);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        <Alert variant="destructive">
          <LogOut className="h-4 w-4" />
          <AlertTitle>Sign Out</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Sign out and clear all session data</span>
            <Button variant="destructive" size="sm" onClick={handleLogout} className="mt-2">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}




