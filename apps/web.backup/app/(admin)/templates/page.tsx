'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, FileJson, CheckCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  schema: any;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/templates'); // Adjust port if needed, assuming backend is on 3000
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTemplate = async () => {
    setGenerating(true);
    try {
      // Mock generation request
      const res = await fetch('http://localhost:3000/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'demo-org',
          credentialType: 'Specialist'
        })
      });

      if (res.ok) {
        const result = await res.json();
        // Ideally we would save this result to DB via another API call or the generate endpoint saves it.
        // For MVP, the generate endpoint returns the result.
        // We will mock adding it to the list for UI feedback.
        const newTemplate: Template = {
          id: `temp-${Date.now()}`,
          name: 'Generated Specialist Template',
          schema: result.schema,
          createdAt: new Date().toISOString()
        };
        setTemplates([newTemplate, ...templates]);
      }
    } catch (error) {
      console.error('Failed to generate template', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage and generate Verifiable Credential templates for your organization.
          </p>
        </div>
        <Button onClick={generateTemplate} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Generate Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Templates (Mock) */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle>Standard Employee ID</CardTitle>
              <Badge variant="secondary">System</Badge>
            </div>
            <CardDescription>Default schema for employee identification.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              Use Template
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate pr-2" title={template.name}>{template.name}</CardTitle>
                  <Badge>Generated</Badge>
                </div>
                <CardDescription>
                  Created {new Date(template.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md font-mono h-24 overflow-hidden text-xs">
                  {JSON.stringify(template.schema, null, 2)}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1">
                    Use Template
                  </Button>
                  <Button variant="ghost" size="icon">
                    <FileJson className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

