'use client';

import { useState, useRef } from 'react';
import { Scan, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InstantScanProps {
  onVerify?: (result: { verified: boolean; confidence: number }) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export function InstantScan({ onVerify }: InstantScanProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ verified: boolean; confidence: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (file: File) => {
    setScanning(true);
    setResult(null);

    try {
      // Read QR code from image
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/api/proof/scan`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to scan QR code');
      }

      const data = await response.json();
      setResult({
        verified: data.verified || false,
        confidence: data.confidence || 0,
      });

      if (onVerify) {
        onVerify(data);
      }
    } catch (err) {
      console.error('Failed to scan', err);
      setResult({
        verified: false,
        confidence: 0,
      });
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleScan(file);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full"
            variant="default"
          >
            <Scan className="h-4 w-4 mr-2" />
            {scanning ? 'Scanning...' : 'Scan QR Code'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {result && (
            <Alert variant={result.verified ? 'default' : 'destructive'}>
              <div className="flex items-center gap-2">
                {result.verified ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.verified ? 'Verified' : 'Not Verified'} ({(result.confidence * 100).toFixed(0)}% confidence)
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}








