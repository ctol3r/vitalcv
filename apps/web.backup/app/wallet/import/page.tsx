"use client";

import { useEffect, useState } from 'react';
import { saveCred } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';

export default function Import() {
  const [obj, setObj] = useState<any>();
  const [error, setError] = useState<string>();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    try {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h) {
        const parsed = JSON.parse(h);
        setObj(parsed);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const handleImport = () => {
    if (!obj) return;

    const id = obj.id || obj.credential_id || 'imported-' + Date.now();
    saveCred(id, obj);

    toast({
      title: 'Credential imported',
      description: 'The credential has been saved to your wallet',
    });

    router.push('/wallet');
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Credential
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <p className="font-semibold">Error parsing credential</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : obj ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold">✅ Credential ready to import</p>
                {obj.type && <p className="text-sm text-green-600 mt-1">Type: {obj.type}</p>}
                {obj.issuer?.name && (
                  <p className="text-sm text-green-600">Issuer: {obj.issuer.name}</p>
                )}
              </div>

              <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-96">
                {JSON.stringify(obj, null, 2)}
              </pre>

              <div className="flex gap-2">
                <Button onClick={handleImport}>Import to Wallet</Button>
                <Button variant="outline" onClick={() => router.push('/wallet')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No credential data found in URL.</p>
              <p className="text-sm mt-2">
                Use a share link to import a credential.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

