# B135B Quick Reference Guide

## 🚀 New Routes & Navigation

### Organization Portal Routes

#### Privilege Renewals
- **Dashboard:** `/org/privileges/renewals`
  - View all pending and overdue renewals
  - Search and filter capabilities
  - Statistics overview

- **Review Screen:** `/org/privileges/renewals/[id]`
  - Compare old vs new evidence
  - Approve or deny renewals
  - Leave review notes

#### Temporary Privileges
- **Queue:** `/org/privileges/temp`
  - Review temporary privilege requests
  - Approve/deny emergency requests
  - Track expiring temporary privileges

#### OPPE Timeline
- **Clinician Timeline:** `/org/oppe/clinicians/[id]`
  - Visual timeline of evaluations
  - FPPE/OPPE history
  - Upcoming review tracking

### Clinician Portal Routes

#### My Privileges
- **Dashboard:** `/dashboard/privileges`
  - View all active privileges
  - Renewal status and alerts
  - FPPE/OPPE indicators

- **Temporary Request:** `/dashboard/privileges/temp/new`
  - Request emergency privileges
  - 120-day temporary approval

- **Print Summary:** `/dashboard/privileges/print/[id]`
  - Printable privilege verification
  - Official documentation

---

## 📊 Component Usage

### Privilege Card v2

```tsx
import PrivilegeCardV2, { PrivilegeV2 } from "@/components/privileges/PrivilegeCardV2";

const privilege: PrivilegeV2 = {
  id: "priv-001",
  privilegeSetName: "Cardiology - Interventional",
  specialty: "Interventional Cardiology",
  status: "active",
  procedures: ["PCI", "Cardiac Cath"],
  grantedDate: "2022-11-10",
  renewalDue: "2024-11-25",
  fppeStatus: "completed",
  oppeStatus: "current",
  // ... other fields
};

<PrivilegeCardV2
  privilege={privilege}
  onClick={() => handleClick(privilege.id)}
  showDetailedStatus={true}
/>
```

---

## 🎨 Badge & Status Guide

### Privilege Status
- 🟢 **Active** - Privilege is currently active
- 🟡 **Pending** - Awaiting review/approval
- 🔴 **Expired** - Past renewal date
- 🟠 **Suspended** - Temporarily suspended
- ⚪ **Hold** - On hold pending review
- 🔵 **Temporary** - Emergency temporary privilege

### FPPE Status
- 🟡 **Required** - FPPE must be completed
- 🔵 **In Progress** - Currently undergoing FPPE
- 🟢 **Completed** - FPPE successfully finished
- ⚪ **Not Required** - No FPPE needed

### OPPE Status
- 🟢 **Current** - OPPE up to date
- 🟡 **Due Soon** - OPPE due within 30 days
- 🔴 **Overdue** - OPPE past due
- ⚪ **Not Applicable** - No OPPE required

### Emergency Reasons (Temporary Privileges)
- Natural Disaster
- Public Health Emergency
- Staff Shortage - Critical
- Mass Casualty Event
- Pandemic Response
- Other Emergency

---

## 🔍 Search & Filter Tips

### Renewals Dashboard
- Search by: Clinician name, NPI, privilege set, department
- Filter by: All, Pending, Overdue
- Sort by: Renewal due date (overdue first)

### Temporary Privileges Queue
- Search by: Name, NPI, department, emergency reason
- Filter by: All, Pending, Approved, Denied
- Highlight: Requests expiring within 30 days

### My Privileges Dashboard
- Filter by: Status (active, pending, expired)
- Sort by: Renewal due date
- Alerts: Overdue shown first, then expiring soon

---

## ⌨️ Keyboard Shortcuts

### Global
- `Tab` - Navigate between interactive elements
- `Shift+Tab` - Navigate backwards
- `Enter` - Activate buttons/links
- `Space` - Activate buttons/toggle checkboxes
- `Escape` - Close dialogs/modals

### Tables
- `Tab` - Navigate to next row
- `Enter` - Open selected row
- `Arrow Keys` - (Future) Navigate cells

### Tabs
- `Arrow Left/Right` - Switch between tabs
- `Home/End` - (Future) Jump to first/last tab

---

## 📋 Common Workflows

### Workflow 1: Process a Privilege Renewal
1. Navigate to `/org/privileges/renewals`
2. Review overdue renewals (red tab)
3. Click on a renewal to review
4. Compare evidence in tabs (Evidence, Credentials, Performance)
5. Enter review notes
6. Click "Approve" or "Deny"
7. Confirmation shown, return to queue

### Workflow 2: Approve Temporary Privilege
1. Navigate to `/org/privileges/temp`
2. Review pending requests
3. Click "Approve" or "Deny" on request
4. Review emergency reason and details in dialog
5. Enter review notes (required)
6. Submit decision
7. Request updated with expiry date (if approved)

### Workflow 3: Clinician Requests Temporary Privilege
1. Navigate to `/dashboard/privileges`
2. Click "Request Temporary Privilege"
3. Select emergency reason from dropdown
4. Provide detailed explanation
5. Select required privileges (checkboxes)
6. Review 120-day warning
7. Acknowledge terms
8. Submit request
9. Wait for 24-hour review

