'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

const DELEGATION_TYPES = [
  'Procedure Approval',
  'Credential Verification',
  'Skill Attestation',
  'Shift Readiness',
  'Training Sign-Off',
] as const;

const EXPIRATION_OPTIONS = [
  { label: '24 hours', value: 24 },
  { label: '1 week', value: 168 },
  { label: '1 month', value: 720 },
] as const;

export default function DelegationAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    delegatorClinicianId: '',
    delegateeClinicianId: '',
    delegationType: '' as string,
    grantsAuthority: false,
    supervises: false,
    signsOff: false,
    approvesTraining: false,
    validatesProcedure: false,
    expirationHours: null as number | null,
    expiresAt: null as Date | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const expiresAt = formData.expirationHours
        ? new Date(Date.now() + formData.expirationHours * 60 * 60 * 1000)
        : formData.expiresAt || undefined;

      const response = await fetch(`${API_BASE}/api/delegation/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegatorClinicianId: formData.delegatorClinicianId,
          delegateeClinicianId: formData.delegateeClinicianId,
          delegationType: formData.delegationType || undefined,
          grantsAuthority: formData.grantsAuthority,
          supervises: formData.supervises,
          signsOff: formData.signsOff,
          approvesTraining: formData.approvesTraining,
          validatesProcedure: formData.validatesProcedure,
          expiresAt: expiresAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create delegation');
      }

      const result = await response.json();
      setSuccess(true);

      setTimeout(() => {
        router.push(`/delegation/graph?clinicianId=${formData.delegatorClinicianId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Assign Delegation</h1>
        <p className="text-muted-foreground mt-2">
          Grant authority to another clinician for specific actions
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-900">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              <span>Delegation created successfully! Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delegation Details</CardTitle>
          <CardDescription>
            Configure the authority being delegated and its scope
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delegator">Delegator (Granting Authority)</Label>
                <Input
                  id="delegator"
                  placeholder="clinician_id"
                  value={formData.delegatorClinicianId}
                  onChange={(e) =>
                    setFormData({ ...formData, delegatorClinicianId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delegatee">Delegatee (Receiving Authority)</Label>
                <Input
                  id="delegatee"
                  placeholder="clinician_id"
                  value={formData.delegateeClinicianId}
                  onChange={(e) =>
                    setFormData({ ...formData, delegateeClinicianId: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delegationType">Delegation Type</Label>
              <Select
                value={formData.delegationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, delegationType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delegation type" />
                </SelectTrigger>
                <SelectContent>
                  {DELEGATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Delegation Capabilities</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="grantsAuthority"
                    checked={formData.grantsAuthority}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, grantsAuthority: checked === true })
                    }
                  />
                  <Label htmlFor="grantsAuthority" className="font-normal cursor-pointer">
                    Grants Authority (can delegate to others)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supervises"
                    checked={formData.supervises}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, supervises: checked === true })
                    }
                  />
                  <Label htmlFor="supervises" className="font-normal cursor-pointer">
                    Supervises (supervisory relationship)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="signsOff"
                    checked={formData.signsOff}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, signsOff: checked === true })
                    }
                  />
                  <Label htmlFor="signsOff" className="font-normal cursor-pointer">
                    Signs Off (can sign off on work)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="approvesTraining"
                    checked={formData.approvesTraining}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, approvesTraining: checked === true })
                    }
                  />
                  <Label htmlFor="approvesTraining" className="font-normal cursor-pointer">
                    Approves Training (can approve training milestones)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="validatesProcedure"
                    checked={formData.validatesProcedure}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, validatesProcedure: checked === true })
                    }
                  />
                  <Label htmlFor="validatesProcedure" className="font-normal cursor-pointer">
                    Validates Procedure (can validate procedures)
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Expiration (Optional)</Label>
              <div className="flex gap-4">
                <Select
                  value={formData.expirationHours?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      expirationHours: value ? parseInt(value) : null,
                      expiresAt: null,
                    })
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Quick select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No expiration</SelectItem>
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[240px] justify-start text-left font-normal',
                        !formData.expiresAt && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expiresAt ? (
                        format(formData.expiresAt, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.expiresAt || undefined}
                      onSelect={(date) =>
                        setFormData({
                          ...formData,
                          expiresAt: date || null,
                          expirationHours: null,
                        })
                      }
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Delegation'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

