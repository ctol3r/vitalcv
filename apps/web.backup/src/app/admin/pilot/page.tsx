'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function PilotModePage() {
  const [pilotEnabled, setPilotEnabled] = useState(false);
  const [integrationType, setIntegrationType] = useState('ATS');
  const [apiKeys, setApiKeys] = useState<{ clientId: string; secret: string } | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const generateKeys = () => {
    setApiKeys({
      clientId: 'pilot_' + Math.random().toString(36).substring(7),
      secret: 'sec_' + Math.random().toString(36).substring(7)
    });
  };

  const testConnection = async () => {
    setTestStatus('loading');
    // Simulate API call
    setTimeout(() => {
      setTestStatus('success');
    }, 1500);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pilot Mode Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Manage integration settings for pilot programs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Pilot Status</CardTitle>
              <CardDescription>Enable or disable pilot mode for this organization.</CardDescription>
            </div>
            <Switch
              checked={pilotEnabled}
              onCheckedChange={setPilotEnabled}
            />
          </div>
        </CardHeader>
        {pilotEnabled && (
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Integration Type</Label>
              <Select value={integrationType} onValueChange={setIntegrationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select integration type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATS">ATS (Applicant Tracking System)</SelectItem>
                  <SelectItem value="EHR">EHR (Electronic Health Records)</SelectItem>
                  <SelectItem value="HRIS">HRIS (Human Resources)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Integration Keys</h3>
                {!apiKeys && (
                  <Button variant="outline" size="sm" onClick={generateKeys}>
                    Auto-generate Keys
                  </Button>
                )}
              </div>

              {apiKeys ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Client ID</Label>
                    <Input readOnly value={apiKeys.clientId} className="font-mono bg-muted" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Client Secret</Label>
                    <Input readOnly value={apiKeys.secret} type="password" className="font-mono bg-muted" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate keys to enable connection.
                </p>
              )}
            </div>
          </CardContent>
        )}
        {pilotEnabled && (
          <CardFooter>
            <Button
              onClick={testConnection}
              disabled={!apiKeys || testStatus === 'loading'}
            >
              {testStatus === 'loading' ? 'Testing...' : 'Test Connection'}
            </Button>
            {testStatus === 'success' && (
              <span className="ml-4 text-green-600 text-sm font-medium">Connection Successful</span>
            )}
            {testStatus === 'error' && (
              <span className="ml-4 text-red-600 text-sm font-medium">Connection Failed</span>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}


