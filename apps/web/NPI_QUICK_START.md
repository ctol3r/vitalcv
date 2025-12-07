# NPI Claim System - Quick Start Guide

## 🚀 Getting Started

### 1. Start the Development Server

```bash
npm run dev
# or
pnpm dev
```

### 2. Navigate to the Start Page

Open [http://localhost:3000/start](http://localhost:3000/start)

### 3. Test the Flow

## 🧪 Testing the Complete Flow

### Step 1: NPI Lookup

1. Go to `/start`
2. Enter a valid 10-digit NPI (examples below)
3. Click "Search"

**Test NPIs** (real from NPPES):

- `1801921148` - Individual physician
- `1538102066` - Individual nurse practitioner
- `1043233337` - Organization (hospital)

### Step 2: View Public Profile

- See Type badge (Type 1 or Type 2)
- View specialty/taxonomy
- See addresses and contact info
- Note the warning: "Public NPI record — not verified as your account"
- Click **"Claim this NPI"**

### Step 3: Level 1 Verification (Email)

1. Enter your email address
2. Optionally add phone number
3. Click "Send Verification Code"
4. **Check console** for the PIN (development only)
5. Enter the 6-digit PIN
6. Click "Verify Code"

**Expected**: Green success message + navigation to Level 2

### Step 4: Level 2 Verification (Identity)

1. **Upload Documents**:

   - Click the upload area
   - Select 1-3 documents (PDF, JPG, PNG)
   - Max 10MB per file

2. **Capture Selfie**:

   - Option A: Click "Take Photo" (allows camera access)
   - Option B: Click "Upload Photo" (select from files)

3. Click "Submit Documents"

**Expected**:

- Upload progress bar
- Identity confidence score (85-100%)
- Success message
- Navigation to Level 3

### Step 5: Level 3 Attestation (Issuer)

1. Read the attestation explanation
2. Click "Request Issuer Attestation"
3. Request is created and submitted

**Expected**:

- Request ID generated
- Redirect to wallet after 3 seconds

### Step 6: View in Wallet

1. Navigate to `/wallet`
2. See your **Claim Status Chip** in the header
3. Shows current level (L1, L2, or pending L3)

### Step 7: Issuer Review (Role Switch)

1. For testing, manually create a session with issuer role
2. Navigate to `/issuer`
3. Click the **"Attestation Requests"** tab
4. See pending requests with NPI and request ID
5. Actions: Approve, Review Details, or Reject

## 🎯 Quick Test Script

```javascript
// Run in browser console on /start page

// 1. Set up a test session
localStorage.setItem(
  'vital-cv-session',
  JSON.stringify({
    userId: 'test-user-123',
    email: 'test@example.com',
    roles: ['holder', 'issuer', 'verifier'],
    claimLevel: 2,
    npi: '1801921148',
    selectedRole: 'holder',
  }),
);

// 2. Reload page to see role switcher
location.reload();

// Now you have all three roles and can test the full flow
```

## 📱 Mobile Testing

### Camera Capture

1. Open on mobile device or use Chrome DevTools device emulation
2. Go through claim flow to Level 2
3. Click "Take Photo"
4. Grant camera permissions
5. Capture selfie
6. Photo appears with checkmark

### Responsive Design

Test all breakpoints:

- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

## 🔍 Debugging

### Check Session State

```javascript
// View current session
JSON.parse(localStorage.getItem('vital-cv-session') || '{}');

// View selected role
localStorage.getItem('vital-cv-selected-role');
```

### Clear Session

```javascript
localStorage.removeItem('vital-cv-session');
localStorage.removeItem('vital-cv-selected-role');
location.reload();
```

### View Console Logs

Development mode logs:

- PIN codes (for email verification)
- Telemetry events
- API responses
- Upload progress

## 🎨 Component Playground

### Test Individual Components

#### NpiSearchBox

```tsx
import { NpiSearchBox } from '@/components/NpiSearchBox';

<NpiSearchBox
  onSearch={async (npi) => console.log('Searching:', npi)}
  autoSearch={true}
  debounceMs={300}
/>;
```

#### ClaimStatusChip

```tsx
import { ClaimStatusChip } from '@/components/ClaimStatusChip';

<ClaimStatusChip level={0} showLabel={true} />
<ClaimStatusChip level={1} showLabel={true} />
<ClaimStatusChip level={2} showLabel={true} />
<ClaimStatusChip level={3} showLabel={true} />
```

#### RoleSwitcher

```tsx
import { RoleSwitcher } from '@/components/RoleSwitcher';

<RoleSwitcher availableRoles={['holder', 'issuer', 'verifier']} />;
```

## 🧩 API Testing

### Test Endpoints Directly

```bash
# Lookup NPI
curl "http://localhost:3000/api/npi/lookup?npi=1801921148"

# Start claim
curl -X POST http://localhost:3000/api/claim/basic \
  -H "Content-Type: application/json" \
  -d '{"npi":"1801921148","email":"test@example.com"}'

# Verify PIN (check console for PIN)
curl -X POST http://localhost:3000/api/claim/verify-pin \
  -H "Content-Type: application/json" \
  -d '{"npi":"1801921148","pin":"123456"}'

# Get claim status
curl "http://localhost:3000/api/claim/status?npi=1801921148"

# Request attestation
curl -X POST http://localhost:3000/api/issuer/attest-request \
  -H "Content-Type: application/json" \
  -d '{"npi":"1801921148"}'

# Get attestation requests
curl "http://localhost:3000/api/issuer/attest-request"
```

## ⚠️ Common Issues

### Issue: "Invalid NPI format"

**Solution**: Ensure NPI is exactly 10 digits, no spaces or dashes

### Issue: "No verification request found"

**Solution**: Complete Step 3 (email verification) first

### Issue: "Invalid verification code"

**Solution**: Check console for the generated PIN, or request a new one

### Issue: Camera not working

**Solutions**:

- Grant camera permissions in browser
- Use HTTPS in production
- Fallback to file upload

### Issue: Role switcher not appearing

**Solutions**:

- User must have >1 role in session
- Session must be loaded (check localStorage)
- Page must be reloaded after session change

## 📊 Expected Behavior

### Level 0 → Level 1

- Email verification required
- Takes ~30 seconds
- Role switcher appears if organization

### Level 1 → Level 2

- Document + selfie upload required
- Takes 2-5 minutes
- Identity confidence displayed

### Level 2 → Level 3

- Issuer attestation required
- Takes 1-5 business days (in production)
- Instant in development (manual approval)

## 🎓 Learning Path

1. **Start Simple**: Test NPI lookup only
2. **Add Claiming**: Go through Level 1 verification
3. **Try Identity**: Upload documents at Level 2
4. **Role Switch**: Test issuer approval flow
5. **Full Flow**: Complete end-to-end with all roles

## 📝 Feedback & Issues

When testing, note:

- UX friction points
- Confusing messaging
- Mobile usability issues
- Performance bottlenecks
- Accessibility concerns

## 🔗 Useful Links

- [NPPES NPI Search](https://npiregistry.cms.hhs.gov/) - Find real NPIs
- [Component Storybook](http://localhost:6006) - If configured
- [API Documentation](./NPI_CLAIM_IMPLEMENTATION.md) - Full spec

## ✅ Testing Checklist

- [ ] NPI lookup with valid NPI
- [ ] NPI lookup with invalid NPI
- [ ] Email verification (Level 1)
- [ ] Document upload (Level 2)
- [ ] Selfie capture via camera
- [ ] Selfie upload via file
- [ ] Attestation request (Level 3)
- [ ] Role switching (multiple roles)
- [ ] Mobile camera capture
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Error handling
- [ ] Loading states
- [ ] Success messages

---

**Happy Testing! 🎉**

For questions or issues, refer to the main implementation doc: [NPI_CLAIM_IMPLEMENTATION.md](./NPI_CLAIM_IMPLEMENTATION.md)
