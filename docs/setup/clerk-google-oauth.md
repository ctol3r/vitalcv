# Clerk + Google OAuth Setup

This guide covers the production configuration for Clerk authentication and Google OAuth on VitalCV.

---

## Prerequisites

- A Clerk application in production mode (not dev mode)
- A Google Cloud project with OAuth 2.0 credentials
- Vercel project with environment variables access

---

## 1. Clerk dashboard — production instance

1. Log in to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Confirm you are on the **Production** instance (top-left dropdown)
3. Navigate to **Configure → Email, Phone, Username**
   - Enable **Email address** as an identifier
   - Enable **Email magic links** (or **Email code**) under Email verification
4. Navigate to **Configure → Restrictions**
   - Under **Sign-up mode**: set to **Public** unless you want invite-only
   - Leave **Allowlist** empty (VitalCV enforces domain restrictions in `signupGate.ts`)

---

## 2. Google OAuth credentials

### Create OAuth 2.0 client in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `VitalCV Production`
5. Add **Authorized redirect URIs**:
   - `https://<your-clerk-frontend-api>.clerk.accounts.dev/v1/oauth_callback`
   - `https://accounts.<your-production-domain>.com/v1/oauth_callback`
   - Your Clerk frontend API URL is visible in Clerk dashboard under **API Keys**
6. Click **Create** and copy the **Client ID** and **Client Secret**

---

## 3. Wire Google OAuth into Clerk

1. In Clerk dashboard: **Configure → Social connections → Google**
2. Toggle **Enable for sign-in and sign-up**
3. Select **Use custom credentials**
4. Paste the **Client ID** and **Client Secret** from step 2
5. Click **Apply changes**

---

## 4. Environment variables

Set these in Vercel: **Settings → Environment Variables → Production**

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_live_`) | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (starts with `sk_live_`) | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Yes |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Role landing (e.g. `/clinician/profile`) | Yes |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` or role landing | Yes |
| `GOOGLE_OAUTH_CONFIGURED` | Set to `true` after Google OAuth is verified | Optional |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domain allowlist, e.g. `hospital.org,clinic.com` | Optional |

> **Note:** `ALLOWED_EMAIL_DOMAINS` defaults to empty (no restriction). Set it only when you want to limit signups to specific organizations. An empty value is the safe default — it prevents accidental lockout.

---

## 5. Domain allowlist (optional)

If you want to restrict signups to specific email domains:

```bash
# Allow only hospital.org and clinic.com signups
ALLOWED_EMAIL_DOMAINS=hospital.org,clinic.com
```

- Domains are case-insensitive
- Commas separate multiple domains
- Empty = open to all (default)
- The error message shown to rejected users does not reveal the domain list (no enumeration)

---

## 6. Magic-link recovery

The `/api/auth/recovery` endpoint provides timing-safe email recovery:

- POST `{ "email": "user@example.com" }`
- Always returns 200 with a generic message (prevents email enumeration)
- When `CLERK_SECRET_KEY` is set, creates a Clerk sign-in token for existing accounts
- To deliver the magic link via email, configure a transactional email provider (SendGrid, Resend, Postmark) and call your provider's API with the token URL:
  ```
  https://<your-domain>/sign-in?__clerk_ticket=<token>
  ```

---

## 7. Verify Google OAuth in production

After completing the setup:

1. Open a private/incognito browser window
2. Navigate to `https://<your-domain>/sign-in`
3. Click **Continue with Google**
4. Complete the Google consent flow
5. Confirm you land on the correct role page

If the Google button does not appear, check:
- `GOOGLE_OAUTH_CONFIGURED=true` is set in Vercel
- Clerk dashboard has Google OAuth enabled with custom credentials
- Redirect URIs in Google Cloud Console match the Clerk frontend API URL exactly

---

## 8. Clerk webhook for post-signup events (optional)

To enforce domain restrictions at the Clerk level (not just advisory UI):

1. In Clerk dashboard: **Configure → Webhooks → Add endpoint**
2. Endpoint URL: `https://<your-domain>/api/webhooks/clerk`
3. Subscribe to: `user.created`
4. In the webhook handler, call `clerk.users.deleteUser(userId)` if the domain is blocked
5. Set `CLERK_WEBHOOK_SECRET` in Vercel from the webhook signing secret

This is the production-grade enforcement path. The `signupGate.ts` module provides the `checkEmailDomain()` function used by the webhook handler.
