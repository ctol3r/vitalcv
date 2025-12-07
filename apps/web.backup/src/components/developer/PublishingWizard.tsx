/**
 * Publishing Wizard
 *
 * Guides developers through the final steps to publish approved modules
 * to the Marketplace: pricing, description, categories, licensing options.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Module {
  id: string;
  name: string;
  version: string;
  description?: string;
}

interface PublishingWizardProps {
  module: Module;
  onComplete: () => void;
  onCancel: () => void;
}

type PricingModel = 'free' | 'one-time' | 'subscription';
type LicenseType = 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'Proprietary' | 'Custom';

interface PublishingData {
  description: string;
  longDescription: string;
  categories: string[];
  pricingModel: PricingModel;
  fiatPrice?: number; // in cents
  vitaPrice?: number; // in VITA tokens
  subscriptionPrice?: number; // in cents per month
  license: LicenseType;
  customLicenseUrl?: string;
  tags: string[];
  documentationUrl?: string;
  repositoryUrl?: string;
  supportUrl?: string;
}

export default function PublishingWizard({
  module,
  onComplete,
  onCancel,
}: PublishingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<PublishingData>({
    description: module.description || '',
    longDescription: '',
    categories: [],
    pricingModel: 'free',
    license: 'MIT',
    tags: [],
  });
  const [loading, setLoading] = useState(false);

  const steps = [
    { number: 1, title: 'Description', description: 'Add details about your module' },
    { number: 2, title: 'Categories & Tags', description: 'Help users find your module' },
    { number: 3, title: 'Pricing', description: 'Set pricing and licensing' },
    { number: 4, title: 'Review', description: 'Review and publish' },
  ];

  function updateData(updates: Partial<PublishingData>) {
    setData({ ...data, ...updates });
  }

  async function handlePublish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/demo/developer/modules/${module.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to publish module');
      onComplete();
    } catch (err) {
      alert(`Failed to publish: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return data.description.length > 0 && data.longDescription.length > 0;
      case 2:
        return data.categories.length > 0 && data.tags.length > 0;
      case 3:
        if (data.pricingModel === 'free') return true;
        if (data.pricingModel === 'one-time') {
          return (data.fiatPrice !== undefined && data.fiatPrice > 0) ||
                 (data.vitaPrice !== undefined && data.vitaPrice > 0);
        }
        if (data.pricingModel === 'subscription') {
          return data.subscriptionPrice !== undefined && data.subscriptionPrice > 0;
        }
        return false;
      case 4:
        return true;
      default:
        return false;
    }
  }

  function nextStep() {
    if (canProceed() && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to Marketplace</DialogTitle>
          <DialogDescription>
            Complete the steps below to publish {module.name} v{module.version}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    currentStep >= step.number
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.number ? '✓' : step.number}
                </div>
                <div className="text-xs mt-1 text-center max-w-[80px]">
                  {step.title}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.number ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {currentStep === 1 && <DescriptionStep data={data} updateData={updateData} />}
          {currentStep === 2 && <CategoriesStep data={data} updateData={updateData} />}
          {currentStep === 3 && <PricingStep data={data} updateData={updateData} />}
          {currentStep === 4 && <ReviewStep module={module} data={data} />}
        </div>

        {/* Navigation */}
        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
              Previous
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {currentStep < steps.length ? (
                <Button onClick={nextStep} disabled={!canProceed()}>
                  Next
                </Button>
              ) : (
                <Button onClick={handlePublish} disabled={loading || !canProceed()}>
                  {loading ? 'Publishing...' : 'Publish to Marketplace'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Step 1: Description
function DescriptionStep({
  data,
  updateData,
}: {
  data: PublishingData;
  updateData: (updates: Partial<PublishingData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="description">Short Description *</Label>
        <Input
          id="description"
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="A brief description of your module"
          maxLength={200}
        />
        <div className="text-xs text-muted-foreground mt-1">
          {data.description.length}/200 characters
        </div>
      </div>

      <div>
        <Label htmlFor="longDescription">Long Description *</Label>
        <textarea
          id="longDescription"
          className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={data.longDescription}
          onChange={(e) => updateData({ longDescription: e.target.value })}
          placeholder="Provide detailed information about your module, features, use cases, etc."
        />
      </div>

      <div>
        <Label htmlFor="documentationUrl">Documentation URL (optional)</Label>
        <Input
          id="documentationUrl"
          type="url"
          value={data.documentationUrl || ''}
          onChange={(e) => updateData({ documentationUrl: e.target.value })}
          placeholder="https://docs.example.com/module"
        />
      </div>

      <div>
        <Label htmlFor="repositoryUrl">Repository URL (optional)</Label>
        <Input
          id="repositoryUrl"
          type="url"
          value={data.repositoryUrl || ''}
          onChange={(e) => updateData({ repositoryUrl: e.target.value })}
          placeholder="https://github.com/user/repo"
        />
      </div>

      <div>
        <Label htmlFor="supportUrl">Support URL (optional)</Label>
        <Input
          id="supportUrl"
          type="url"
          value={data.supportUrl || ''}
          onChange={(e) => updateData({ supportUrl: e.target.value })}
          placeholder="https://support.example.com"
        />
      </div>
    </div>
  );
}

// Step 2: Categories & Tags
function CategoriesStep({
  data,
  updateData,
}: {
  data: PublishingData;
  updateData: (updates: Partial<PublishingData>) => void;
}) {
  const availableCategories = [
    'Analytics',
    'Authentication',
    'Data Processing',
    'Integration',
    'Monitoring',
    'Security',
    'Storage',
    'Utilities',
    'Workflow',
  ];

  const [tagInput, setTagInput] = useState('');

  function toggleCategory(category: string) {
    const categories = data.categories.includes(category)
      ? data.categories.filter(c => c !== category)
      : [...data.categories, category];
    updateData({ categories });
  }

  function addTag() {
    if (tagInput.trim() && !data.tags.includes(tagInput.trim())) {
      updateData({ tags: [...data.tags, tagInput.trim()] });
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    updateData({ tags: data.tags.filter(t => t !== tag) });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Categories *</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {availableCategories.map((category) => (
            <Badge
              key={category}
              variant={data.categories.includes(category) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Select at least one category
        </div>
      </div>

      <div>
        <Label htmlFor="tags">Tags *</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
          />
          <Button type="button" onClick={addTag}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Add at least one tag to help users discover your module
        </div>
      </div>
    </div>
  );
}

// Step 3: Pricing
function PricingStep({
  data,
  updateData,
}: {
  data: PublishingData;
  updateData: (updates: Partial<PublishingData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="pricingModel">Pricing Model *</Label>
        <Select
          value={data.pricingModel}
          onValueChange={(value) => updateData({ pricingModel: value as PricingModel })}
        >
          <SelectTrigger id="pricingModel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="one-time">One-time Purchase</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.pricingModel === 'one-time' && (
        <div className="space-y-4 pl-4 border-l-2">
          <div>
            <Label htmlFor="fiatPrice">Price (USD, in cents)</Label>
            <Input
              id="fiatPrice"
              type="number"
              min="0"
              value={data.fiatPrice || ''}
              onChange={(e) => updateData({ fiatPrice: parseInt(e.target.value) || undefined })}
              placeholder="9999"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {data.fiatPrice ? `$${(data.fiatPrice / 100).toFixed(2)}` : 'Enter price in cents'}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">OR</div>

          <div>
            <Label htmlFor="vitaPrice">Price (VITA tokens)</Label>
            <Input
              id="vitaPrice"
              type="number"
              min="0"
              value={data.vitaPrice || ''}
              onChange={(e) => updateData({ vitaPrice: parseInt(e.target.value) || undefined })}
              placeholder="100"
            />
          </div>
        </div>
      )}

      {data.pricingModel === 'subscription' && (
        <div className="pl-4 border-l-2">
          <Label htmlFor="subscriptionPrice">Monthly Price (USD, in cents) *</Label>
          <Input
            id="subscriptionPrice"
            type="number"
            min="0"
            value={data.subscriptionPrice || ''}
            onChange={(e) => updateData({ subscriptionPrice: parseInt(e.target.value) || undefined })}
            placeholder="999"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {data.subscriptionPrice ? `$${(data.subscriptionPrice / 100).toFixed(2)}/month` : 'Enter monthly price in cents'}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="license">License *</Label>
        <Select
          value={data.license}
          onValueChange={(value) => updateData({ license: value as LicenseType })}
        >
          <SelectTrigger id="license">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MIT">MIT</SelectItem>
            <SelectItem value="Apache-2.0">Apache 2.0</SelectItem>
            <SelectItem value="GPL-3.0">GPL 3.0</SelectItem>
            <SelectItem value="Proprietary">Proprietary</SelectItem>
            <SelectItem value="Custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.license === 'Custom' && (
        <div className="pl-4 border-l-2">
          <Label htmlFor="customLicenseUrl">Custom License URL</Label>
          <Input
            id="customLicenseUrl"
            type="url"
            value={data.customLicenseUrl || ''}
            onChange={(e) => updateData({ customLicenseUrl: e.target.value })}
            placeholder="https://example.com/license"
          />
        </div>
      )}
    </div>
  );
}

// Step 4: Review
function ReviewStep({
  module,
  data,
}: {
  module: Module;
  data: PublishingData;
}) {
  function formatPrice(): string {
    if (data.pricingModel === 'free') return 'Free';
    if (data.pricingModel === 'one-time') {
      if (data.fiatPrice) return `$${(data.fiatPrice / 100).toFixed(2)}`;
      if (data.vitaPrice) return `${data.vitaPrice} VITA`;
      return 'Not set';
    }
    if (data.pricingModel === 'subscription') {
      return data.subscriptionPrice
        ? `$${(data.subscriptionPrice / 100).toFixed(2)}/month`
        : 'Not set';
    }
    return 'Not set';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{module.name}</CardTitle>
          <CardDescription>v{module.version}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Description</div>
            <div className="text-sm text-muted-foreground">{data.description}</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Long Description</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {data.longDescription}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Categories</div>
            <div className="flex flex-wrap gap-2">
              {data.categories.map((cat) => (
                <Badge key={cat} variant="outline">{cat}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Tags</div>
            <div className="flex flex-wrap gap-2">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Pricing</div>
            <div className="text-sm text-muted-foreground">{formatPrice()}</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">License</div>
            <div className="text-sm text-muted-foreground">{data.license}</div>
          </div>

          {data.documentationUrl && (
            <div>
              <div className="text-sm font-medium mb-1">Documentation</div>
              <a href={data.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                {data.documentationUrl}
              </a>
            </div>
          )}

          {data.repositoryUrl && (
            <div>
              <div className="text-sm font-medium mb-1">Repository</div>
              <a href={data.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                {data.repositoryUrl}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

