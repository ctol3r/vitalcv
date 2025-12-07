# Round 8 - Environment Variables

## Backend (`chai-vc-platform/backend`)

Add these to your `.env` file or environment:

```bash
# JWT Authentication (RS256 Public Key)
# Replace with your actual RSA public key
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"

# Node Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vitalcv

# LinkedIn OAuth (if using)
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://your-domain.com/auth/linkedin/callback
```

### Generating JWT Keys

For development/testing, generate RS256 key pair:

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -outform PEM -pubout -out public.pem

# Format for environment variable (remove newlines)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

## Frontend (`v0-vital-cv-frontend-mvp`)

Create `.env.local` file with:

```bash
# Agent API Base URL
NEXT_PUBLIC_AGENT_BASE=http://localhost:4000/api/agent
# Or for production:
# NEXT_PUBLIC_AGENT_BASE=https://api.yourdomain.com/api/agent

# Feature Flags
NEXT_PUBLIC_FF_SDJWT=1
NEXT_PUBLIC_FF_BBS=0
NEXT_PUBLIC_FF_AUDIT=1
```

### Feature Flags

- `NEXT_PUBLIC_FF_SDJWT`: Enable SD-JWT (Selective Disclosure JWT) features
- `NEXT_PUBLIC_FF_BBS`: Enable BBS+ signature features
- `NEXT_PUBLIC_FF_AUDIT`: Enable audit logging UI

Set to `1` to enable, `0` to disable.

## JWT Token for Testing

For testing authenticated endpoints in the frontend:

1. Generate a test JWT token using your private key
2. Open browser console
3. Run: `localStorage.setItem('vitalcv_jwt', 'your_token_here')`
4. The frontend will automatically include this token in requests

**Security Note**: This localStorage approach is for pilot/testing only. Production should use:
- HttpOnly cookies
- Proper session management (NextAuth.js, Auth0, etc.)
- Secure token refresh flows

## Verification

After setting environment variables:

### Backend
```bash
cd backend
npm run dev
# Should start without JWT_PUBLIC_KEY errors if key is set
```

### Frontend
```bash
cd v0-vital-cv-frontend-mvp
npm run dev
# Visit http://localhost:3000/agent
# Feature flags should be active
```

### Test Auth Flow
1. Call a sensitive agent endpoint without token → Should get 401
2. Add JWT token to localStorage
3. Retry → Should succeed (if token is valid)

## Production Checklist

- [ ] Use real secrets manager (AWS Secrets Manager, Vault)
- [ ] Never commit `.env` files
- [ ] Rotate JWT keys quarterly
- [ ] Use separate keys per environment
- [ ] Enable HTTPS only
- [ ] Implement token refresh logic
- [ ] Add rate limiting per tenant
- [ ] Monitor failed auth attempts

