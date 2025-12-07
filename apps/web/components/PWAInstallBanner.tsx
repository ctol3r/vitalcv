'use client';

/**
 * PWA Install Banner
 *
 * Prompt users to install the app with iOS/Android specific instructions
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowDownToLine, Share, SmartphoneCharging, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        return; // Don't show again for 7 days
      }
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show instructions after a delay
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
      localStorage.setItem('pwa-installed', 'true');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showBanner) {
    return null;
  }

  return (
    <>
      {/* Install Banner */}
      <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 shadow-lg border-2">
        <SmartphoneCharging className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          Install VitalCV
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            Install VitalCV on your device for quick access and offline capabilities.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstall} className="flex-1">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Install App
            </Button>
            {(isIOS || !deferredPrompt) && (
              <Button size="sm" variant="outline" onClick={() => setShowInstructions(true)}>
                How to
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Installation Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install VitalCV</DialogTitle>
            <DialogDescription>
              Follow these steps to install VitalCV on your device
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isIOS && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Share className="h-4 w-4" />
                  iOS Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    Tap the Share button <Share className="inline h-3 w-3" /> in Safari
                  </li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" in the top-right corner</li>
                  <li>The VitalCV icon will appear on your home screen</li>
                </ol>
                <div className="p-3 bg-muted/50 rounded-lg text-xs">
                  <strong>Note:</strong> This feature only works in Safari browser on iOS devices.
                </div>
              </div>
            )}

            {isAndroid && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <SmartphoneCharging className="h-4 w-4" />
                  Android Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tap the menu button (⋮) in your browser</li>
                  <li>Select "Install app" or "Add to Home Screen"</li>
                  <li>Tap "Install" when prompted</li>
                  <li>The VitalCV icon will appear in your app drawer</li>
                </ol>
              </div>
            )}

            {!isIOS && !isAndroid && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4" />
                  Desktop Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Click the install icon (+) in your browser's address bar</li>
                  <li>Or, open your browser menu and select "Install VitalCV"</li>
                  <li>Click "Install" when prompted</li>
                  <li>VitalCV will open as a standalone app</li>
                </ol>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setShowInstructions(false)} className="flex-1">
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
