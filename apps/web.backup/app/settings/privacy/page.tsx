/**
 * Privacy Controls & Disclosure Presets
 * Configure default sharing preferences per verifier
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Info, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PresetConfig {
  name: string;
  description: string;
  fields: string[];
  icon?: string;
}

interface VerifierPreference {
  verifierDid: string;
  verifierName: string;
  preset: string;
  customFields?: string[];
  lastUsed?: string;
}

const DISCLOSURE_PRESETS: Record<string, PresetConfig> = {
  minimum: {
    name: 'Minimum',
    description: 'Share only essential information required for basic verification',
    fields: ['id', 'type', 'issuer'],
    icon: '🔒',
  },
  jobApplication: {
    name: 'Job Application',
    description: 'Professional credentials suitable for employment verification',
    fields: ['id', 'type', 'issuer', 'licenseNumber', 'specialty', 'npi', 'certificationDate'],
    icon: '💼',
  },
  full: {
    name: 'Full Disclosure',
    description: 'Share all credential data with the verifier',
    fields: ['*'],
    icon: '📋',
  },
};

export default function PrivacySettingsPage() {
  const { toast } = useToast();
  const [defaultPreset, setDefaultPreset] = useState<string>('minimum');
  const [verifierPreferences, setVerifierPreferences] = useState<VerifierPreference[]>([]);
  const [rememberChoices, setRememberChoices] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const savedPreset = localStorage.getItem('vitalcv_default_preset');
      if (savedPreset) setDefaultPreset(savedPreset);

      const savedPreferences = localStorage.getItem('vitalcv_verifier_preferences');
      if (savedPreferences) {
        setVerifierPreferences(JSON.parse(savedPreferences));
      }

      const savedRemember = localStorage.getItem('vitalcv_remember_choices');
      if (savedRemember !== null) setRememberChoices(savedRemember === 'true');

      const savedWarnings = localStorage.getItem('vitalcv_show_warnings');
      if (savedWarnings !== null) setShowWarnings(savedWarnings === 'true');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('vitalcv_default_preset', defaultPreset);
      localStorage.setItem('vitalcv_verifier_preferences', JSON.stringify(verifierPreferences));
      localStorage.setItem('vitalcv_remember_choices', String(rememberChoices));
      localStorage.setItem('vitalcv_show_warnings', String(showWarnings));

      toast({
        title: 'Settings Saved',
        description: 'Your privacy preferences have been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  const removeVerifierPreference = (verifierDid: string) => {
    setVerifierPreferences((prev) => prev.filter((p) => p.verifierDid !== verifierDid));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Privacy Controls
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage your credential sharing preferences and disclosure settings
        </p>
      </div>

      <div className="space-y-6">
        {/* Default Disclosure Preset */}
        <Card>
          <CardHeader>
            <CardTitle>Default Disclosure Preset</CardTitle>
            <CardDescription>
              Choose the default level of information to share when presenting credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(DISCLOSURE_PRESETS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setDefaultPreset(key)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border-2 transition-all',
                  defaultPreset === key
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold">{config.name}</h3>
                      {defaultPreset === key && <Badge variant="default">Default</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{config.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {config.fields.slice(0, 5).map((field) => (
                        <Badge key={field} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {config.fields.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{config.fields.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Per-Verifier Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Verifier-Specific Preferences</CardTitle>
            <CardDescription>
              Customize disclosure levels for specific verifiers you interact with frequently
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifierPreferences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No verifier-specific preferences yet. They'll appear here as you share
                  credentials.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {verifierPreferences.map((pref) => (
                  <div
                    key={pref.verifierDid}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{pref.verifierName}</div>
                      <div className="text-sm text-muted-foreground">
                        Preset: {DISCLOSURE_PRESETS[pref.preset]?.name || 'Custom'}
                      </div>
                      {pref.lastUsed && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last used: {new Date(pref.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVerifierPreference(pref.verifierDid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Privacy Options */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Privacy Options</CardTitle>
            <CardDescription>Fine-tune how your credentials are shared</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="remember-choices" className="font-medium">
                  Remember my choices per verifier
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically apply your preferred disclosure settings for each verifier
                </p>
              </div>
              <Switch
                id="remember-choices"
                checked={rememberChoices}
                onCheckedChange={setRememberChoices}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="show-warnings" className="font-medium">
                  Show privacy warnings
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Display alerts when sharing sensitive information
                </p>
              </div>
              <Switch id="show-warnings" checked={showWarnings} onCheckedChange={setShowWarnings} />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Tips */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Privacy Tip:</strong> Start with the "Minimum" preset and only share additional
            information when required. You can always customize the fields before sharing.
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadSettings} className="flex-1">
            Reset
          </Button>
          <Button onClick={saveSettings} className="flex-1">
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
