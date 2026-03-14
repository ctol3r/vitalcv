# Ecosystem Adoption Guide

**For:** Staffing platforms, HR tech vendors, credential issuers, EHR vendors, health systems  
**Version:** 1.0.0  

---

## Why Implement the VitalCV Trust Protocol?

Healthcare faces a structural workforce crisis. By 2032, the US will face a shortage of 124,000 physicians and 1.2M nurses — not because clinicians don't exist, but because credentialing takes 3–6 months per hire.

**The VitalCV Trust Protocol solves this at the infrastructure layer.**

When your platform speaks Trust Band, you can:
- Reduce time-to-start from months to days
- Eliminate redundant credentialing across employers
- Provide candidates with portable, verifiable credentials
- Accept cryptographic audit evidence instead of paper stacks

---

## Adoption Tiers

### Tier 1: Display — 1 hour to implement

Display a clinician's trust band in your UI. No API key required for public passports.

```html
<!-- Add to any candidate profile -->
<a href="https://vitalcv.com/p/1234567890">
  <img src="https://vitalcv.com/api/passport/1234567890/embed.svg" 
       alt="VitalCV Verified" 
       height="80" />
</a>
```

**Signals to candidates:** Your platform is trust-aware.  
**Signals to employers:** Candidates have portable verified credentials.

---

### Tier 2: Query — 1 day to implement

Query trust state directly for any clinician in your system.

```bash
# Get trust band
curl https://api.vitalcv.com/api/trust-state/1234567890 \
  -H "Authorization: Bearer <api_key>"

# Get full passport
curl https://api.vitalcv.com/api/passport/1234567890/card.json
```

**Use cases:**
- Auto-flag candidates who are L3 (credentialing complete) in your pipeline
- Show trust band on candidate cards
- Trigger different workflows based on readiness level

---

### Tier 3: Webhook — 1 week to implement

Receive real-time notifications when a clinician's trust state changes or they apply through VitalCV.

```typescript
// Your webhook handler
app.post('/vitalcv/webhook', (req, res) => {
  if (!verifySignature(req.body, req.headers['x-vitalcv-signature'], SECRET)) {
    return res.status(401).end();
  }

  const event = req.body;
  
  if (event.event === 'passport.verified' && event.candidate.trustBand === 'GREEN') {
    // Immediately advance candidate in your pipeline
    await ats.updateCandidateStage(event.employer.candidateId, 'CREDENTIAL_VERIFIED');
    await ats.addNote(event.employer.candidateId, formatVerificationNote(event));
  }
  
  res.status(200).json({ received: true });
});
```

**Impact:** Credentialing steps happen automatically in your existing workflow.

---

### Tier 4: Embed Widget — 2 weeks to implement

Add the VitalCV credential verification widget to your application flow. Clinicians verify their credentials directly in your product.

```html
<!-- Add to your job application page -->
<div id="vitalcv-verify"></div>
<script src="https://vitalcv.com/sdk/v1/embed.js"></script>
<script>
  VitalCV.mount('#vitalcv-verify', {
    clientId: 'your_client_id',
    jobId: application.jobId,
    role: job.title,
    requiredCredentials: ['medical_license', 'board_certification'],
    onVerified: (receipt) => {
      application.trustBand = receipt.readinessScore;
      application.credentialsVerified = receipt.credentialsVerified;
      submitApplication();
    },
  });
</script>
```

**Impact:** Verification happens at application time, not after hire. Companies that implement this reduce credentialing delays by 60–80%.

---

### Tier 5: Full Protocol — 1 month to implement

Issue your own Verification Artifacts in the VitalCV format, register as a trust anchor, and participate in the global trust graph.

For licensing boards, credential bodies, and verification organizations.

Contact: [protocol@vitalcv.com](mailto:protocol@vitalcv.com)

---

## ATS Integration Quick Reference

### Greenhouse

```bash
GREENHOUSE_API_KEY=<harvest_api_key>
GREENHOUSE_ON_BEHALF_OF=<user_id>
```

VitalCV automatically:
1. Adds a note to the candidate record with trust band + score
2. Tags candidates with `vitalcv-verified` or `vitalcv-pending`
3. Links to the public passport page

→ Full example: [greenhouse-example.ts](../../../integration-kits/hris-ats/greenhouse-example.ts)

### Lever

```bash
LEVER_API_KEY=<lever_api_key>
```

→ Full example: [lever-example.ts](../../../integration-kits/hris-ats/lever-example.ts)

### Workday

```bash
WORKDAY_TENANT=<tenant>
WORKDAY_CLIENT_ID=<client_id>
WORKDAY_CLIENT_SECRET=<client_secret>
```

→ Full example: [workday-example.ts](../../../integration-kits/hris-ats/workday-example.ts)

### iCIMS

```bash
ICIMS_CUSTOMER_ID=<customer_id>
ICIMS_USERNAME=<username>
ICIMS_PASSWORD=<password>
```

→ Full example: [icims-example.ts](../../../integration-kits/hris-ats/icims-example.ts)

---

## For Licensing Boards and Credential Bodies

### Why participate?

Your credential data is queried through VitalCV thousands of times per day. By registering as a trust anchor, you:
- Control how your credentials are represented
- Reduce load on your public lookup infrastructure
- Get analytics on how your credentials are used in hiring
- Issue W3C Verifiable Credentials directly to clinician wallets

### How to register

1. Contact [protocol@vitalcv.com](mailto:protocol@vitalcv.com)
2. We'll verify your authority via NPPES or direct outreach
3. You'll get a DID (`did:vitalcv:board:<state>:<type>`) and signing key
4. Your artifacts will be marked `sourceType: "PrimarySource"` in the trust graph

---

## Protocol Compatibility Statement Template

Once you've implemented Trust Band display or higher, you may use this statement:

> "[Your Company] supports the VitalCV Trust Protocol. Clinicians with verified credentials from VitalCV can display their trust band (L0–L3) directly in [Your Company]'s platform. Powered by [VitalCV Trust Protocol v1.0](https://vitalcv.com/protocol)."

---

## Contact

- Protocol questions: [protocol@vitalcv.com](mailto:protocol@vitalcv.com)  
- Partnership inquiries: [partners@vitalcv.com](mailto:partners@vitalcv.com)  
- Technical support: [developers@vitalcv.com](mailto:developers@vitalcv.com)  
- GitHub: [github.com/vitalcv](https://github.com/vitalcv)
