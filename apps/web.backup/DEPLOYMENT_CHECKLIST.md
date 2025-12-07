# Deployment Checklist

Complete this checklist before deploying the Governance & Audit features to production.

## 📋 Pre-Deployment Checklist

### ✅ **1. Installation & Setup**

- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)

### ✅ **2. API Integration**

- [ ] All API endpoints implemented in backend
- [ ] API authentication working
- [ ] CORS configured correctly
- [ ] Rate limiting enabled for sensitive endpoints
- [ ] API error handling tested

**Required Endpoints:**
- [ ] `GET /api/org/security/status`
- [ ] `GET /api/org/roles`
- [ ] `GET /api/org/roles/{roleId}`
- [ ] `PATCH /api/org/roles/{roleId}`
- [ ] `GET /api/org/permissions`
- [ ] `GET /api/org/members`
- [ ] `PUT /api/org/members/{memberId}/roles`
- [ ] `GET /api/org/{orgId}/policies/latest`
- [ ] `POST /api/org/{orgId}/policies/{policyId}/accept`
- [ ] `GET /api/org/audit/access-logs`
- [ ] `POST /api/org/audit/export`

### ✅ **3. Authentication & Authorization**

- [ ] Authentication middleware implemented
- [ ] JWT token validation working
- [ ] Role-based access control (RBAC) configured
- [ ] OrgAdmin role properly restricted
- [ ] Session management tested
- [ ] Token refresh mechanism working

### ✅ **4. Database & Data**

- [ ] Database schema includes required tables:
  - [ ] Roles table
  - [ ] Permissions table
  - [ ] Role_Permissions junction table
  - [ ] User_Roles junction table
  - [ ] Policies table
  - [ ] Policy_Acceptances table
  - [ ] Audit_Logs table
- [ ] Indexes created for performance
- [ ] Data migration scripts ready
- [ ] Seed data for default roles created

### ✅ **5. Security**

- [ ] HTTPS enabled
- [ ] Content Security Policy (CSP) configured
- [ ] XSS protection enabled
- [ ] CSRF protection implemented
- [ ] SQL injection prevention verified
- [ ] Rate limiting configured
- [ ] Input validation on all forms
- [ ] Sensitive data encrypted at rest
- [ ] PHI handling compliance verified (HIPAA)

### ✅ **6. Environment Variables**

```bash
# Create .env.production with:
- [ ] NEXT_PUBLIC_API_BASE_URL
- [ ] BACKEND_API_URL
- [ ] AUTH_SECRET
- [ ] DATABASE_URL
- [ ] ENABLE_AUDIT_EXPORT
- [ ] ENABLE_POLICY_MANAGEMENT
- [ ] LOG_LEVEL
```

### ✅ **7. Testing**

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests for critical flows:
  - [ ] Login → View Dashboard
  - [ ] Assign role to member
  - [ ] Edit role permissions
  - [ ] Export audit logs
  - [ ] Accept policy
- [ ] Accessibility tests (axe-core)
- [ ] Performance tests (Lighthouse score > 90)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness verified

### ✅ **8. Compliance & Audit**

- [ ] HIPAA compliance verified for PHI handling
- [ ] Audit logging enabled for all sensitive actions
- [ ] Data retention policies configured
- [ ] Audit log retention: minimum 7 years
- [ ] Incident response plan documented
- [ ] Breach notification procedures in place

### ✅ **9. Documentation**

- [ ] API documentation updated
- [ ] User guide created for OrgAdmins
- [ ] Technical documentation complete
- [ ] Changelog updated
- [ ] Known issues documented
- [ ] Support contact information provided

### ✅ **10. Performance**

- [ ] Database queries optimized
- [ ] API response times < 200ms
- [ ] Large tables paginated
- [ ] Caching strategy implemented
- [ ] CDN configured for static assets
- [ ] Image optimization enabled
- [ ] Bundle size optimized (< 500KB initial load)

### ✅ **11. Monitoring & Logging**

- [ ] Error tracking configured (Sentry/similar)
- [ ] Application performance monitoring (APM) enabled
- [ ] Log aggregation setup (CloudWatch/DataDog/etc)
- [ ] Uptime monitoring configured
- [ ] Alert rules created for:
  - [ ] API errors > 1%
  - [ ] Response time > 500ms
  - [ ] Failed login attempts > 10/min
  - [ ] Unauthorized access attempts

### ✅ **12. Backup & Recovery**

- [ ] Database backup automated (daily)
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented
- [ ] Point-in-time recovery available
- [ ] Backup retention policy: 30 days

---

## 🚀 Deployment Steps

### Step 1: Pre-Production Testing

```bash
# 1. Switch to staging environment
export NODE_ENV=staging

# 2. Run full test suite
npm run test:all

# 3. Build production bundle
npm run build

# 4. Test production build locally
npm start

# 5. Verify all features work
```

