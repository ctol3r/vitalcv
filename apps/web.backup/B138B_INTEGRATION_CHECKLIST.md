# B138B Compact Features - Integration Checklist

Use this checklist to integrate and test the compact features in your application.

## 📋 Pre-Integration

### Dependencies
- [ ] Verify all required dependencies are installed:
  - [ ] `d3` (for map visualization)
  - [ ] `topojson-client` (for map data)
  - [ ] Radix UI packages (via shadcn/ui)
  - [ ] Lucide React (icons)

### US Topology File
- [ ] Add US topology JSON file to `/public/us.json`
  - Download from: https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json
  - Or use TopoJSON US Atlas package

### Type Definitions
- [ ] Ensure TypeScript config includes:
  - [ ] ES2022+ target
  - [ ] Strict mode enabled
  - [ ] DOM types included

---

## 🔗 API Integration

### 1. Clinician Compacts Endpoint
- [ ] Create/update backend route: `GET /api/clinician/compacts`
- [ ] Add authentication middleware
- [ ] Implement database query for clinician compact data
- [ ] Test with sample NPIs
- [ ] Verify response format matches interface
- [ ] Add error handling
- [ ] Add caching if needed

**Response Schema**:
```json
{
  "npi": "1234567890",
  "name": "Dr. Jane Smith",
  "compacts": [
    {
      "compact": "IMLC",
      "status": "ACTIVE",
      "eligibleStates": ["CO", "CA", ...],
      "homeState": "CO",
      "dateEnrolled": "2024-03-15",
      "expirationDate": "2025-03-15"
    }
  ],
  "allLicensedStates": ["CO", "CA", "NY"]
}
```

### 2. Org Compact Map Endpoint
- [ ] Create/update backend route: `GET /api/org/compacts/clinicians-by-state`
- [ ] Add organization authentication
- [ ] Implement aggregation query
- [ ] Test with sample org IDs
- [ ] Verify response format
- [ ] Optimize for performance (consider caching)

**Response Schema**:
```json
[
  {
    "state": "California",
    "stateCode": "CA",
    "clinicianCount": 45,
    "compacts": {
      "imlc": 12,
      "psypact": 25,
      "counseling": 8
    }
  }
]
```

### 3. Job Schema Updates
- [ ] Add compact fields to Job model/schema:
  ```typescript
  compactAllowed?: boolean;
  imlcEligible?: boolean;
  psypactEligible?: boolean;
  counselingCompactEligible?: boolean;
  ```
- [ ] Create database migration
- [ ] Update job creation/edit forms
- [ ] Update job listing queries to include compact fields
- [ ] Test with existing jobs

---

## 🎨 UI Integration

### Navigation
- [ ] Add "Compacts" link to clinician dashboard menu
- [ ] Add "Clinician Map" link to org dashboard menu
- [ ] Update site navigation structure
- [ ] Test navigation on mobile and desktop

### Dashboard Integration
- [ ] Add compact widget to clinician dashboard
- [ ] Add compact stats to org dashboard
- [ ] Test responsive layouts
- [ ] Verify loading states

### Profile Pages
- [ ] Integrate `CompactBadges` component on clinician profiles
- [ ] Test with various compact statuses
- [ ] Verify tooltip display
- [ ] Test keyboard navigation

### Job Listings
- [ ] Integrate `JobCardCompacts` on job cards
- [ ] Integrate `CompactFilter` in job filters section
- [ ] Test filter combinations
- [ ] Verify match counts update correctly
- [ ] Test responsive job listing layout

---

## 🧪 Testing

### Unit Tests (Optional but Recommended)
- [ ] Test `matchesCompactFilter()` utility function
  - [ ] Test with compactOnly=false
  - [ ] Test with compactOnly=true, no specific filters
  - [ ] Test with specific compact filters
  - [ ] Test edge cases (missing fields, null values)

- [ ] Test `isCompactJob()` utility
  - [ ] Test with various job configurations
  - [ ] Test with missing compact fields

- [ ] Test `createCompactBadges()` helper
  - [ ] Test filtering by status
  - [ ] Test data transformation

### Integration Tests
- [ ] Test full compact dashboard page
  - [ ] Load with authenticated user
  - [ ] Verify all compact types display
  - [ ] Test external links
  - [ ] Test error handling

- [ ] Test eligibility wizard
  - [ ] Complete full flow
  - [ ] Test each license type
  - [ ] Test back/forward navigation
  - [ ] Test result display
  - [ ] Verify disclaimer visibility

