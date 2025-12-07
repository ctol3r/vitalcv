# Demo Day Runbook

## Critical Failures & Recovery Procedures

### Service Outages

#### Backend API Unavailable
- **Symptom**: Frontend shows connection errors, API calls fail
- **Recovery**:
  1. Check backend logs: `docker-compose logs backend`
  2. Restart backend service: `docker-compose restart backend`
  3. Verify health endpoint: `curl http://localhost:3000/health`
  4. If persists, check database connectivity and Redis

#### Database Connection Issues
- **Symptom**: Prisma errors, data not persisting
- **Recovery**:
  1. Check PostgreSQL: `docker-compose ps postgres`
  2. Restart database: `docker-compose restart postgres`
  3. Run migrations: `cd backend && npx prisma migrate deploy`
  4. Verify connection: `docker-compose exec postgres psql -U postgres -d chai_vc`

#### Redis Cache Failure
- **Symptom**: NPI lookups slow, cache misses
- **Recovery**:
  1. Check Redis: `docker-compose ps redis`
  2. Restart Redis: `docker-compose restart redis`
  3. Verify: `docker-compose exec redis redis-cli ping`
  4. Note: System will continue without cache, just slower

### Frontend Issues

#### Build/Compile Errors
- **Symptom**: Frontend fails to load, blank page
- **Recovery**:
  1. Check Next.js build: `cd frontend && npm run build`
  2. Clear `.next` cache: `rm -rf frontend/.next`
  3. Rebuild: `npm run build`
  4. Restart dev server: `npm run dev`

#### API Endpoint Not Found (404)
- **Symptom**: Frontend calls fail with 404
- **Recovery**:
  1. Verify route mounting in `backend/src/app.ts`
  2. Check route file exports
  3. Restart backend to reload routes
  4. Verify CORS configuration

### Data Issues

#### NPI Lookup Failures
- **Symptom**: NPI validation fails, provider not found
- **Recovery**:
  1. Check NPPES API status (external service)
  2. Verify API key in environment variables
  3. Check rate limiting
  4. Use fallback validation (format check only)

#### Claim Status Not Updating
- **Symptom**: Status stuck, no progression
- **Recovery**:
  1. Check in-memory stores (pilot mode)
  2. Verify job queue if using workers
  3. Manually trigger status update via API
  4. Check audit logs for errors

### Performance Issues

#### Slow Response Times
- **Symptom**: API calls taking >5 seconds
- **Recovery**:
  1. Check Prometheus metrics: `curl http://localhost:3000/metrics`
  2. Identify bottleneck (DB, Redis, external API)
  3. Check server resources: `docker stats`
  4. Restart affected service

#### High Memory Usage
- **Symptom**: Services crash, OOM errors
- **Recovery**:
  1. Check memory: `docker stats`
  2. Restart services to clear memory
  3. Increase Docker memory limits
  4. Check for memory leaks in logs

### Quick Recovery Commands

```bash
# Full system restart
docker-compose down && docker-compose up -d

# Backend only
docker-compose restart backend

# View logs
docker-compose logs -f backend frontend

# Health check
curl http://localhost:3000/health
curl http://localhost:3001/_next/health  # Frontend if configured

# Database reset (CAUTION: loses data)
cd backend && npx prisma migrate reset
```

### Emergency Contacts

- **DevOps Lead**: [Contact]
- **Backend Lead**: [Contact]
- **Frontend Lead**: [Contact]

### Pre-Demo Checklist

- [ ] All services running: `docker-compose ps`
- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] Test NPI lookup with known NPI
- [ ] Test claim upload flow end-to-end
- [ ] Verify metrics endpoint accessible
- [ ] Check logs for errors: `docker-compose logs --tail=100`
- [ ] Backup database before demo

### Post-Demo Actions

- [ ] Review logs for errors
- [ ] Check metrics for performance issues
- [ ] Document any issues encountered
- [ ] Update runbook with lessons learned
