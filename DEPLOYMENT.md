# VitalCV Production Deployment Guide

## Frontend Quick Start

For frontend developers getting started with VitalCV:

### Local Development (No Docker)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Generate cryptographic keys (required)
node -e "
const crypto = require('crypto');
const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
console.log('ISSUER_PRIVATE_KEY=' + Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));
console.log('ISSUER_PUBLIC_KEY=' + Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'));
"

# 4. Add the keys to .env.local
# Also set: NODE_ENV=development, ENABLE_REDIS=false

# 5. Start development server
npm run dev

# 6. Open http://localhost:3000
```

### Development Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build production bundle
npm run start            # Start production server
npm test                 # Run tests
npm run lint             # Check code style
npm run storybook        # Start Storybook component dev
```

### Key Pages

- **Home**: http://localhost:3000
- **Verify Credentials**: http://localhost:3000/verify
- **Generate Offer**: http://localhost:3000/issuer/offer
- **API Documentation**: http://localhost:3000/api-docs
- **System Health**: http://localhost:3000/health
- **Storybook**: http://localhost:6006 (run `npm run storybook`)

### Environment Variables (Development)

```env
# Minimal config for frontend development
NODE_ENV=development
NEXT_PUBLIC_ISSUER_URL=http://localhost:3000
ENABLE_REDIS=false
LOG_LEVEL=debug

# Add generated keys here
ISSUER_PRIVATE_KEY=<base64-pem>
ISSUER_PUBLIC_KEY=<base64-pem>
```

### Common Issues

**Port already in use**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Missing keys error**:
- Ensure ISSUER_PRIVATE_KEY and ISSUER_PUBLIC_KEY are set in .env.local
- Keys must be base64-encoded PEM format
- Generate new keys using script above

**TypeScript errors**:
```bash
npm run typecheck        # Check types
rm -rf .next && npm run dev  # Clear cache and rebuild
```

### Next Steps

- See [CONTRIBUTING.md](./CONTRIBUTING.md) for full development guide
- See [INCIDENTS.md](./INCIDENTS.md) for audit log debugging
- See production deployment section below for Docker setup

---

## Production Deployment

## Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- Node.js 20+ (for local development)
- Redis 7+ (managed or via Docker)
- HTTPS certificate for production

## Quick Start (Docker)

### 1. Configure Environment

```bash
# Copy the production environment template
cp .env.production.template .env.production

# Generate cryptographic keys
node -e "
const crypto = require('crypto');
const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
console.log('ISSUER_PRIVATE_KEY=' + Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));
console.log('ISSUER_PUBLIC_KEY=' + Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'));
"

# Edit .env.production with your keys and configuration
nano .env.production
```

### 2. Build and Run

```bash
# Build the Docker image
docker-compose build

# Start all services (app + Redis)
docker-compose up -d

# Check logs
docker-compose logs -f app

# Check health
curl http://localhost:3000/api/health
```

### 3. Verify Deployment

```bash
# Test JWKS endpoint
curl http://localhost:3000/.well-known/jwks.json

# Test issuer metadata
curl http://localhost:3000/.well-known/openid-credential-issuer

# Test Redis health
curl http://localhost:3000/api/health/redis
```

## Production Configuration

### Required Environment Variables

```env
NODE_ENV=production
NEXT_PUBLIC_ISSUER_URL=https://vitalcv.com
REDIS_URL=redis://redis:6379
ISSUER_PRIVATE_KEY=<base64-encoded-pem>
ISSUER_PUBLIC_KEY=<base64-encoded-pem>
```

### Optional Configuration

```env
LOG_LEVEL=info                    # debug|info|warn|error|critical
ENABLE_REDIS=true                 # Use Redis for distributed storage
ENABLE_STATUS_LIST=false          # Enable StatusList2021 revocation
PORT=3000                         # Application port
```

## Docker Compose Services

### App Service
- **Image**: Built from Dockerfile (multi-stage)
- **Port**: 3000
- **Health Check**: `/api/health` endpoint
- **Restart Policy**: unless-stopped
- **Logging**: JSON with 10MB rotation

### Redis Service
- **Image**: redis:7-alpine
- **Port**: 6379
- **Persistence**: AOF (append-only file)
- **Max Memory**: 256MB with LRU eviction
- **Health Check**: `redis-cli ping`

### Redis Commander (Debug Profile)
- **Port**: 8081
- **Usage**: `docker-compose --profile debug up`
- **Purpose**: Web UI for Redis debugging

## Production Best Practices

### 1. Secrets Management

**Never commit secrets to version control!**

```bash
# Use Docker secrets
docker secret create issuer_private_key ./issuer_private_key.pem
docker secret create issuer_public_key ./issuer_public_key.pem

# Or use environment-specific .env files
# .env.production  (production)
# .env.staging     (staging)
# .env.local       (local development)
```

### 2. HTTPS/TLS

Use a reverse proxy (Nginx, Caddy, or cloud load balancer):

```nginx
# nginx.conf example
server {
    listen 443 ssl http2;
    server_name vitalcv.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Monitoring & Logging

```bash
# View application logs
docker-compose logs -f app

# View Redis logs
docker-compose logs -f redis

# Export logs to CloudWatch/DataDog
# Configure in .env.production:
# CLOUDWATCH_LOG_GROUP=/aws/ecs/vitalcv
# DATADOG_API_KEY=your-api-key
```

### 4. Backup & Recovery

```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE
docker cp vitalcv-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb

# Restore Redis data
docker cp ./backups/redis-20250101.rdb vitalcv-redis:/data/dump.rdb
docker-compose restart redis
```

### 5. Scaling

```bash
# Scale app instances (requires load balancer)
docker-compose up -d --scale app=3

# Use Redis for shared state across instances
ENABLE_REDIS=true
```

## Health Checks

### Application Health
```bash
curl http://localhost:3000/api/health
# Response: {"status":"healthy","timestamp":"..."}
```

### Redis Health
```bash
curl http://localhost:3000/api/health/redis
# Response: {"status":"healthy","redis_enabled":true,"timestamp":"..."}
```

### Container Health
```bash
docker-compose ps
# All services should show "healthy" status
```

## Troubleshooting

### App won't start
```bash
# Check logs
docker-compose logs app

# Common issues:
# - Missing environment variables
# - Redis connection failed
# - Port already in use
```

### Redis connection errors
```bash
# Test Redis connectivity
docker-compose exec redis redis-cli ping
# Should return: PONG

# Check Redis logs
docker-compose logs redis
```

### Performance issues
```bash
# Check resource usage
docker stats

# Increase Redis memory
# Edit docker-compose.yml: --maxmemory 512mb

# Enable Redis persistence
# Already enabled with AOF in docker-compose.yml
```

## Updating

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose up -d

# Zero-downtime update (requires load balancer)
docker-compose up -d --no-deps --build app
```

## Security Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Environment variables secured (not in git)
- [ ] Redis password set (if exposed externally)
- [ ] Rate limiting configured
- [ ] Audit logging enabled (LOG_LEVEL=info)
- [ ] Container runs as non-root user
- [ ] Firewall configured (ports 3000, 6379)
- [ ] Regular security updates applied

## Support

For issues, consult:
- Application logs: `docker-compose logs -f app`
- Audit logs: Structured JSON in stdout
- Health endpoints: `/api/health`, `/api/health/redis`
- GitHub Issues: https://github.com/your-org/vitalcv/issues