- [ ] Test org map
  - [ ] Test map rendering
  - [ ] Test state hover/click
  - [ ] Test filter dropdown
  - [ ] Test zoom/pan functionality

- [ ] Test job filters
  - [ ] Toggle compact filter on/off
  - [ ] Select specific compacts
  - [ ] Combine with other filters
  - [ ] Verify results update correctly

### E2E Tests (Optional)
- [ ] Clinician views compact dashboard
- [ ] Clinician completes eligibility wizard
- [ ] Org admin views clinician map
- [ ] Job seeker filters by compact
- [ ] Clinician profile displays compact badges

---

## ♿ Accessibility Audit

### Automated Testing
- [ ] Run Lighthouse accessibility audit
  - [ ] Target score: 95+
  - [ ] Fix any violations
- [ ] Run axe DevTools audit
  - [ ] Fix all critical issues
  - [ ] Fix all serious issues
  - [ ] Review moderate issues
- [ ] Test with WAVE browser extension
  - [ ] Check for contrast errors
  - [ ] Check for ARIA issues

### Keyboard Navigation
- [ ] Test all pages with Tab key only
- [ ] Verify focus visible on all interactive elements
- [ ] Test Escape key on modals/tooltips
- [ ] Test Enter/Space on buttons and checkboxes
- [ ] Verify no keyboard traps
- [ ] Check tab order is logical

### Screen Reader Testing
- [ ] Test with NVDA (Windows)
  - [ ] Navigate through dashboard
  - [ ] Complete eligibility wizard
  - [ ] Use job filters
  - [ ] Interact with map
- [ ] Test with JAWS (Windows) - if available
- [ ] Test with VoiceOver (Mac) - if available
  - [ ] Same tests as NVDA
- [ ] Verify all images have alt text
- [ ] Verify all form inputs have labels
- [ ] Verify ARIA labels are correct
- [ ] Check landmark regions are defined

### Visual Testing
- [ ] Test at 200% browser zoom
  - [ ] Verify no horizontal scrolling
  - [ ] Verify text doesn't overlap
- [ ] Test at 400% browser zoom
- [ ] Test in high contrast mode (Windows)
- [ ] Test with color blindness simulator
  - [ ] Deuteranopia (red-green)
  - [ ] Protanopia (red-green)
  - [ ] Tritanopia (blue-yellow)
  - [ ] Monochromacy
- [ ] Verify WCAG AA contrast ratios (4.5:1)
  - Use contrast checker tool
  - Check all text colors
  - Check all interactive elements

---

## 🌐 Browser Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Chrome Mobile (Android)
- [ ] Firefox Mobile (Android)
- [ ] Samsung Internet

### Test Cases per Browser
- [ ] Page loads correctly
- [ ] All interactive elements work
- [ ] Tooltips display properly
- [ ] Map renders and is interactive
- [ ] Responsive layouts work
- [ ] No console errors

---

## 📱 Responsive Testing

### Breakpoints to Test
- [ ] Mobile (320px - 640px)
  - [ ] iPhone SE (375px)
  - [ ] iPhone 12/13 (390px)
  - [ ] Pixel 5 (393px)
- [ ] Tablet (640px - 1024px)
  - [ ] iPad Mini (768px)
  - [ ] iPad Air (820px)
  - [ ] iPad Pro (1024px)
- [ ] Desktop (1024px+)
  - [ ] Laptop (1280px)
  - [ ] Desktop (1920px)
  - [ ] Large (2560px)

### Responsive Checks
- [ ] Navigation menus work on all sizes
- [ ] Cards stack properly on mobile
- [ ] Map is usable on mobile (touch gestures)
- [ ] Tables/lists scroll horizontally if needed
- [ ] Filters work in mobile view
- [ ] Text is readable without zooming
- [ ] Touch targets are 44px minimum

---

## 🚀 Performance Testing

### Lighthouse Performance
- [ ] Run Lighthouse performance audit
  - [ ] Target score: 90+
  - [ ] First Contentful Paint < 1.8s
  - [ ] Largest Contentful Paint < 2.5s
  - [ ] Total Blocking Time < 200ms
  - [ ] Cumulative Layout Shift < 0.1

### Optimization Checks
- [ ] Map component lazy loads
- [ ] Large lists use virtualization
- [ ] Images are optimized
- [ ] API responses are cached where appropriate
- [ ] Bundle size is reasonable
  - [ ] Check for duplicate dependencies
  - [ ] Consider code splitting if needed

### Network Testing
- [ ] Test on slow 3G network
  - [ ] Verify loading states show
  - [ ] Verify error handling works
  - [ ] Verify timeout handling