### Step 2: Database Migration

```bash
# 1. Backup production database
pg_dump -h prod-db.example.com -U admin -d chai_vc > backup_$(date +%Y%m%d).sql

# 2. Run migrations
npm run migrate:prod

# 3. Verify schema
npm run db:verify
```

### Step 3: Deploy Application

#### Option A: Vercel Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy to staging
vercel

# 3. Test staging deployment
# Visit: https://staging-deployment-url.vercel.app

# 4. Deploy to production
vercel --prod
```

#### Option B: Docker Deployment

```bash
# 1. Build Docker image
docker build -t chai-vc-web:latest .

# 2. Tag for registry
docker tag chai-vc-web:latest registry.example.com/chai-vc-web:latest

# 3. Push to registry
docker push registry.example.com/chai-vc-web:latest

# 4. Deploy to production
kubectl apply -f k8s/production.yaml
```

#### Option C: Traditional Server

```bash
# 1. SSH to production server
ssh user@prod-server.example.com

# 2. Pull latest code
cd /var/www/chai-vc-web
git pull origin main

# 3. Install dependencies
npm ci --only=production

# 4. Build application
npm run build

# 5. Restart service
pm2 restart chai-vc-web
```

### Step 4: Post-Deployment Verification

```bash
# 1. Health check
curl https://app.example.com/api/health

# 2. Test authentication
curl -H "Authorization: Bearer $TOKEN" https://app.example.com/api/org/roles

# 3. Monitor logs
tail -f /var/log/chai-vc-web/production.log

# 4. Check error rates
# Visit monitoring dashboard
```

### Step 5: Smoke Tests

- [ ] Load homepage
- [ ] Login as OrgAdmin
- [ ] Navigate to `/org/settings`
- [ ] View roles at `/org/settings/roles`
- [ ] Edit a role at `/org/settings/roles/{roleId}`
- [ ] View members at `/org/settings/members`
- [ ] Assign role to member
- [ ] View access logs at `/org/audit/accessLogs`
- [ ] Export audit logs at `/org/audit/export`
- [ ] Verify policy banner appears (if pending)

---

## 🔄 Rollback Plan

If issues are detected after deployment:

### Quick Rollback (Vercel)

```bash
# Revert to previous deployment
vercel rollback
```

### Docker Rollback

```bash
# 1. List previous image versions
docker images registry.example.com/chai-vc-web

# 2. Deploy previous version
kubectl set image deployment/chai-vc-web \
  chai-vc-web=registry.example.com/chai-vc-web:previous-tag

# 3. Verify rollback
kubectl rollout status deployment/chai-vc-web
```

### Traditional Server Rollback

```bash
# 1. Checkout previous commit
git checkout <previous-commit-hash>

# 2. Rebuild
npm run build

# 3. Restart
pm2 restart chai-vc-web
```

---

## 📊 Success Metrics

Monitor these metrics for 24-48 hours after deployment:

### Application Metrics
- [ ] Error rate < 0.1%
- [ ] Average response time < 200ms
- [ ] P95 response time < 500ms
- [ ] Successful login rate > 99%
- [ ] API success rate > 99.5%

### User Metrics
- [ ] No increase in support tickets
- [ ] User feedback collected
- [ ] Feature adoption tracked
- [ ] No accessibility complaints

### Security Metrics
- [ ] No security incidents
- [ ] Audit logs capturing all events
- [ ] Failed login attempts monitored
- [ ] Unauthorized access attempts = 0

---

## 🆘 Emergency Contacts

**On-Call Engineer:** [Name] - [Phone]
**DevOps Team:** [Email] - [Slack Channel]
**Security Team:** [Email] - [Phone]
**Product Manager:** [Name] - [Email]

---

## 📅 Post-Deployment Tasks

### Week 1
- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check performance metrics
- [ ] Verify audit logs are being captured
- [ ] Conduct user acceptance testing

### Week 2
- [ ] Review analytics data
- [ ] Optimize slow queries if any
- [ ] Address any minor bugs
- [ ] Update documentation based on feedback
- [ ] Plan next iteration

### Month 1
- [ ] Conduct security audit
- [ ] Review access logs for anomalies
- [ ] Analyze feature adoption
- [ ] Plan enhancements
- [ ] Document lessons learned

---

## ✅ Sign-Off

Deployment approved by:

- [ ] **Engineering Lead:** _____________ Date: _______
- [ ] **Product Manager:** _____________ Date: _______
- [ ] **Security Officer:** _____________ Date: _______
- [ ] **DevOps Lead:** _____________ Date: _______

---

**Deployment Date:** _______________
**Deployment Version:** _______________
**Deployed By:** _______________

---

**Ready to deploy? Let's ship it! 🚀**

