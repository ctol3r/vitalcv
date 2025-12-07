# B134B Privileging System - Quick Reference Guide

## 🚀 Quick Start

### Accessing the Pages

```bash
# Privilege Sets Management
/org/privilegeSets              # List all privilege sets
/org/privilegeSets/new          # Create new privilege set

# Privilege Request Review
/org/privileges                 # View request queue
/org/privileges/[id]            # Review specific request

# FPPE/OPPE Evaluations
/org/oppe                       # Dashboard
/org/oppe/fppe/[id]            # FPPE evaluation form
/org/oppe/oppe/[id]            # OPPE evaluation form
```

---

## 📦 Component Usage

### PrivilegeCard Component

```tsx
import PrivilegeCard from "@/components/privileges/PrivilegeCard";

const privilege = {
  id: "priv-001",
  specialty: "Cardiology",
  privilegeSetName: "Cardiology - Interventional",
  procedures: ["Angiography", "PCI", "Catheterization"],
  lastReviewDate: "2024-01-15",
  nextReviewDate: "2024-07-15",
  status: "active",
  grantedDate: "2023-01-15",
  reviewer: "Dr. Smith"
};

<PrivilegeCard
  privilege={privilege}
  onClick={() => console.log("Clicked!")}
/>
```

### PrivilegeCardList Component

```tsx
import { PrivilegeCardList } from "@/components/privileges/PrivilegeCard";

<PrivilegeCardList
  privileges={privilegeArray}
  onCardClick={(id) => router.push(`/privileges/${id}`)}
/>
```

---

## 🔌 API Integration Points

### Replace Mock Data

Search for `// TODO: Replace with actual API call` in these files:

1. **PrivilegeSet List** (`app/org/privilegeSets/page.tsx`)
```typescript
const response = await fetch("/api/org/privilege-sets");
const data = await response.json();
```

2. **PrivilegeSet Create** (`app/org/privilegeSets/new/page.tsx`)
```typescript
const response = await fetch("/api/org/privilege-sets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...formData, procedures }),
});
```

3. **Privilege Request Queue** (`app/org/privileges/page.tsx`)
```typescript
const response = await fetch("/api/org/privilege-requests");
const data = await response.json();
```

4. **Privilege Review** (`app/org/privileges/[id]/page.tsx`)
```typescript
// Load request
const response = await fetch(`/api/org/privilege-requests/${requestId}`);

// Approve
await fetch(`/api/org/privilege-requests/${requestId}/approve`, {
  method: "POST",
  body: JSON.stringify({ notes: reviewNotes }),
});

// Deny
await fetch(`/api/org/privilege-requests/${requestId}/deny`, {
  method: "POST",
  body: JSON.stringify({ notes: reviewNotes }),
});
```

5. **OPPE Dashboard** (`app/org/oppe/page.tsx`)
```typescript
const response = await fetch("/api/org/oppe-records");
const data = await response.json();
```

6. **FPPE Evaluation** (`app/org/oppe/fppe/[id]/page.tsx`)
```typescript
// Load
const response = await fetch(`/api/org/fppe-evaluations/${evaluationId}`);

// Submit
await fetch(`/api/org/fppe-evaluations/${evaluationId}`, {
  method: "PUT",
  body: JSON.stringify({ checklist, overallRecommendation, summaryComments }),
});
```

7. **OPPE Evaluation** (`app/org/oppe/oppe/[id]/page.tsx`)
```typescript
// Load
const response = await fetch(`/api/org/oppe-evaluations/${evaluationId}`);

// Submit/Save
await fetch(`/api/org/oppe-evaluations/${evaluationId}`, {
  method: "PUT",
  body: JSON.stringify({
    metrics,
    overallAssessment,
    summaryComments,
    status: isDraft ? "in_progress" : "completed",
  }),
});
```

---

## 📋 Data Structures

### PrivilegeSet
```typescript
interface PrivilegeSet {
  id: string;
  name: string;
  department: string;
  specialty?: string;
  procedureCount: number;
  status: "active" | "draft" | "archived";
  createdAt: string;
}
```

### PrivilegeRequest
```typescript
interface PrivilegeRequest {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  status: "pending" | "under_review" | "approved" | "denied";
  requestDate: string;
  reviewerName?: string;
  verifiableCredential: any;
  passReasons: string[];
  failReasons: string[];
}
```

### OppeRecord
```typescript
interface OppeRecord {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  evaluationType: "FPPE" | "OPPE";
  privilegeSetName: string;
  dueDate: string;
  lastEvaluationDate?: string;
  status: "upcoming" | "due_soon" | "overdue" | "completed";
  assignedReviewer?: string;
}
```

### Privilege (for PrivilegeCard)
```typescript
interface Privilege {
  id: string;
  specialty: string;
  privilegeSetName: string;
  procedures: string[];
  lastReviewDate?: string;
  nextReviewDate?: string;
  status: "active" | "pending" | "expired" | "suspended";
  grantedDate: string;
  reviewer?: string;
}
```

---