### Workflow 4: View OPPE Timeline
1. Navigate to OPPE dashboard
2. Click on clinician name
3. View visual timeline at `/org/oppe/clinicians/[id]`
4. Review past evaluations (completed events)
5. Check upcoming reviews panel
6. Note any overdue evaluations
7. Use quick actions (Schedule, Reports, Metrics)

### Workflow 5: Print Privilege Summary
1. Navigate to `/dashboard/privileges`
2. Click "Print Summary" button
3. Opens `/dashboard/privileges/print/all`
4. Review printable document
5. Click "Print" or "Download PDF"
6. Use browser print dialog
7. Save or print physical copy

---

## 🎯 Data Models (Quick Reference)

### PrivilegeRenewal
```typescript
{
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  originalApprovalDate: string;
  renewalDue: string;
  status: "pending" | "overdue" | "under_review" | "renewed";
  hasNewEvidence: boolean;
  daysOverdue?: number;
}
```

### TempPrivilegeRequest
```typescript
{
  id: string;
  clinicianName: string;
  requestedPrivileges: string[];
  emergencyReason: string;
  detailedExplanation: string;
  requestDate: string;
  status: "pending" | "approved" | "denied";
  expiryDate?: string;
  daysUntilExpiry?: number;
}
```

### TimelineEvent
```typescript
{
  id: string;
  type: "FPPE" | "OPPE" | "PRIVILEGE_GRANT" | "RENEWAL" | "INCIDENT";
  title: string;
  date: string;
  status: "completed" | "in_progress" | "scheduled" | "overdue";
  description: string;
  outcome?: "pass" | "fail" | "conditional";
}
```

---

## 🔧 API Endpoints to Implement

### Renewals
```
GET    /api/org/privilege-renewals              List all renewals
GET    /api/org/privilege-renewals/:id          Get renewal details
POST   /api/org/privilege-renewals/:id/approve  Approve renewal
POST   /api/org/privilege-renewals/:id/deny     Deny renewal
```

### Temporary Privileges
```
GET    /api/org/privileges/temp                 List temp requests
POST   /api/org/privileges/temp/:id/approve     Approve temp request
POST   /api/org/privileges/temp/:id/deny        Deny temp request
POST   /api/privileges/temp                     Submit new temp request
```

### OPPE Timeline
```
GET    /api/org/oppe/clinicians/:id             Get clinician timeline
GET    /api/org/oppe/clinicians/:id/events      List timeline events
POST   /api/org/oppe/clinicians/:id/schedule    Schedule new evaluation
```

### Clinician Dashboard
```
GET    /api/dashboard/privileges                List user's privileges
GET    /api/dashboard/privileges/print/:id      Get printable summary
```

---

## 📱 Responsive Breakpoints

### Mobile (< 640px)
- Single column layouts
- Stacked cards
- Hamburger menus
- Full-width tables (horizontal scroll)

### Tablet (640px - 1024px)
- Two-column grids
- Side-by-side comparisons
- Collapsible panels

### Desktop (> 1024px)
- Three-column layouts
- Full side-by-side evidence comparison
- Expanded timeline views
- All features visible

---

## 🎨 Theme Support

### Light Mode
- Clean white backgrounds
- Subtle gray borders
- High contrast text

### Dark Mode
- Dark backgrounds (gray-950)
- Muted borders
- Adjusted color palette for readability

### Print Mode
- Black text on white
- Optimized page breaks
- Logo and signature areas
- Professional formatting

---

## 🐛 Troubleshooting

### Issue: Linter errors
**Solution:** Run `npm run lint` - all files should pass

### Issue: Type errors
**Solution:** All interfaces defined in each file; check imports

### Issue: Mock data not loading
**Solution:** Check browser console; verify useEffect dependencies

### Issue: Print not working
**Solution:** Use browser print (Ctrl/Cmd+P); ensure print CSS loaded

### Issue: Keyboard navigation not working
**Solution:** Check tabIndex and onKeyDown handlers; verify no keyboard traps

### Issue: Screen reader not announcing
**Solution:** Verify ARIA labels, role="alert", and aria-live regions

---

## 📚 Related Documentation

- **Main Summary:** `B135B_FRONTEND_IMPLEMENTATION_SUMMARY.md`
- **Previous Batch:** `B134B_PRIVILEGING_IMPLEMENTATION_SUMMARY.md`
- **Accessibility:** `app/org/privileges/_accessibilityAudit.ts`
- **Component Docs:** Check individual component JSDoc comments

---

## 🆘 Need Help?

### Code Questions
- Check component JSDoc comments
- Review TypeScript interfaces
- Examine mock data for examples

### Design Questions
- Review existing B134B implementation
- Check shadcn/ui documentation
- Use Tailwind CSS IntelliSense

### Accessibility Questions
- Review `_accessibilityAudit.ts`
- Test with screen reader
- Check WCAG 2.1 guidelines

---

**Quick Start:** `/org/privileges/renewals` for org reviewers, `/dashboard/privileges` for clinicians

**Last Updated:** November 13, 2025

