'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function OntologyPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/ontology/latest`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load ontology', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Clinician Ontology</CardTitle>
          <CardDescription>Unified ontology for credentials, specialties, and training paths</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Version {data.version}</h3>
                <div className="text-sm text-muted-foreground">
                  Last updated: {new Date(data.updatedAt).toLocaleString()}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Credentials</h3>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(data.ontology?.credentials || {}).length} credential types mapped
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Specialties</h3>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(data.ontology?.specialties || {}).length} specialty categories
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Training Paths</h3>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(data.ontology?.trainingPaths || {}).length} training paths defined
                </div>
              </div>
            </div>
          ) : (
            <div>No ontology data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