- [ ] Test offline behavior
  - [ ] Verify appropriate error messages

---

## 🔒 Security Testing

### Authentication
- [ ] Verify API endpoints require authentication
- [ ] Test with expired tokens
- [ ] Test with invalid tokens
- [ ] Verify clinician can only see own data
- [ ] Verify org can only see their clinicians

### Data Validation
- [ ] Test with malformed API responses
- [ ] Test with missing required fields
- [ ] Verify XSS protection (input sanitization)
- [ ] Test external links use rel="noopener noreferrer"

---

## 📊 Data & Business Logic

### Compact Eligibility Logic
- [ ] IMLC eligibility calculation is correct
- [ ] PSYPACT eligibility calculation is correct
- [ ] Counseling Compact eligibility is correct
- [ ] Member state lists are accurate and up-to-date
- [ ] Status transitions work correctly
  - [ ] NOT_ELIGIBLE → ELIGIBLE → ACTIVE
  - [ ] ACTIVE → EXPIRED → ELIGIBLE

### Job Filtering
- [ ] Compact-only filter works correctly
- [ ] Specific compact filters work
- [ ] Filter combinations work as expected
- [ ] Match counts are accurate
- [ ] Reset filters works

### Map Visualization
- [ ] State boundaries are accurate
- [ ] Clinician counts are correct
- [ ] Color scale represents data accurately
- [ ] Tooltips show correct information
- [ ] Selected state details match map data

---

## 📝 Documentation

### Code Documentation
- [ ] All components have JSDoc comments
- [ ] All props are documented
- [ ] Complex functions have inline comments
- [ ] README files are up-to-date

### User Documentation
- [ ] Create user guide for clinicians
- [ ] Create user guide for org admins
- [ ] Document eligibility requirements
- [ ] Create FAQ for compact features
- [ ] Add tooltips/help text where needed

### Developer Documentation
- [ ] API documentation is complete
- [ ] Integration guide is clear
- [ ] Usage examples are provided
- [ ] Architecture decisions are documented

---

## 🎯 Go-Live Checklist

### Pre-Launch
- [ ] All integration steps complete
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Performance is acceptable
- [ ] Accessibility meets WCAG AA
- [ ] Security review complete
- [ ] Stakeholder approval

### Launch Day
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Check analytics tracking
- [ ] Verify all features work in production

### Post-Launch
- [ ] Monitor user feedback
- [ ] Track feature usage
- [ ] Monitor error rates
- [ ] Schedule follow-up review (1 week)
- [ ] Plan future enhancements

---

## 🐛 Known Issues to Address

Before going live, address these known limitations:

1. **Mock Data**
   - [ ] Replace all mock API calls with real endpoints
   - [ ] Remove mock data fallbacks

2. **US Topology File**
   - [ ] Add us.json to public folder
   - [ ] Verify file loads correctly
   - [ ] Consider CDN hosting for performance

3. **Member State Lists**
   - [ ] Fetch from API instead of hardcoding
   - [ ] Set up automatic updates from official sources
   - [ ] Add last updated date display

4. **Authentication**
   - [ ] Add auth checks to all routes
   - [ ] Implement proper error handling for auth failures
   - [ ] Add session timeout handling

5. **Real-time Updates**
   - [ ] Consider WebSocket for live compact status updates
   - [ ] Add refresh button/auto-refresh
   - [ ] Show last updated timestamp

---

## 📞 Support & Troubleshooting

### Common Issues

**Map not rendering**
- Check if us.json is in public folder
- Check browser console for D3 errors
- Verify topojson-client is installed

**Compact badges not showing**
- Verify API returns correct status ('ACTIVE' or 'ELIGIBLE')
- Check if compacts array is empty
- Verify component is imported correctly

**Filters not working**
- Check if matchesCompactFilter is imported
- Verify job object has compact fields
- Check filter state updates

**Accessibility issues**
- Run automated audit first
- Check ARIA labels are present
- Verify keyboard navigation works
- Test with screen reader

### Getting Help

1. Check implementation documentation
2. Review usage examples
3. Check inline code comments
4. Test with mock data first
5. Contact development team

---

## ✅ Final Sign-off

Before marking integration complete:

- [ ] All checklist items completed
- [ ] All known issues addressed
- [ ] Testing documentation complete
- [ ] User acceptance testing passed
- [ ] Product owner approval
- [ ] Technical lead approval

**Integration completed by**: ________________
**Date**: ________________
**Sign-off**: ________________

---

**Questions or issues?** Refer to `B138B_COMPACT_FEATURES_IMPLEMENTATION.md` for detailed documentation.

