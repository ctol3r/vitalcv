# B134B Privileging System - Workflow Diagram

## 🗺️ Application Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ORGANIZATION PRIVILEGING PORTAL                  │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    1. PRIVILEGE SET MANAGEMENT                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  /org/privilegeSets                                                  │
│  ┌─────────────────────────────────────────┐                        │
│  │  📋 Privilege Sets List                  │                        │
│  │  ├─ Cardiology - Interventional         │                        │
│  │  ├─ General Surgery - Advanced          │                        │
│  │  └─ Emergency Medicine - Level I        │                        │
│  │                                          │                        │
│  │  [+ Create Privilege Set]  ──────────────────┐                   │
│  └─────────────────────────────────────────┘    │                   │
│                                                  │                   │
│                                                  ▼                   │
│  /org/privilegeSets/new                                             │
│  ┌─────────────────────────────────────────┐                        │
│  │  ✏️  Create Privilege Set Form           │                        │
│  │  ├─ Name: ___________________            │                        │
│  │  ├─ Department: [Dropdown]               │                        │
│  │  ├─ Procedures:                          │                        │
│  │  │   [Angiography] [PCI] [+Add]         │                        │
│  │  ├─ Requirements:                        │                        │
│  │  │   Years Experience: ___              │                        │
│  │  │   Min Case Volume: ___               │                        │
│  │  └─ [Cancel] [Create]                   │                        │
│  └─────────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    2. PRIVILEGE REQUEST REVIEW                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  /org/privileges                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  📊 Privilege Request Queue                                  │    │
│  │  [Search...] [Filter: All]                                   │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │ Clinician      │ Set          │ Status  │ Date       │  │    │
│  │  ├────────────────────────────────────────────────────────┤  │    │
│  │  │ Dr. Johnson    │ Cardiology   │ 🟡 Pending  │ Nov 10 │ ─┼──┐ │
│  │  │ Dr. Chen       │ Surgery      │ 🔵 Review   │ Nov 8  │  │  │ │
│  │  │ Dr. Martinez   │ Emergency    │ 🟢 Approved │ Nov 5  │  │  │ │
│  │  └────────────────────────────────────────────────────────┘  │  │ │
│  └─────────────────────────────────────────────────────────────┘  │ │
│                                                                     │ │
│                                                                     ▼ │
│  /org/privileges/[id]                                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔍 Review Privilege Request                                 │    │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐   │    │
│  │  │ 👤 Clinician Info │  │ 📊 Analysis & Decision        │   │    │
│  │  │  Dr. Sarah J.    │  │                                │   │    │
│  │  │  NPI: 1234567890 │  │ ✅ PASS REASONS:              │   │    │
│  │  │  Cardiology      │  │ • Board certified              │   │    │
│  │  │                  │  │ • 12 years experience          │   │    │
│  │  ├──────────────────┤  │ • 450+ cases                   │   │    │
│  │  │ 🛡️  VC Snapshot   │  │                                │   │    │
│  │  │  [Show JSON]     │  │ 📝 Review Notes:               │   │    │
│  │  │  Type: Medical   │  │ [________________]             │   │    │
│  │  │  Issuer: CA Med  │  │                                │   │    │
│  │  │  Expires: 2025   │  │ [✅ Approve] [❌ Deny]         │   │    │
│  │  └──────────────────┘  └────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                  3. FPPE/OPPE EVALUATION DASHBOARD                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  /org/oppe                                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  📈 FPPE/OPPE Dashboard                                      │    │
│  │  ⚠️  3 Overdue Evaluations - Require Immediate Attention    │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐      │    │
│  │  │ Total   │ │ FPPE    │ │ OPPE    │ │ ⚠️  Needs     │      │    │
│  │  │   10    │ │   4     │ │   6     │ │   Attention  │      │    │
│  │  └─────────┘ └─────────┘ └─────────┘ │      5       │      │    │
│  │                                       └──────────────┘      │    │
│  │  [All] [FPPE] [OPPE]                                        │    │
│  │  [Search...] [Filter: All]                                  │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │ Clinician  │ Dept    │ Type │ Due Date  │ Status     │  │    │
│  │  ├────────────────────────────────────────────────────────┤  │    │
│  │  │ Dr. J.     │ Cardio  │ FPPE │ Nov 15 ⚠️  │ 🔴 Overdue │ ─┼──┐ │
│  │  │ Dr. C.     │ Surgery │ OPPE │ Dec 1  ⏰  │ 🟡 Due Soon│ ─┼─┐│ │
│  │  │ Dr. M.     │ Emerg   │ OPPE │ Jan 15    │ 🟢 Upcoming│  │ ││ │
│  │  └────────────────────────────────────────────────────────┘  │ ││ │
│  └─────────────────────────────────────────────────────────────┘ ││ │
│                                                                   ││ │
│      ┌───────────────────────────────────────────────────────────┘│ │
│      │  ┌─────────────────────────────────────────────────────────┘ │
│      ▼  ▼                                                            │
│                                                                       │
│  /org/oppe/fppe/[id]              /org/oppe/oppe/[id]               │
│  ┌──────────────────────┐         ┌──────────────────────┐          │
│  │ 📋 FPPE Evaluation    │         │ 📊 OPPE Evaluation   │          │
│  │ (Initial)             │         │ (Ongoing)            │          │
│  │                       │         │                      │          │
│  │ ✓ Technical Comp.     │         │ ⭐ Quality of Care   │          │
│  │ • Skill: ⚪️⚪️⚪️      │         │ • Outcomes:          │          │
│  │          ⭕Pass        │         │   ⭕Excellent         │          │
│  │          ⚪️Fail       │         │   ⚪️Satisfactory     │          │
│  │          ⚪️N/A        │         │   ⚪️Needs Improv.    │          │
│  │ • Protocols: ⚪️⚪️⚪️  │         │   ⚪️Unsatisfactory   │          │
│  │ • Complications: ⚪️⚪️⚪️│         │ • Evidence-based:    │          │
│  │                       │         │   [Rating buttons]   │          │
│  │ ✓ Clinical Judgment   │         │                      │          │
│  │ • Decisions: ⚪️⚪️⚪️   │         │ 🛡️  Patient Safety    │          │
│  │ • Limitations: ⚪️⚪️⚪️ │         │ • Adverse events:    │          │
│  │                       │         │   [Rating buttons]   │          │
│  │ ✓ Communication       │         │ • Safety protocols:  │          │
│  │ ✓ Professionalism     │         │   [Rating buttons]   │          │
│  │ ✓ Patient Safety      │         │                      │          │
│  │                       │         │ 💬 Communication      │          │
│  │ ─────────────────     │         │ 👔 Professionalism   │          │
│  │ Overall:              │         │ ⚡ Efficiency         │          │
│  │ ⚪️ Approve Full       │         │                      │          │
│  │ ⚪️ Approve w/Cond.    │         │ ─────────────────    │          │
│  │ ⚪️ Deny               │         │ Overall Assessment:  │          │
│  │                       │         │ ⚪️ PASS              │          │
│  │ 📝 Summary:           │         │ ⚪️ FAIL              │          │
│  │ [_____________]       │         │                      │          │
│  │                       │         │ 📝 Summary:          │          │
│  │ [Submit Evaluation]   │         │ [_____________]      │          │
│  └──────────────────────┘         │                      │          │
│                                    │ [Save] [Submit]      │          │
│                                    └──────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    4. PRIVILEGE CARD COMPONENT                       │
│                          (Reusable UI)                               │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🩺 Cardiology - Interventional            🟢 Active         │    │
│  │ Cardiology                                                  │    │
│  │                                                             │    │
│  │ Authorized Procedures (15)                                  │    │
│  │ [Angiography] [PCI] [Catheterization] +12 more             │    │
│  │                                                             │    │
│  │ ────────────────────────────────────────────────────────   │    │
│  │ 📅 Last Review        📅 Next Review                        │    │
│  │ Jan 15, 2024          Jul 15, 2024                         │    │
│  │ Dr. Smith                                                   │    │
│  │                                                             │    │
│  │ Granted on Jan 15, 2023                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## 🔄 User Workflows

