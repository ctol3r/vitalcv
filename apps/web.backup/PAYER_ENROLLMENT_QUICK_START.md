# Payer Enrollment System - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
```bash
# Ensure dependencies are installed
npm install
```

### Run the Application
```bash
cd /Users/christoler/v0-vital-cv-frontend-mvp
npm run dev
```

### Access the Features
- **Dashboard Overview**: http://localhost:3000/dashboard/payer
- **Start Enrollment**: http://localhost:3000/dashboard/payer/start
- **Org Billing**: http://localhost:3000/org/billing/payers

---

## 📚 Key Types

### Import Types
```typescript
import type {
  PayerEnrollment,
  PayerEnrollmentStatus,
  PayerInfo,
  EnrollmentEvidence,
  RevalidationReminder,
  ApplicationPayerStatus,
} from '@/lib/payer-types';
```

### Status Values
```typescript
type PayerEnrollmentStatus =
  | 'draft'           // Initial enrollment
  | 'pending'         // Submitted, awaiting review
  | 'in_review'       // Under active review
  | 'approved'        // Enrollment approved
  | 'rejected'        // Enrollment rejected
  | 'suspended'       // Temporarily suspended
  | 'terminated'      // Enrollment terminated
  | 'revalidating'    // Undergoing revalidation
```

---

## 🔌 API Client Usage

### Import Client
```typescript
import {
  getEnrollments,
  getEnrollment,
  startEnrollmentDraft,
  submitEnrollment,
  uploadEvidence,
  downloadEvidenceZip,
  getPayers,
  getRevalidationReminders,
} from '@/lib/payer-client';
```

### Fetch Enrollments
```typescript
// Get all enrollments
const { enrollments } = await getEnrollments();

// Filter by status
const { enrollments } = await getEnrollments({
  status: ['approved', 'pending']
});

// Search and filter
const { enrollments } = await getEnrollments({
  search: 'Blue Cross',
  revalidationDue: true
});
```

### Get Single Enrollment
```typescript
const enrollment = await getEnrollment('enr_001');
console.log(enrollment.status);        // 'approved'
console.log(enrollment.payer.name);    // 'Blue Cross Blue Shield'
console.log(enrollment.evidence);      // Array of documents
console.log(enrollment.events);        // Timeline of events
```

### Start New Enrollment
```typescript
// Start draft with prepopulated data
const draftData = await startEnrollmentDraft('payer_001', '1234567890');
console.log(draftData.prepopulated.fromCaqh);    // CAQH data
console.log(draftData.prepopulated.fromVitalCV); // VitalCV data
console.log(draftData.missingItems);             // What's needed

// Submit enrollment
const newEnrollment = await submitEnrollment({
  payerId: 'payer_001',
  clinicianNpi: '1234567890',
  productLines: ['medical', 'telehealth'],
  status: 'draft'
});
```

### Upload Evidence
```typescript
const file = /* File from input */;
const updated = await uploadEvidence('enr_001', file, 'license');
console.log(updated.evidence); // Updated evidence list
```

### Download Evidence
```typescript
const blob = await downloadEvidenceZip('enr_001');
// Create download link
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'evidence.zip';
a.click();
```

---

## 🎨 Component Usage

### Application Status Chips

#### Basic Usage
```tsx
import { ApplicationStatusChips } from '@/components/jobs/ApplicationStatusChips';

// Show on job detail page
<ApplicationStatusChips jobId="job_123" />
```

#### Compact Indicator
```tsx
import { CompactStatusIndicator } from '@/components/jobs/ApplicationStatusChips';

// Show in job listing
<CompactStatusIndicator jobId="job_123" />
```

#### Multiple Jobs
```tsx
import { MultipleApplicationStatusChips } from '@/components/jobs/ApplicationStatusChips';

<MultipleApplicationStatusChips jobIds={['job_123', 'job_456']} />
```

---

### Revalidation Reminder

#### Banner Mode (Default)
```tsx
import { RevalidationReminder } from '@/components/payer/RevalidationReminder';

// Show as banner on dashboard
<RevalidationReminder />
```

#### Toast Notifications Only
```tsx
// Show urgent reminders as toasts
<RevalidationReminder mode="toast" />
```

#### Both Banner + Toast
```tsx
// Show banners and trigger toasts for urgent
<RevalidationReminder mode="both" maxReminders={3} />
```

#### Compact Badge
```tsx
import { RevalidationReminderBadge } from '@/components/payer/RevalidationReminder';

// Show in navigation bar
<RevalidationReminderBadge
  onClick={() => router.push('/dashboard/payer')}
/>
```

#### Dashboard Summary
```tsx
import { RevalidationReminderSummary } from '@/components/payer/RevalidationReminder';

// Show as dashboard widget
<RevalidationReminderSummary className="w-full" />
```

---

## 🎯 Common Patterns

### Display Status Badge
```tsx
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import type { PayerEnrollmentStatus } from '@/lib/payer-types';

const statusConfig = {
  approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  rejected: { icon: XCircle, color: 'bg-red-100 text-red-800' },
};

function StatusBadge({ status }: { status: PayerEnrollmentStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={config.color}>
      <Icon className="h-3.5 w-3.5 mr-1" />
      {status}
    </Badge>
  );
}
```

