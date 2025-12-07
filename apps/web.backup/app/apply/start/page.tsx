'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

export default function ApplyStartPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate application flow completion
    // In production, this would be a real application process
    const timer = setTimeout(() => {
      const applicationToken = `vcv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      setToken(applicationToken);
      setLoading(false);

      // Send token to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'vitalcv:applicationToken',
            token: applicationToken,
          },
          window.location.origin
        );
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (token && window.opener) {
      window.opener.postMessage(
        {
          type: 'vitalcv:applicationToken',
          token,
        },
        window.location.origin
      );
    }
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <CardTitle>Apply with VitalCV</CardTitle>
          <CardDescription>Verifying your credentials</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-sm text-gray-600">Processing your application...</p>
            </div>
          ) : token ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium mb-2">Application Complete</p>
                <p className="text-xs text-green-700">Your credentials have been verified.</p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Close Window
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

