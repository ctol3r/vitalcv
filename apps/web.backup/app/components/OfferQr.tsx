"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, AlertCircle } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000/api';

interface OfferQrProps {
  offerId: string;
  title?: string;
  description?: string;
  showCard?: boolean;
  size?: number;
}

export default function OfferQr({
  offerId,
  title = 'Credential Offer QR Code',
  description = 'Scan with mobile wallet',
  showCard = true,
  size = 192
}: OfferQrProps) {
  const [svg, setSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) {
      setError('No offer ID provided');
      setLoading(false);
      return;
    }

    const fetchQr = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${BASE}/qr/offer/${offerId}`);

        if (!r.ok) {
          throw new Error('Failed to fetch QR code');
        }

        const svgText = await r.text();
        setSvg(svgText);
      } catch (err) {
        console.error('QR fetch error:', err);
        setError('Failed to load QR code');
      } finally {
        setLoading(false);
      }
    };

    fetchQr();
  }, [offerId]);

  const content = (
    <>
      {loading && (
        <div className="flex justify-center items-center" style={{ width: size, height: size }}>
          <Skeleton className="w-full h-full" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && svg && (
        <div className="bg-white p-4 rounded-lg flex justify-center items-center">
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ width: size, height: size }}
            className="[&>svg]:w-full [&>svg]:h-full"
          />
        </div>
      )}
    </>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

