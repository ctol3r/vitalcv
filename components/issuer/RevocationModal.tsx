'use client';

/**
 * Revocation Modal
 *
 * Modal for revoking credentials with reasons and confirmation
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface RevocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialId: string;
  credentialType: string;
  onConfirm: (reason: string) => Promise<void>;
}

const revocationReasons = [
  { value: 'expired', label: 'License Expired' },
  { value: 'suspended', label: 'License Suspended' },
  { value: 'revoked-board', label: 'Revoked by Medical Board' },
  { value: 'fraud', label: 'Credential Fraud Detected' },
  { value: 'self-request', label: 'Self-Requested Revocation' },
  { value: 'compliance', label: 'Compliance Violation' },
  { value: 'other', label: 'Other' },
];

export function RevocationModal({
  isOpen,
  onClose,
  credentialId,
  credentialType,
  onConfirm,
}: RevocationModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedReason) {
      toast.error('Please select a revocation reason');
      return;
    }

    const reason = selectedReason === 'other' ? customReason : selectedReason;
    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please provide a reason for revocation');
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(reason);
      toast.success('Credential revoked successfully');
      handleClose();
    } catch (error) {
      toast.error('Failed to revoke credential');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <DialogTitle>Revoke Credential</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. The credential will be permanently revoked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Revoking this credential will invalidate all verifications
              and prevent future use. This action is recorded on-chain.
            </AlertDescription>
          </Alert>

          {/* Credential Info */}
          <div className="space-y-2">
            <Label>Credential Information</Label>
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm">
                <strong>Type:</strong> {credentialType}
              </p>
              <p className="text-sm font-mono text-xs">
                <strong>ID:</strong> {credentialId}
              </p>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-3">
            <Label>Revocation Reason *</Label>
            <div className="grid grid-cols-2 gap-2">
              {revocationReasons.map((reason) => (
                <Button
                  key={reason.value}
                  variant={selectedReason === reason.value ? 'default' : 'outline'}
                  onClick={() => setSelectedReason(reason.value)}
                  className="justify-start"
                >
                  {reason.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Please specify the reason *</Label>
              <Textarea
                id="custom-reason"
                placeholder="Enter the revocation reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additional-notes">Additional Notes (Optional)</Label>
            <Textarea
              id="additional-notes"
              placeholder="Add any additional context or comments..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !selectedReason || (selectedReason === 'other' && !customReason)}
          >
            {isLoading ? 'Revoking...' : 'Revoke Credential'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
