/**
 * OfferComposerView Component
 * Phase 1: Recruiter offer creation UI with form fields + trust indicators
 */

'use client';

import { useState } from 'react';
import { useOfferComposer } from '@/lib/offers/useOfferComposer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import type { CredentialRequirement } from '@/lib/offers/types';

interface OfferComposerViewProps {
  recruiterDid: string;
  recruiterId: string;
  recruiterName?: string;
  recruiterOrgName?: string;
  onOfferCreated?: (offerId: string) => void;
}

export function OfferComposerView({
  recruiterDid,
  recruiterId,
  recruiterName,
  recruiterOrgName,
  onOfferCreated,
}: OfferComposerViewProps) {
  const {
    draft,
    isDirty,
    isSubmitting,
    error,
    updateDraft,
    addCredentialRequirement,
    removeCredentialRequirement,
    createOffer,
    validateDraft,
  } = useOfferComposer(recruiterDid, recruiterId);

  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [newCredential, setNewCredential] = useState<Partial<CredentialRequirement>>({
    type: 'license',
    required: true,
  });

  const handleSubmit = async () => {
    const validation = validateDraft();
    if (!validation.valid) {
      return;
    }

    const offer = await createOffer();
    if (offer && onOfferCreated) {
      onOfferCreated(offer.id);
    }
  };

  const handleAddCredential = () => {
    if (newCredential.type && newCredential.name) {
      addCredentialRequirement({
        type: newCredential.type as CredentialRequirement['type'],
        name: newCredential.name,
        jurisdiction: newCredential.jurisdiction,
        required: newCredential.required ?? true,
        description: newCredential.description,
      });
      setNewCredential({ type: 'license', required: true });
      setShowCredentialForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Create Job Offer
              </CardTitle>
              <CardDescription>
                {recruiterOrgName && (
                  <span className="text-sm">
                    Creating offer as {recruiterName || 'Recruiter'} from {recruiterOrgName}
                  </span>
                )}
              </CardDescription>
            </div>
            {recruiterDid && (
              <Badge variant="outline" className="font-mono text-xs">
                DID: {recruiterDid.slice(0, 16)}...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trust Indicators */}
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            <span>Recruiter identity verified • Organization verified</span>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Role Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roleId">Role ID *</Label>
              <Input
                id="roleId"
                value={draft?.roleId || ''}
                onChange={(e) => updateDraft({ roleId: e.target.value })}
                placeholder="e.g., RN-ICU-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleTitle">Role Title *</Label>
              <Input
                id="roleTitle"
                value={draft?.roleTitle || ''}
                onChange={(e) => updateDraft({ roleTitle: e.target.value })}
                placeholder="e.g., Registered Nurse - ICU"
              />
            </div>
          </div>

          {/* Facility Information */}
          <div className="space-y-2">
            <Label htmlFor="facilityName">Facility Name *</Label>
            <Input
              id="facilityName"
              value={draft?.facilityName || ''}
              onChange={(e) => updateDraft({ facilityName: e.target.value })}
              placeholder="e.g., General Hospital"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={draft?.startDate || ''}
              onChange={(e) => updateDraft({ startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Salary Range */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="salaryMin">Min Salary *</Label>
              <Input
                id="salaryMin"
                type="number"
                value={draft?.salary?.min || ''}
                onChange={(e) =>
                  updateDraft({
                    salary: {
                      ...(draft?.salary || { min: 0, max: 0, currency: 'USD', period: 'hourly' }),
                      min: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryMax">Max Salary *</Label>
              <Input
                id="salaryMax"
                type="number"
                value={draft?.salary?.max || ''}
                onChange={(e) =>
                  updateDraft({
                    salary: {
                      ...(draft?.salary || { min: 0, max: 0, currency: 'USD', period: 'hourly' }),
                      max: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryPeriod">Period *</Label>
              <select
                id="salaryPeriod"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft?.salary?.period || 'hourly'}
                onChange={(e) =>
                  updateDraft({
                    salary: {
                      ...(draft?.salary || { min: 0, max: 0, currency: 'USD', period: 'hourly' }),
                      period: e.target.value as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly',
                    },
                  })
                }
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={draft?.notes || ''}
              onChange={(e) => updateDraft({ notes: e.target.value })}
              placeholder="Optional notes about the position..."
              rows={4}
            />
          </div>

          {/* Credential Requirements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Credential Requirements</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCredentialForm(!showCredentialForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>

            {showCredentialForm && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newCredential.type || 'license'}
                        onChange={(e) =>
                          setNewCredential({ ...newCredential, type: e.target.value as CredentialRequirement['type'] })
                        }
                      >
                        <option value="license">License</option>
                        <option value="certification">Certification</option>
                        <option value="dea">DEA</option>
                        <option value="board">Board Certification</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={newCredential.name || ''}
                        onChange={(e) => setNewCredential({ ...newCredential, name: e.target.value })}
                        placeholder="e.g., RN License"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Jurisdiction</Label>
                    <Input
                      value={newCredential.jurisdiction || ''}
                      onChange={(e) => setNewCredential({ ...newCredential, jurisdiction: e.target.value })}
                      placeholder="e.g., CA, NY"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={newCredential.required ?? true}
                      onChange={(e) => setNewCredential({ ...newCredential, required: e.target.checked })}
                    />
                    <Label htmlFor="required">Required</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleAddCredential} size="sm">
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCredentialForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {draft?.credentialRequirements && draft.credentialRequirements.length > 0 && (
              <div className="space-y-2">
                {draft.credentialRequirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <Badge variant="secondary" className="mr-2">
                        {req.type}
                      </Badge>
                      <span className="font-medium">{req.name}</span>
                      {req.jurisdiction && (
                        <span className="text-muted-foreground ml-2">({req.jurisdiction})</span>
                      )}
                      {req.required && (
                        <Badge variant="destructive" className="ml-2">
                          Required
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCredentialRequirement(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expirationHours">Offer Expiration (hours)</Label>
            <Input
              id="expirationHours"
              type="number"
              value={draft?.expirationHours || 48}
              onChange={(e) => updateDraft({ expirationHours: Number(e.target.value) })}
              min={1}
              max={168}
            />
            <p className="text-xs text-muted-foreground">
              Default: 48 hours. Offer will expire after this time if not accepted.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isDirty}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Offer'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