### Workflow 1: Create New Privilege Set
```
Admin → /org/privilegeSets
     → Click "Create Privilege Set"
     → Fill form (/org/privilegeSets/new)
     → Add procedures
     → Set requirements
     → Submit
     → Return to list
```

### Workflow 2: Review Privilege Request
```
Reviewer → /org/privileges (Queue)
        → Search/Filter for specific request
        → Click on request row
        → View VC & Analysis (/org/privileges/[id])
        → Review PASS/FAIL reasons
        → Add notes
        → Approve or Deny
        → Return to queue
```

### Workflow 3: Complete FPPE Evaluation
```
Reviewer → /org/oppe (Dashboard)
        → Filter "FPPE" tab
        → Click overdue evaluation
        → Complete checklist (/org/oppe/fppe/[id])
        → Rate each criterion (Pass/Fail/N/A)
        → Add comments for failures
        → Select overall recommendation
        → Write summary
        → Submit
        → Return to dashboard
```

### Workflow 4: Complete OPPE Evaluation
```
Reviewer → /org/oppe (Dashboard)
        → Filter "OPPE" tab or status "Due Soon"
        → Click on evaluation
        → Rate metrics (/org/oppe/oppe/[id])
        → Excellent / Satisfactory / Needs Improvement / Unsatisfactory
        → Add required comments
        → Select PASS/FAIL assessment
        → Save draft (optional)
        → Submit evaluation
        → Return to dashboard
```

