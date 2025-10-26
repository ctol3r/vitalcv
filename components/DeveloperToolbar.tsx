'use client';

/**
 * Developer Toolbar
 *
 * Show developer tools and debug info (staging only)
 * Accessible via feature flag
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isDevelopment } from '@/config/features';
import { getSession } from '@/lib/session';
import { Activity, Bug, Code2, EyeOff, Gauge, RefreshCw, Settings, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export function DeveloperToolbar() {
  const [isVisible, setIsVisible] = useState(false);
  const [env, setEnv] = useState<string>('');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [session, setSession] = useState<any>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    // Only show in development or with dev role
    if (!isDevelopment()) {
      const currentSession = getSession();
      if (!currentSession.roles.includes('developer')) {
        return;
      }
    }

    setEnv(process.env.NODE_ENV || 'development');
    setSession(getSession());

    // Monitor network status
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for keyboard shortcut (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const measureApiLatency = async () => {
    try {
      const start = performance.now();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      await fetch(`${backendUrl}/healthz`);
      const end = performance.now();
      setApiLatency(Math.round(end - start));
    } catch (err) {
      setApiLatency(null);
    }
  };

  const clearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const toggleDebugMode = () => {
    const currentDebug = localStorage.getItem('debug') === 'true';
    localStorage.setItem('debug', (!currentDebug).toString());
    window.location.reload();
  };

  if (!isVisible) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
              onClick={() => setIsVisible(true)}
            >
              <Code2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Developer Toolbar (Ctrl+Shift+D)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-lg border-2">
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Dev Tools</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {env}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsVisible(false)}
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Environment Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Environment:</span>
            <Badge variant="outline">{env}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Backend:</span>
            <span className="font-mono text-xs">
              {(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').slice(0, 24)}...
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Network:</span>
            <Badge variant={networkStatus === 'online' ? 'default' : 'destructive'}>
              {networkStatus}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Session Info */}
        <div className="space-y-2">
          <div className="text-xs font-semibold">Session</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Claim Level:</span>
            <Badge variant="secondary">L{session?.claimLevel || 0}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Roles:</span>
            <div className="flex gap-1">
              {session?.roles?.slice(0, 2).map((role: string) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* API Latency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold">API Latency</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={measureApiLatency}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          {apiLatency !== null ? (
            <div className="text-2xl font-mono font-bold text-center">{apiLatency}ms</div>
          ) : (
            <Button variant="outline" size="sm" onClick={measureApiLatency} className="w-full">
              Measure
            </Button>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={toggleDebugMode}
          >
            <Activity className="h-4 w-4 mr-2" />
            Toggle Debug Mode
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={clearCache}>
            <Zap className="h-4 w-4 mr-2" />
            Clear Cache & Reload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              console.log('Session:', session);
              console.log('Environment:', process.env);
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Log State to Console
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Press Ctrl+Shift+D to toggle
        </div>
      </div>
    </Card>
  );
}
