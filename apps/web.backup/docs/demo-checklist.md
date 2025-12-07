# Demo Checklist - Full Flow

This checklist covers the end-to-end demo flow for the Chai VC Platform pilot.

## Prerequisites

1. **Services Running:**
   - [ ] Backend server (`npm run dev` in `backend/`)
   - [ ] Frontend server (`npm run dev` in `frontend/`)
   - [ ] Optional: ACA-Py mock (if using `docker-compose.dev.yml`)

2. **Environment:**
   - [ ] Backend accessible at `http://localhost:4000`
   - [ ] Frontend accessible at `http://localhost:3000`
   - [ ] API base URL configured in frontend

## Demo Flow Steps

### 1. NPI Lookup
- [ ] Open frontend
- [ ] Navigate to claim submission
- [ ] Enter valid NPI (e.g., `1234567893`)
- [ ] Verify NPI lookup returns provider information
- [ ] Status: Provider validated

### 2. Document Upload
- [ ] Upload a claim document (PDF/image)
- [ ] Verify document accepted
- [ ] Verify claim ID generated

### 3. OCR Parsing
- [ ] Document submitted to OCR endpoint
- [ ] Verify OCR returns parsed text and bounding boxes
- [ ] Verify OCR fields extracted (licenseNumber, name, etc.)
- [ ] Status: OCR processing

### 4. Claim Status Progression
- [ ] Check claim status immediately → `processing`
- [ ] Wait 2-5 seconds
- [ ] Check claim status → `ocr_complete`
- [ ] Verify status transitions to `attestation_pending`
- [ ] Status: Level 2 (OCR complete, ready for attestation)

### 5. Auto-Attest Webhook
- [ ] Trigger webhook: `POST /api/issuer/webhook` with `claimId`
- [ ] Verify webhook logs event to AuditScrapbook
- [ ] Verify VC issued with credential subject
- [ ] Verify claim status updates to `completed`
- [ ] Status: Level 3 (VC issued)

### 6. WalletView Display
- [ ] Navigate to `/wallet` page
- [ ] Verify VC appears in wallet list
- [ ] Verify VC shows:
  - Type (e.g., "MedicalLicenseVC")
  - Issued by
  - Issued at timestamp
  - Claim ID

### 7. Selective Disclosure
- [ ] Click "Share" button on a VC
- [ ] Modal opens with attribute list
- [ ] Select attributes to reveal (e.g., name, licenseNumber)
- [ ] Click "Generate Disclosure"
- [ ] Verify disclosure object returned:
  - `revealedAttributes`: array of selected attributes
  - `concealedAttributes`: array of non-selected attributes
  - `disclosureToken`: placeholder SD-JWT token

### 8. Command Palette
- [ ] Press `/` key (or `;;` or `jj`) to open command palette
- [ ] Verify commands displayed:
  - "Open Claim Wizard"
  - "Open Wallet"
  - "Copy VC Link"
  - "Run Quick NPI Lookup"
- [ ] Test search/filter functionality
- [ ] Select a command and verify action executes
- [ ] Press Escape to close palette

## E2E Test Execution

Run the full Cypress E2E test:

```bash
cd /workspace
npx cypress run --spec "cypress/e2e/claim-submission.cy.ts"
```

Expected results:
- [ ] All test steps pass
- [ ] NPI lookup succeeds
- [ ] Claim creation succeeds
- [ ] Status progression works (processing → ocr_complete → attestation_pending → completed)
- [ ] Webhook issues VC successfully
- [ ] VC appears in WalletView

## Quick cURL Smoke Tests

### 1. NPI Lookup
```bash
curl -X POST http://localhost:4000/api/npi/lookup \
  -H "Content-Type: application/json" \
  -d '{"npi": "1234567893"}'
```

### 2. Document Upload
```bash
curl -X POST http://localhost:4000/api/claim/doc \
  -F "document=@path/to/file.pdf" \
  -F "claimId=test_claim_123"
```

### 3. OCR Parse
```bash
curl -X POST http://localhost:4000/api/ocr/parse \
  -F "file=@path/to/image.png"
```

### 4. Claim Status
```bash
curl "http://localhost:4000/api/claim/status?claimId=YOUR_CLAIM_ID"
```

### 5. Auto-Attest Webhook
```bash
curl -X POST http://localhost:4000/api/issuer/webhook \
  -H "Content-Type: application/json" \
  -d '{"claimId": "YOUR_CLAIM_ID", "issuerId": "pilot-issuer-001"}'
```

### 6. Metrics
```bash
curl http://localhost:4000/api/metrics/json
```

## Acceptance Criteria

- [ ] **OCR Accuracy Threshold:** OCR returns deterministic fields for pilot (confidence: 0.99)
- [ ] **Level Change Timelines:** Status transitions occur within expected delays (2-5s for OCR, 3-7s for attestation)
- [ ] **Audit Logs Visible:** Events logged to AuditScrapbook for webhook and VC issuance
- [ ] **VC Issuance Proof Present:** VC object returned with valid structure and metadata

## Troubleshooting

- **Backend not accessible:** Check `backend/.env` and ensure PORT=4000
- **Frontend not accessible:** Check `frontend/next.config.js` and ensure port 3000
- **Command palette not working:** Check browser console for JavaScript errors
- **WalletView not displaying VCs:** Check localStorage for `wallet_vcs` key
- **Webhook not issuing VC:** Check claim status is `ocr_complete` or `attestation_pending`

## Notes for Leadership Demo

1. **Emphasize:**
   - Real-time status updates
   - Selective disclosure capability (privacy-preserving)
   - Audit trail (compliance-ready)
   - Command palette (user experience)

2. **Timeline:**
   - Full flow can be completed in ~30 seconds (with accelerated delays for demo)
   - In production, Level 2 checks take ~1-4 hours

3. **Security:**
   - All pilot features use deterministic stubs
   - No real credentials issued in pilot mode
   - Audit logs visible for compliance tracking
