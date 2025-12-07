'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RoutingRegion {
  state: string;
  country?: string;
  eligible: boolean;
  method: 'direct' | 'compact' | 'reciprocity' | 'emergency';
  restrictions?: string[];
  expirationDate?: string;
}

interface RoutingRoute {
  from: string;
  to: string;
  method: string;
  eligible: boolean;
  requirements?: string[];
}

interface RoutingEligibility {
  regions: RoutingRegion[];
  routes: RoutingRoute[];
  conflicts: Array<{
    type: string;
    description: string;
  }>;
}

interface Suggestion {
  state: string;
  method: 'compact' | 'exam' | 'reciprocity';
  priority: 'low' | 'medium' | 'high';
  requirements: string[];
}

export default function RoutingPage() {
  const [eligibility, setEligibility] = useState<RoutingEligibility | null>(null);
  const [suggestions, setSuggestions] = useState<{ suggestions: Suggestion[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const clinicianId = 'current-user-id'; // TODO: Get from auth context

  useEffect(() => {
    loadRouting();
  }, []);

  const loadRouting = async () => {
    try {
      setLoading(true);
      const [eligibilityRes, suggestionsRes] = await Promise.all([
        fetch(`/api/routing/workforce/${clinicianId}/eligibility`),
        fetch(`/api/routing/workforce/${clinicianId}/suggestions`),
      ]);

      if (eligibilityRes.ok) {
        const data = await eligibilityRes.json();
        setEligibility(data);
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to load routing', error);
    } finally {
      setLoading(false);
    }
  };

  const methodColors = {
    direct: 'bg-blue-100 text-blue-800',
    compact: 'bg-green-100 text-green-800',
    reciprocity: 'bg-purple-100 text-purple-800',
    emergency: 'bg-red-100 text-red-800',
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workforce Routing</h1>
          <p className="text-muted-foreground">Where you can legally practice</p>
        </div>
      </div>

      {eligibility && eligibility.conflicts.length > 0 && (
        <Alert className="border-orange-500">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <div className="font-semibold mb-2">Routing Conflicts Detected:</div>
            <ul className="list-disc list-inside">
              {eligibility.conflicts.map((conflict, i) => (
                <li key={i}>{conflict.description}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Eligible Regions
            </CardTitle>
            <CardDescription>
              {eligibility?.regions.length ?? 0} region(s) where you can practice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {eligibility?.regions.map((region, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedState === region.state ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedState(selectedState === region.state ? null : region.state)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{region.state}</span>
                    <div className="flex gap-2">
                      <Badge className={methodColors[region.method]}>{region.method}</Badge>
                      {region.eligible && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                  </div>
                  {region.expirationDate && (
                    <div className="text-sm text-muted-foreground">
                      Expires: {new Date(region.expirationDate).toLocaleDateString()}
                    </div>
                  )}
                  {region.restrictions && region.restrictions.length > 0 && (
                    <div className="text-sm text-orange-600 mt-2">
                      Restrictions: {region.restrictions.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing Routes</CardTitle>
            <CardDescription>
              {eligibility?.routes.length ?? 0} route(s) available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {eligibility?.routes.slice(0, 10).map((route, i) => (
                <div key={i} className="flex items-center justify-between border rounded p-2">
                  <span className="text-sm">
                    {route.from} → {route.to}
                  </span>
                  <Badge variant="outline">{route.method}</Badge>
                </div>
              ))}
              {eligibility && eligibility.routes.length > 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{eligibility.routes.length - 10} more routes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {suggestions && suggestions.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Next States</CardTitle>
            <CardDescription>Consider activating these states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestions.suggestions.map((suggestion, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{suggestion.state}</span>
                    <div className="flex gap-2">
                      <Badge className={priorityColors[suggestion.priority]}>
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="outline">{suggestion.method}</Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Requirements:</div>
                    <ul className="list-disc list-inside ml-4">
                      {suggestion.requirements.map((req, j) => (
                        <li key={j}>{req}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