## 🎨 Visual Legend

- 🟢 Active/Approved/Pass
- 🟡 Pending/Due Soon/Warning
- 🔵 Under Review/In Progress
- 🔴 Overdue/Denied/Fail
- ⚠️  Attention Required
- ✅ Checkmark/Success
- ❌ Deny/Fail
- ⏰ Time-sensitive
- 📋 List/Queue
- 📊 Dashboard/Analytics
- 🔍 Review/Inspect
- 👤 User/Clinician
- 🛡️  Security/Verification
- 📝 Notes/Comments
- 🩺 Medical/Clinical
- 📅 Calendar/Date
- 📈 Trending/Progress
- ⭐ Rating/Quality

## 🔗 Navigation Paths

```
Homepage
  └── Organization Portal
       ├── Privilege Sets (/org/privilegeSets)
       │    └── Create New (/org/privilegeSets/new)
       │
       ├── Privilege Requests (/org/privileges)
       │    └── Review Request (/org/privileges/[id])
       │
       └── FPPE/OPPE Dashboard (/org/oppe)
            ├── FPPE Evaluation (/org/oppe/fppe/[id])
            └── OPPE Evaluation (/org/oppe/oppe/[id])
```

## 📱 Responsive Breakpoints

- **Mobile:** < 640px (stacked layout, simplified tables)
- **Tablet:** 640px - 1024px (2-column grids)
- **Desktop:** > 1024px (full layout, 3-column grids)

## ♿ Accessibility Features

- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ ARIA labels and descriptions
- ✅ Focus indicators
- ✅ Screen reader announcements
- ✅ Color contrast (WCAG AA)
- ✅ Form field associations
- ✅ Error messages with role="alert"

## 🎯 Key Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Create Privilege Set | Button click | Navigate to form |
| View Request | Table row click | Navigate to review panel |
| Approve/Deny | Button click | Update status, return to queue |
| Complete Evaluation | Form submit | Save data, return to dashboard |
| Filter Queue | Dropdown change | Filter displayed items |
| Search | Text input | Real-time filter results |
| Save Draft | Button click | Save without validation |

---

**Last Updated:** November 13, 2025
**Version:** 1.0.0
**Status:** ✅ Complete

