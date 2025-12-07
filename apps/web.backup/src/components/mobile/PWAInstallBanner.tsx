/**
 * PWAInstallBanner UI Component
 * Task: B244C-MOF-026
 *
 * Shows banner encouraging PWA installation when appropriate
 * Displays app benefits and installation button
 * Integrates with PWAInstallPromptService
 * Dismissible with cookie persistence
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { pwaInstallPromptService } from '@/lib/services/PWAInstallPromptService';
import { cn } from '@/lib/utils';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsStandalone(pwaInstallPromptService.isInstalled());

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if banner should be shown
    if (!pwaInstallPromptService.isInstalled() && pwaInstallPromptService.shouldShowBanner()) {
      setShowBanner(true);
    }

    // Listen for install prompt availability
    const unsubscribe = pwaInstallPromptService.subscribe((available) => {
      if (available && !pwaInstallPromptService.isInstalled() && !pwaInstallPromptService.isDismissed()) {
        setShowBanner(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleInstall = async () => {
    const success = await pwaInstallPromptService.promptInstall();
    if (success) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    pwaInstallPromptService.dismiss();
    setShowBanner(false);
  };

  if (isStandalone || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Alert className="shadow-lg border-2">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        <AlertTitle className="flex items-center justify-between">
          Install App
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
            aria-label="Dismiss installation banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm">
            {isIOS
              ? 'Install this app on your iPhone for quick access to your credentials.'
              : 'Add to your home screen for quick access and offline support.'}
          </p>

          {isIOS ? (
            <div className="text-xs bg-muted p-3 rounded">
              <p className="font-medium mb-2">To install on iOS:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Tap the Share button in Safari</li>
                <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>Tap &quot;Add&quot; in the top right</li>
              </ol>
            </div>
          ) : (
            <Button
              onClick={handleInstall}
              className="w-full"
              size="sm"
              aria-label="Install app"
            >
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={handleDismiss}
          >
            Maybe Later
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