## 🎨 Styling Customization

### Status Colors

Edit these in the components to match your brand:

```typescript
// Privilege Status
const STATUS_CONFIG = {
  active: { variant: "default", bgColor: "bg-green-50" },
  pending: { variant: "secondary", bgColor: "bg-yellow-50" },
  expired: { variant: "destructive", bgColor: "bg-red-50" },
  suspended: { variant: "destructive", bgColor: "bg-orange-50" },
};

// Request Status
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "approved": return "default";
    case "pending": return "secondary";
    case "under_review": return "outline";
    case "denied": return "destructive";
  }
};
```

### Custom Themes

All components use Tailwind classes and support dark mode automatically via the theme provider.

---

## 🔒 Authentication & Authorization

### Adding Auth Guards

Wrap pages with auth guards:

```tsx
import { useAuth } from "@/hooks/useAuth";

export default function PrivilegeSetsPage() {
  const { user, hasRole } = useAuth();

  if (!hasRole("org_reviewer")) {
    return <Unauthorized />;
  }

  // ... rest of component
}
```

### Role Requirements

- **Privilege Sets Management:** `org_admin`
- **Review Queue:** `org_reviewer`, `org_admin`
- **FPPE/OPPE Dashboard:** `org_reviewer`, `org_admin`
- **Evaluations:** `org_reviewer`, `org_admin`

---

## 🧪 Testing

### Unit Test Example

```typescript
import { render, screen } from "@testing-library/react";
import PrivilegeCard from "@/components/privileges/PrivilegeCard";

describe("PrivilegeCard", () => {
  it("displays privilege information", () => {
    const privilege = {
      id: "test-1",
      specialty: "Cardiology",
      privilegeSetName: "Test Set",
      procedures: ["Test Procedure"],
      status: "active",
      grantedDate: "2024-01-01",
    };

    render(<PrivilegeCard privilege={privilege} />);

    expect(screen.getByText("Test Set")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
// Playwright or Cypress
test("create new privilege set", async ({ page }) => {
  await page.goto("/org/privilegeSets");
  await page.click("text=Create Privilege Set");

  await page.fill("#name", "Test Privilege Set");
  await page.selectOption("#department", "Cardiology");
  await page.click("text=Coronary Angiography");

  await page.click("text=Create Privilege Set");

  await expect(page).toHaveURL("/org/privilegeSets");
});
```

---

## 🐛 Common Issues & Solutions

### Issue: Form validation not working
**Solution:** Ensure all required fields have the `required` attribute and check the `validateForm()` function.

### Issue: Navigation not working
**Solution:** Verify Next.js App Router setup and check `useRouter()` usage.

### Issue: Status colors not displaying
**Solution:** Check Tailwind config includes all color variants used.

### Issue: Mock data not showing
**Solution:** Check browser console for errors and verify data structures match interfaces.

---

## 📊 Performance Tips

### Optimize Lists
```typescript
// Use React.memo for list items
const PrivilegeRow = React.memo(({ privilege }) => {
  // ... row component
});
```

### Lazy Load Components
```typescript
import dynamic from "next/dynamic";

const PrivilegeCard = dynamic(() => import("@/components/privileges/PrivilegeCard"));
```

### Debounce Search
```typescript
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const debouncedSearch = useDebouncedValue(searchQuery, 300);
```

---

## 🔄 Extending Features

### Add New Evaluation Criterion

1. Edit the checklist array in `app/org/oppe/fppe/[id]/page.tsx`:
```typescript
const INITIAL_CHECKLIST: ChecklistItem[] = [
  // ... existing items
  {
    id: "new-1",
    category: "New Category",
    criterion: "New criterion description",
  },
];
```

### Add New Status Type

1. Update the interface:
```typescript
status: "active" | "pending" | "expired" | "suspended" | "new_status";
```

2. Update the STATUS_CONFIG:
```typescript
const STATUS_CONFIG = {
  // ... existing statuses
  new_status: {
    icon: NewIcon,
    label: "New Status",
    variant: "secondary" as const,
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};
```

### Add Custom Filter

```typescript
const [customFilter, setCustomFilter] = useState("");

useEffect(() => {
  let filtered = records;

  if (customFilter) {
    filtered = filtered.filter((record) =>
      // your custom filter logic
    );
  }

  setFilteredRecords(filtered);
}, [records, customFilter]);
```

---

## 📞 Support

For questions or issues:
1. Check the implementation summary document
2. Review component source code
3. Check console for errors
4. Verify API endpoints are correctly configured

---

## 🎯 Best Practices

1. **Always validate user input** - Both client and server side
2. **Use TypeScript interfaces** - Ensure type safety
3. **Handle loading states** - Show spinners or skeletons
4. **Handle empty states** - Provide helpful messages
5. **Make it accessible** - Add ARIA labels, keyboard navigation
6. **Test on mobile** - Ensure responsive design works
7. **Log errors properly** - Use structured logging
8. **Comment TODOs clearly** - Mark API integration points

---

Last Updated: November 13, 2025

