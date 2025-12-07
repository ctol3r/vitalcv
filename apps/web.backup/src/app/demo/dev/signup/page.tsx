/**
 * B235C-API-027: Developer Enrollment Flow
 *
 * Flow for developers to register for API access: collects org and contact info,
 * terms of use acceptance; generates API key; displays onboarding checklist.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface EnrollmentData {
  organizationName: string;
  organizationWebsite?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  useCase: string;
  expectedVolume?: string;
  termsAccepted: boolean;
}

interface OnboardingChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  link?: string;
}

const ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  {
    id: '1',
    title: 'Read API Documentation',
    description: 'Review the complete API documentation and understand available endpoints',
    completed: false,
    link: '/demo/api/docs',
  },
  {
    id: '2',
    title: 'Explore GraphQL Playground',
    description: 'Try out queries in the interactive playground',
    completed: false,
    link: '/demo/api/playground',
  },
  {
    id: '3',
    title: 'Review Code Examples',
    description: 'Check out code snippets in multiple languages',
    completed: false,
    link: '/demo/api/snippets',
  },
  {
    id: '4',
    title: 'Set Up Rate Limits',
    description: 'Understand rate limits and plan your integration accordingly',
    completed: false,
    link: '/demo/api/docs#rate-limits',
  },
  {
    id: '5',
    title: 'Join Developer Community',
    description: 'Connect with other developers in the community forum',
    completed: false,
    link: '/community',
  },
];

export default function DeveloperEnrollmentPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState<EnrollmentData>({
    organizationName: '',
    organizationWebsite: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    useCase: '',
    expectedVolume: '',
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [checklist, setChecklist] = useState(ONBOARDING_CHECKLIST);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email address';
    }

    if (!formData.useCase.trim()) {
      newErrors.useCase = 'Use case description is required';
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms of use';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Simulate API call to create developer account and API key
      const response = await fetch('/api/demo/developer/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to enroll');
      }

      const data = await response.json();
      setApiKey(data.apiKey);
      setStep('success');
    } catch (err) {
      alert(`Enrollment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API key copied to clipboard!');
    }
  };

  const markChecklistItemComplete = (id: string) => {
    setChecklist(checklist.map(item =>
      item.id === id ? { ...item, completed: true } : item
    ));
  };

  if (step === 'success') {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle className="text-2xl">Enrollment Successful!</CardTitle>
            </div>
            <CardDescription>
              Your developer account has been created. Here's your API key:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Your API Key</label>
              <div className="flex gap-2">
                <Input
                  value={apiKey || ''}
                  readOnly
                  className="font-mono"
                />
                <Button onClick={copyApiKey}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Save this key securely. You won't be able to see it again!
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Onboarding Checklist</h3>
              <div className="space-y-3">
                {checklist.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 border rounded-md ${
                      item.completed ? 'bg-muted' : ''
                    }`}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(checked) => {
                        if (checked) markChecklistItemComplete(item.id);
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                      {item.link && (
                        <Link href={item.link} className="text-sm text-primary mt-1 inline-block">
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button asChild>
                <Link href="/demo/api/playground">
                  Go to API Playground
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/demo/developer/portal">Developer Portal</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Developer Enrollment</h1>
        <p className="text-muted-foreground mt-1">
          Register for API access to start building with our platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>
            Tell us about your organization and how you plan to use the API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Organization Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                placeholder="Acme Healthcare Inc."
                className={errors.organizationName ? 'border-destructive' : ''}
              />
              {errors.organizationName && (
                <p className="text-xs text-destructive mt-1">{errors.organizationName}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Organization Website
              </label>
              <Input
                type="url"
                value={formData.organizationWebsite}
                onChange={(e) => setFormData({ ...formData, organizationWebsite: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Contact Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Doe"
                className={errors.contactName ? 'border-destructive' : ''}
              />
              {errors.contactName && (
                <p className="text-xs text-destructive mt-1">{errors.contactName}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Contact Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="john@example.com"
                className={errors.contactEmail ? 'border-destructive' : ''}
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive mt-1">{errors.contactEmail}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Contact Phone
              </label>
              <Input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Use Case <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={formData.useCase}
                onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                placeholder="Describe how you plan to use the API..."
                className={errors.useCase ? 'border-destructive' : ''}
                rows={4}
              />
              {errors.useCase && (
                <p className="text-xs text-destructive mt-1">{errors.useCase}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Expected API Volume
              </label>
              <select
                value={formData.expectedVolume}
                onChange={(e) => setFormData({ ...formData, expectedVolume: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Select volume...</option>
                <option value="low">Low (&lt; 1,000 requests/day)</option>
                <option value="medium">Medium (1,000 - 10,000 requests/day)</option>
                <option value="high">High (10,000 - 100,000 requests/day)</option>
                <option value="enterprise">Enterprise (&gt; 100,000 requests/day)</option>
              </select>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                checked={formData.termsAccepted}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, termsAccepted: checked === true })
                }
                className={errors.termsAccepted ? 'border-destructive' : ''}
              />
              <div className="flex-1">
                <label className="text-sm">
                  I accept the{' '}
                  <Link href="/terms" className="text-primary underline">
                    Terms of Use
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-primary underline">
                    Privacy Policy
                  </Link>
                  <span className="text-destructive">*</span>
                </label>
                {errors.termsAccepted && (
                  <p className="text-xs text-destructive mt-1">{errors.termsAccepted}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Enrolling...' : 'Submit Enrollment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

