'use client';

/**
 * Payer Selection Page
 *
 * Allows clinician to select a payer to start enrollment with
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Shield, Search, Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { getPayers } from '@/lib/payer-client';
import type { PayerInfo } from '@/lib/payer-types';

export default function SelectPayerPage() {
  const router = useRouter();
  const [payers, setPayers] = useState<PayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPayers() {
      setLoading(true);
      try {
        const data = await getPayers();
        setPayers(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load payers. Please try again.',
          variant: 'destructive'
        });
        console.error('Failed to fetch payers:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPayers();
  }, [toast]);

  const filteredPayers = payers.filter((payer) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      payer.name.toLowerCase().includes(query) ||
      payer.type.toLowerCase().includes(query)
    );
  });

  const handleSelectPayer = (payerId: string) => {
    router.push(`/dashboard/payer/start/${payerId}`);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <Link href="/dashboard/payer">
            <Button variant="ghost" className="mb-6 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Enrollments
            </Button>
          </Link>

          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Start New Enrollment
            </h1>
            <p className="text-lg text-gray-600">
              Select a payer to begin the enrollment process
            </p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search payers by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search payers"
              />
            </div>
          </div>

          {/* Payers List */}
          <Card>
            <CardHeader>
              <CardTitle>Select a Payer</CardTitle>
              <CardDescription>
                Choose the insurance payer you want to enroll with
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPayers.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchQuery ? 'No payers found matching your search' : 'No payers available'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredPayers.map((payer) => (
                    <button
                      key={payer.id}
                      onClick={() => handleSelectPayer(payer.id)}
                      className="w-full p-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-left"
                      aria-label={`Start enrollment with ${payer.name}`}
                    >
                      <div className="flex items-center gap-4">
                        {payer.logoUrl ? (
                          <img
                            src={payer.logoUrl}
                            alt={`${payer.name} logo`}
                            className="h-12 w-12 rounded-lg object-contain bg-white border border-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">
                            {payer.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">
                              {payer.type}
                            </Badge>
                            {payer.npiOrg && (
                              <span className="text-sm text-gray-500">
                                NPI: {payer.npiOrg}
                              </span>
                            )}
                          </div>
                        </div>

                        <ArrowRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}

