# VitalCV Load Testing

**Tagged:** `run: next-batch-20251031-2` | **Agent:** `CURSOR • AGENT`

Load testing suite for VitalCV widget and API using k6.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Quick Start

### Basic Load Test (500 concurrent users)

```bash
cd tests/load
k6 run widget-initiation.k6.js
```

### Custom Configuration

```bash
# Custom VU count and duration
k6 run --vus 1000 --duration 10m widget-initiation.k6.js

# With environment variables
BASE_URL=https://staging.vitalcv.com \
API_URL=https://api-staging.vitalcv.com \
k6 run widget-initiation.k6.js

# Save results to file
k6 run --out json=results/test-results.json widget-initiation.k6.js
```

## Test Scenarios

The k6 script includes multiple test scenarios:

### 1. Widget Load (Static Asset)
- **Target:** `/widget/vitalcv-apply.js`
- **Threshold:** P95 < 3000ms
- **Checks:**
  - HTTP 200 status
  - Valid JavaScript content

### 2. NPI Lookup
- **Target:** `/api/npi/lookup?npi=XXX`
- **Threshold:** P95 < 1000ms
- **Checks:**
  - HTTP 200 status
  - Valid NPI data returned

### 3. Email Verification (Level 1)
- **Target:** `/api/claim/basic`
- **Checks:**
  - OTP generated successfully
  - Email sent confirmation

### 4. OTP Verification
- **Target:** `/api/claim/verify-pin`
- **Checks:**
  - OTP validated
  - Claim created with level=1

### 5. Credential Issuance
- **Target:** `/api/issuer/attest-request`
- **Threshold:** P95 < 2000ms
- **Checks:**
  - Attestation request initiated

## Load Stages

The test follows this load profile:

```
VUs
│
1000 ┤                    ╭─────╮
     │                   ╱       ╲
 500 ┤         ╭────────╯         ╲
     │        ╱                     ╲
 100 ┤   ╭───╯                       ╲
     │  ╱                             ╲
  50 ┤ ╱                               ╲
     │╱                                 ╲____
   0 └┴─────┴─────┴─────┴─────┴─────┴─────┴───
     0    30s   1m    2m    3m    7m    8m   9m
```

1. **Ramp-up:** 0 → 500 users over 3 minutes
2. **Sustain:** Hold 500 users for 5 minutes
3. **Spike:** Spike to 1000 users for 1 minute
4. **Ramp-down:** 1000 → 0 over 1 minute

## Metrics & Thresholds

### HTTP Metrics
- `http_req_duration` (P95 < 2000ms): Request duration
- `http_req_failed` (< 5%): Failed request rate
- `http_reqs`: Total requests

### Custom Metrics
- `widget_load_time` (P90 < 3000ms): Widget JS load time
- `npi_lookup_time` (P95 < 1000ms): NPI API latency
- `credential_issue_time` (P95 < 2000ms): Credential issuance latency
- `widget_success_rate` (> 95%): Overall success rate
- `widget_init_errors`: Count of widget initialization errors

## Output Artifacts

After running, the script generates:

### 1. JSON Results
`results/widget-load-test-TIMESTAMP.json`

Full metrics data for programmatic analysis.

### 2. HTML Report
`results/widget-load-test-TIMESTAMP.html`

Visual dashboard with charts and graphs.

### 3. CSV Summary
`results/widget-load-test-TIMESTAMP.csv`

Importable into Excel/Sheets for quick analysis.

### Example HTML Report Preview

The HTML report includes:
- Request rate over time
- Response time percentiles
- Error rate trends
- VU ramping visualization
- Custom metric charts

## Analysis & Recommendations

### Reading Results

```bash
# View JSON summary
cat results/widget-load-test-*.json | jq '.metrics.http_req_duration'

# Open HTML report
open results/widget-load-test-*.html

# Import CSV to spreadsheet
# File → Import → results/widget-load-test-*.csv
```

### Interpreting Metrics

**✅ Healthy System:**
- P95 latency < 2s
- Success rate > 95%
- Error rate < 5%
- No timeouts

**⚠️ Warning Signs:**
- P95 latency > 2s but < 5s
- Success rate 90-95%
- Error rate 5-10%
- Occasional timeouts

**❌ Critical Issues:**
- P95 latency > 5s
- Success rate < 90%
- Error rate > 10%
- Frequent timeouts or 500 errors

### Common Bottlenecks

1. **High NPI lookup latency:**
   - Check NPPES API status
   - Verify Redis caching enabled
   - Consider batch prefetching

2. **Widget load slowness:**
   - Enable CDN caching
   - Check asset compression (gzip/brotli)
   - Verify cache-control headers

3. **Database timeouts:**
   - Check connection pool size
   - Monitor query performance
   - Add indexes if needed

4. **High error rate:**
   - Check backend logs
   - Verify rate limiting thresholds
   - Monitor resource usage (CPU/memory)

## Advanced Usage

### Running with Docker

```bash
docker run --rm -i \
  -v $PWD:/tests \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e API_URL=http://host.docker.internal:4000 \
  grafana/k6 run /tests/widget-initiation.k6.js
```

### CI/CD Integration

```yaml
# .github/workflows/load-test.yml
- name: Run k6 load test
  run: |
    k6 run --quiet \
      --out json=results.json \
      tests/load/widget-initiation.k6.js

- name: Upload results
  uses: actions/upload-artifact@v3
  with:
    name: k6-results
    path: results/
```

### Grafana Integration

Stream results to Grafana Cloud:

```bash
K6_CLOUD_TOKEN=xxx k6 run --out cloud widget-initiation.k6.js
```

Or export to InfluxDB:

```bash
k6 run --out influxdb=http://localhost:8086/k6 widget-initiation.k6.js
```

## Load Test Scenarios

### Smoke Test (Quick Sanity Check)

```bash
k6 run --vus 10 --duration 1m widget-initiation.k6.js
```

### Average Load

```bash
k6 run --vus 100 --duration 5m widget-initiation.k6.js
```

### Stress Test

```bash
k6 run --vus 500 --duration 10m widget-initiation.k6.js
```

### Spike Test (Burst Traffic)

```bash
k6 run --stage 30s:100 --stage 10s:1000 --stage 30s:100 widget-initiation.k6.js
```

### Soak Test (Long Duration)

```bash
k6 run --vus 200 --duration 1h widget-initiation.k6.js
```

## Troubleshooting

### k6 Not Found

```bash
# Install k6
brew install k6  # macOS
# or follow installation guide above
```

### Connection Refused

```bash
# Ensure backend and frontend are running
curl http://localhost:4000/health
curl http://localhost:3000
```

### Out of Memory

```bash
# Reduce VU count or use --no-connection-reuse flag
k6 run --vus 100 --no-connection-reuse widget-initiation.k6.js
```

### Results Not Generated

```bash
# Ensure results/ directory exists
mkdir -p results/
k6 run widget-initiation.k6.js
```

## References

- **k6 Documentation:** https://k6.io/docs/
- **Best Practices:** https://k6.io/docs/testing-guides/
- **Metrics Reference:** https://k6.io/docs/using-k6/metrics/

## Next Steps

1. Establish baseline metrics (run smoke test)
2. Set up automated load testing in CI/CD
3. Create Grafana dashboards for visualization
4. Define SLA thresholds based on results
5. Schedule weekly stress tests

