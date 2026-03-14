## Wave Wallet — Clinician Credential Wallet (Expo)

Exit criteria: clinician can present credentials WITHOUT VitalCV servers.

### READ THESE FIRST
- packages/wallet-sdk/src/index.ts — VitalCVWallet SDK (API-connected)
- apps/mobile/ — EMPTY (you create the Expo app here)
- apps/api/backend/src/routes/oid4vp.ts — backend OID4VP routes

### CONSTRAINTS
- apps/mobile/ must be standalone Expo SDK 52+ React Native app (managed workflow)
- TypeScript strict. pnpm --filter @vitalcv/wallet-sdk build must still pass.
- All credential crypto uses jose library
- NO backend changes

### BUILD THESE

**1. apps/mobile/package.json** — Expo app with expo ~52.0.0, expo-router ~4.0.0, expo-secure-store ~14.0.0, expo-local-authentication ~14.0.0, expo-notifications ~0.29.0, expo-camera ~15.0.0, jose ^5.0.0, react-native 0.76.5
**apps/mobile/app.json** — name: "VitalCV Wallet", slug: vitalcv-wallet, scheme: vitalcv, dark theme #080e1a, bundleId: com.vitalcv.wallet
**apps/mobile/tsconfig.json** — extends expo/tsconfig.base, strict: true

**2. apps/mobile/src/services/LocalCredentialStore.ts**
Stores credentials in expo-secure-store (chunked by 2KB limit).
Interfaces: StoredCredential { id, npi, type, issuer, status, issuedAt, expiresAt, vcJwt, claims, issuerDid, proofAlgorithm }
LocalKeyPair { privateKeyJwk, publicKeyJwk, did, createdAt }
Class LocalCredentialStore:
- getOrCreateKeyPair(): generate ES256 key pair via jose generateKeyPair, derive did:key, store in SecureStore
- getHolderDid(): returns did:key from stored key pair
- storeCredential/listCredentials/getCredential/removeCredential/getExpiringCredentials(daysThreshold)
- syncFromApi(apiCredentials): upserts credentials from API response
Export: localCredentialStore singleton

**3. apps/mobile/src/services/OfflinePresentationEngine.ts**
Generates W3C VP JWTs locally using jose (no network).
Interface: OfflinePresentationRequest { credentialIds, verifierDid?, nonce?, disclosedClaims?, expiresInSeconds? }
Interface: OfflinePresentation { vpJwt, holderDid, credentialIds, createdAt, expiresAt, qrData }
Class OfflinePresentationEngine:
- createPresentation(req): loads key pair → importJWK → builds VP payload → SignJWT with ES256 → returns OfflinePresentation
- createSelectiveDisclosure(credentialId, disclosedClaims): reveals only specified claims, replaces others with sha256 hash
Export: offlinePresentationEngine singleton

**4. apps/mobile/src/services/NotificationService.ts**
expo-notifications wrapper.
Schedule expiry reminders at 90/30/7 days before credential expiry.
sendImmediateAlert for sanction alerts.
Types: 'credential_expiring' | 'credential_expired' | 'sanction_alert' | 'license_renewal' | 'trust_state_updated'
Export: notificationService singleton

**5. apps/mobile/src/services/OID4VPHandler.ts**
Parses openid4vp:// URIs. Selects credentials matching input_descriptors. Creates offline presentation. POSTs to response_uri if network available.
Interface: OID4VPPresentationRequest { client_id, response_type, nonce, response_uri, presentation_definition }
Export: oid4vpHandler singleton

**6. Four app screens (Expo Router):**
- apps/mobile/app/_layout.tsx — dark theme #080e1a, tab navigator (Wallet/Present/Scan/Settings)
- apps/mobile/app/(tabs)/wallet.tsx — lists StoredCredentials, type/status/expiry badges, pull-to-refresh sync
- apps/mobile/app/(tabs)/present.tsx — select credentials → configure disclosure → biometric gate → show VP QR code
- apps/mobile/app/(tabs)/scan.tsx — camera (expo-barcode-scanner) → parse OID4VP → select creds → biometric → respond
- apps/mobile/app/(tabs)/settings.tsx — NPI input, sync button, DID display, clear wallet

**7. apps/mobile/src/services/WalletSyncService.ts**
sync(npi): fetches from VitalCV API → syncs to local store → schedules notifications.
isApiReachable(): HEAD check with 3s timeout.

**8. Add localMode to packages/wallet-sdk/src/index.ts**
Add localMode?: boolean to VitalCVWalletConfig.
Add createOfflinePresentation(credentialIds, nonce?): throws VitalCVWalletError('LOCAL_MODE_REQUIRED') if localMode false.

**9. 9 tests across 3 test files:**
LocalCredentialStore: storeCredential+list round-trip, getExpiringCredentials, syncFromApi
OfflinePresentationEngine: createPresentation JWT structure, selective disclosure omits non-disclosed, works without network
OID4VPHandler: parseRequest handles openid4vp:// URI, selectCredentials matches by type

### FINAL STEPS
1. pnpm --filter @vitalcv/wallet-sdk build — must pass
2. git add -A && git commit -m "feat(wave-wallet): clinician credential wallet — Expo app, offline VP, OID4VP scanner, push notifications, LocalCredentialStore"
3. openclaw system event --text "Done: Mobile wallet complete — Expo app, offline VP generation, OID4VP QR scanner, push notifications" --mode now
