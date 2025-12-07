# B248B Partnership Engagement - Quick Start

## 🚀 Quick Setup

### 1. Database Migration

```bash
cd backend
npx prisma migrate dev --name add_partnership_engagement_models
npx prisma generate
```

### 2. Verify Integration

The API is already integrated at `/api/partners`. Test with:

```bash
# Health check
curl http://localhost:4000/api/health

# List opportunities (requires auth header)
curl -H "x-user-id: your-user-id" http://localhost:4000/api/partners/opportunities
```

## 📋 API Quick Reference

### Create Opportunity

```bash
curl -X POST http://localhost:4000/api/partners/opportunities \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{
    "partnerId": "partner-456",
    "title": "New Partnership",
    "description": "Partnership description",
    "status": "new",
    "potentialValue": 100000
  }'
```

### List Opportunities

```bash
curl "http://localhost:4000/api/partners/opportunities?partnerId=partner-456&status=new" \
  -H "x-user-id: user-123"
```

### Get Metrics

```bash
curl "http://localhost:4000/api/partners/metrics?partnerId=partner-456" \
  -H "x-user-id: user-123"
```

## 🔑 Required Headers

All endpoints require:
- `x-user-id`: User ID for authentication

## 🎭 Roles

- `partnerUser` - Basic partner access
- `partnerAdmin` - Partner admin access
- `partnerManager` - Internal manager (full access)

## 📊 Status Values

### Opportunities
- `new`
- `in_progress`
- `won`
- `lost`

### Proposals
- `draft`
- `submitted`
- `accepted`
- `rejected`

### Campaigns
- `draft`
- `active`
- `completed`

### Tasks
- `open`
- `in_progress`
- `blocked`
- `done`

## 🔔 Events

The system automatically emits events for:
- Opportunity creation/status changes
- Proposal submissions/decisions
- Campaign starts
- Task creation/status changes

These trigger notifications via `PartnerEngagementService`.

## 📝 Next Steps

1. Run migration when database is available
2. Configure partner webhooks in `PartnerConfig`
3. Set up CRM integration (SalesHub placeholder in `opportunityService.ts`)
4. Test with your authentication system

