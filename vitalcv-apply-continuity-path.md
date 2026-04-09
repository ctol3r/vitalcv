# VitalCV Apply Continuity

## Application Continuity Improvements
- Enhanced `ApplyModal.tsx` to prominently frame the application as sending a verified "readiness passport", ensuring clinicians understand they are speeding up employer credentialing timelines.
- Re-labeled CTAs in `ExploreClient.tsx` from "View proof" / "Apply with VitalCV" to "Employer requirements" and "Apply with passport" to make job applications feel like a natural extension of the passport surface.
- Hardened `ClinicianReadinessCheck.tsx` (the employer-side readiness test) to route directly to the core `/passport?npi=...` instead of a separate review request, reinforcing one dominant workflow.
- Aligned trust status badging language across the UI to use the canonical snake_case mappings (`access_required`, `review_required`, `not_decision_grade`) ensuring the badges render correctly in the passport and apply views without build errors.
- Resolved TS compilation errors in `PassportWallet.tsx` related to undefined modal states and `status-language.ts` strict types.

## Files Changed
- `apps/web/app/developers/page.tsx`
- `apps/web/app/status/page.tsx`
- `apps/web/components/employers/ClinicianReadinessCheck.tsx`
- `apps/web/components/explore/ApplyModal.tsx`
- `apps/web/components/explore/ExploreClient.tsx`
- `apps/web/components/marketing/HomeSections.tsx`
- `apps/web/components/passport/PassportWallet.tsx`
- `apps/web/components/ui/trust-status-badge.tsx`
- `apps/web/lib/trust/passport-review-truth.ts`
- `apps/web/lib/trust/status-language.ts`

## Next-Action Path Map
1. Merge the `feature/apply-through-vcv` branch into `main` now that build errors are resolved and the frontend compiles successfully.
2. Conduct end-to-end testing of the apply flow via the public marketplace/explore page to ensure the `BundleShareEvent` correctly fires when "Apply with passport" is submitted.
3. Validate employer-side receipt of the application, ensuring the payload contains the full readiness passport and not a generic profile.