### Format Date
```typescript
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
```

### Calculate Days Until Revalidation
```typescript
function getDaysUntilRevalidation(date: string | undefined): number | null {
  if (!date) return null;

  const revalidationDate = new Date(date);
  const today = new Date();
  const diffTime = revalidationDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// Usage
const days = getDaysUntilRevalidation(enrollment.nextRevalidation);
if (days !== null && days < 30) {
  // Show urgent warning
}
```

### Handle Loading & Error States
```tsx
function EnrollmentsList() {
  const [enrollments, setEnrollments] = useState<PayerEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const { enrollments } = await getEnrollments();
        setEnrollments(enrollments);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load';
        setError(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <Alert variant="destructive">{error}</Alert>;

  return (
    <div>
      {enrollments.map(enrollment => (
        <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
      ))}
    </div>
  );
}
```

---

## 🔍 Debugging

### Check API Responses
```typescript
// Enable logging in API client
const enrollment = await getEnrollment('enr_001');
console.log('Enrollment data:', enrollment);
console.log('Status:', enrollment.status);
console.log('Evidence count:', enrollment.evidence.length);
console.log('Events count:', enrollment.events.length);
```

### Verify Component Props
```tsx
// Add debug logging
function MyComponent({ jobId }: { jobId: string }) {
  console.log('JobId:', jobId);

  useEffect(() => {
    console.log('Component mounted with jobId:', jobId);
  }, [jobId]);

  return <ApplicationStatusChips jobId={jobId} />;
}
```

### Check Network Requests
Open browser DevTools → Network tab → Filter by "payer" to see API calls.

---

## 📝 Mock Data Reference

### Available Mock Enrollments
```typescript
// enr_001: Approved enrollment with Blue Cross Blue Shield
// enr_002: Pending enrollment with UnitedHealthcare
// enr_003: Revalidation reminder with Cigna (63 days)
// enr_004: Revalidation reminder with Humana (37 days)
// enr_005: Urgent revalidation with Kaiser (22 days)
```

### Available Mock Payers
```typescript
// payer_001: Blue Cross Blue Shield (commercial)
// payer_002: UnitedHealthcare (commercial)
// payer_003: Aetna (commercial)
// payer_004: Medicare (medicare)
// payer_005: Medicaid (medicaid)
```

---

## 🎨 Styling Reference

### Status Colors
```css
/* Draft */
bg-gray-100 text-gray-700

/* Pending */
bg-yellow-100 text-yellow-800

/* In Review */
bg-blue-100 text-blue-800

/* Approved */
bg-green-100 text-green-800

/* Rejected */
bg-red-100 text-red-800

/* Suspended */
bg-orange-100 text-orange-800

/* Revalidating */
bg-purple-100 text-purple-800
```

### Severity Colors (Reminders)
```css
/* Info (90+ days) */
bg-blue-100 text-blue-800

/* Warning (60-89 days) */
bg-orange-100 text-orange-800

/* Urgent (<30 days) */
bg-red-100 text-red-800
```

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] View enrollment overview with mock data
- [ ] Search and filter enrollments
- [ ] Click enrollment to view details
- [ ] Navigate between tabs (Summary, Evidence, Timeline)
- [ ] Start new enrollment flow
- [ ] Select payer and see prepopulated data
- [ ] Fill form and create draft
- [ ] View billing metrics
- [ ] Filter billing by payer
- [ ] See application status chips
- [ ] View revalidation reminders
- [ ] Dismiss a reminder
- [ ] Download evidence ZIP
- [ ] Test keyboard navigation
- [ ] Test with screen reader

### Accessibility Testing
```bash
# Install axe DevTools extension in Chrome/Firefox
# Navigate to each page
# Run axe scan
# Fix any violations
```

### Responsive Testing
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1024px)
- [ ] Large desktop (1440px)

---

## 🐛 Common Issues

### Issue: "Cannot find module '@/lib/payer-client'"
**Solution**: Ensure TypeScript path mapping is correct in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Issue: API returns 404
**Solution**: Check that API route files are in correct location:
```
app/api/payer/enrollments/route.ts
```

### Issue: Type errors with PayerEnrollment
**Solution**: Import type correctly:
```typescript
import type { PayerEnrollment } from '@/lib/payer-types';
// NOT: import { PayerEnrollment } from '@/lib/payer-types';
```

### Issue: Toast not showing
**Solution**: Ensure ToastProvider is in layout:
```tsx
// app/layout.tsx
<ToastProvider>
  {children}
</ToastProvider>
```

---

## 📞 Support

### Documentation
- Full implementation: `B137B_PAYER_ENROLLMENT_IMPLEMENTATION.md`
- Type definitions: `lib/payer-types.ts`
- API client: `lib/payer-client.ts`

### Questions?
Check the comprehensive implementation guide for detailed information on architecture, patterns, and best practices.

---

**Last Updated**: November 13, 2025
**Version**: 1.0.0

