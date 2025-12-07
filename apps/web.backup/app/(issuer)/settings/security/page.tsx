'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Image from 'next/image';

export default function SecurityPage() {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleEnableMFA = async () => {
    try {
      // Assuming authentication token is handled by session/cookies or interceptor
      const res = await fetch('http://localhost:4000/api/auth/mfa/enroll', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`, // Example token retrieval
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to start enrollment');

      const data = await res.json();
      setQrCode(data.qrCode);
      setIsEnrolling(true);
    } catch (error) {
      toast.error('Failed to enable MFA. Please try again.');
      console.error(error);
    }
  };

  const handleVerify = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: verificationCode })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification failed');
      }

      setIsVerified(true);
      setIsEnrolling(false);
      setQrCode(null);
      toast.success('MFA successfully enabled!');
    } catch (error) {
        if (error instanceof Error) {
            toast.error(error.message);
        } else {
            toast.error('Invalid code. Please try again.');
        }
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Multi-Factor Authentication (MFA)</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerified ? (
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-4 rounded-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>MFA is currently enabled.</span>
            </div>
          ) : !isEnrolling ? (
            <Button onClick={handleEnableMFA}>Enable MFA</Button>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4 border p-4 rounded-md bg-white">
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
                </p>
                {qrCode && (
                  <div className="relative w-48 h-48">
                     <Image src={qrCode} alt="MFA QR Code" fill style={{ objectFit: 'contain' }} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <div className="px-2">-</div>
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleVerify} disabled={verificationCode.length !== 6}>
                  Verify & Enable
                </Button>
                <Button variant="outline" onClick={() => setIsEnrolling(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

