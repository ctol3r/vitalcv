
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PilotConfigPage() {
  const [mode, setMode] = useState('standalone');
  const [branding, setBranding] = useState(true);
  const [sandbox, setSandbox] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const generateKey = () => {
    setApiKey('pk_live_' + Math.random().toString(36).substring(2, 15));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Pilot Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Integration Mode</CardTitle>
          <CardDescription>Select how you want to integrate VitalCV.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={setMode} className="grid grid-cols-2 gap-4">
            <div>
              <RadioGroupItem value="standalone" id="standalone" className="peer sr-only" />
              <Label
                htmlFor="standalone"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <span className="text-lg font-bold">Standalone</span>
                <span className="text-sm text-muted-foreground">Full platform UI</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="widget" id="widget" className="peer sr-only" />
              <Label
                htmlFor="widget"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <span className="text-lg font-bold">Widget</span>
                <span className="text-sm text-muted-foreground">Embedded onboarding</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="embedded" id="embedded" className="peer sr-only" />
              <Label
                htmlFor="embedded"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <span className="text-lg font-bold">Embedded</span>
                <span className="text-sm text-muted-foreground">iFrame-safe flows</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="api-only" id="api-only" className="peer sr-only" />
              <Label
                htmlFor="api-only"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <span className="text-lg font-bold">API Only</span>
                <span className="text-sm text-muted-foreground">Headless integration</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Widget Branding</Label>
              <p className="text-sm text-muted-foreground">
                Show VitalCV branding in widgets.
              </p>
            </div>
            <Switch checked={branding} onCheckedChange={setBranding} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Sandbox Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable test data and mock verifications.
              </p>
            </div>
            <Switch checked={sandbox} onCheckedChange={setSandbox} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input value={apiKey} readOnly placeholder="No API key generated" />
            <Button onClick={generateKey}>Generate Key</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}













