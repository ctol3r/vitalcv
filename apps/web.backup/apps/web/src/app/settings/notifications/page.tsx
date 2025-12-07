'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DemoHeader } from '@/apps/web/src/components/layout/DemoHeader';

type NotificationCategory = 'privilege' | 'job' | 'payer' | 'psv';

interface NotificationPreferences {
  email: {
    [key in NotificationCategory]: boolean;
  };
  inApp: {
    [key in NotificationCategory]: boolean;
  };
}

const defaultPreferences: NotificationPreferences = {
  email: {
    privilege: true,
    job: true,
    payer: true,
    psv: true,
  },
  inApp: {
    privilege: true,
    job: true,
    payer: true,
    psv: true,
  },
};

const categoryLabels: Record<NotificationCategory, string> = {
  privilege: 'Privilege Updates',
  job: 'Job Applications',
  payer: 'Payer Enrollment',
  psv: 'PSV Status',
};

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  const handleEmailToggle = (category: NotificationCategory, enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      email: {
        ...prev.email,
        [category]: enabled,
      },
    }));
  };

  const handleInAppToggle = (category: NotificationCategory, enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      inApp: {
        ...prev.inApp,
        [category]: enabled,
      },
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <DemoHeader
        title="Notification Preferences"
        description="Control email and in-app alerts for each org workflow. Changes apply to the active organization shown above."
      />

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Choose which notifications you want to receive via email and in-app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(categoryLabels) as NotificationCategory[]).map((category, index) => (
            <div key={category}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-4">{categoryLabels[category]}</h3>
                  <div className="space-y-4 pl-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={`email-${category}`} className="text-sm">
                          Email notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive email alerts for {categoryLabels[category].toLowerCase()}
                        </p>
                      </div>
                      <Switch
                        id={`email-${category}`}
                        checked={preferences.email[category]}
                        onCheckedChange={(checked) => handleEmailToggle(category, checked)}
                        aria-label={`Toggle email notifications for ${categoryLabels[category]}`}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={`inapp-${category}`} className="text-sm">
                          In-app notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show notifications in the app for {categoryLabels[category].toLowerCase()}
                        </p>
                      </div>
                      <Switch
                        id={`inapp-${category}`}
                        checked={preferences.inApp[category]}
                        onCheckedChange={(checked) => handleInAppToggle(category, checked)}
                        aria-label={`Toggle in-app notifications for ${categoryLabels[category]}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {index < Object.keys(categoryLabels).length - 1 && (
                <Separator className="mt-6" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground">
        <p>
          Note: These preferences are stored locally. In a production environment, they would be
          saved to your account settings.
        </p>
      </div>
    </div>
  );
}

