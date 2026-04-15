import { generateOmegaDecision } from '../../../apps/api/backend/src/services/orchestrator/vcvOmega';
import { runLiveValidation } from '../../../apps/api/backend/src/services/validation/liveValidation';

async function runLoadSimulation() {
  console.log('Running Omega Load Simulation...');
  
  const CONCURRENT_REQUESTS = 100;
  const ORG_COUNT = 10;
  
  // Create a pool of 10 mock organizations
  const orgs = Array.from({ length: ORG_COUNT }, (_, i) => `org_mock_${i}`);
  
  // Base NPIs to cycle through (the same 5 we used for live validation)
  const baseNpis = ['1487664858', '1013926868', '1992790938', '1003000014', '1114000018'];
  
  const requests = [];
  const start = Date.now();

  let driftFired = false;
  let successCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    // Round-robin NPIs and Orgs
    const npi = baseNpis[i % baseNpis.length];
    const org = orgs[i % orgs.length];

    // Every 5th request, we inject a background drift validation run concurrently
    if (i % 5 === 0 && !driftFired) {
      requests.push(
        runLiveValidation().then(() => {
          // background drift completed
        }).catch(() => {})
      );
    }

    const reqStart = Date.now();
    const req = generateOmegaDecision(npi, org)
      .then((res) => {
        const latency = Date.now() - reqStart;
        latencies.push(latency);
        successCount++;
        // If the system successfully downgraded a missing/stale source, it will show here
        return res;
      })
      .catch((err) => {
        errorCount++;
        console.error(`Request Failed for ${npi}:`, err.message);
      });

    requests.push(req);
  }

  await Promise.allSettled(requests);
  const totalTime = Date.now() - start;

  // Calculate p50, p95, p99
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`\n── LOAD TEST RESULTS ──────────────────────────────`);
  console.log(`Total Requests: ${CONCURRENT_REQUESTS} Omega + ${CONCURRENT_REQUESTS / 5} Drift Checks`);
  console.log(`Success Rate: ${successCount} / ${CONCURRENT_REQUESTS}`);
  console.log(`Error Rate: ${errorCount} / ${CONCURRENT_REQUESTS}`);
  console.log(`Total Execution Time: ${totalTime}ms`);
  console.log(`Latencies: p50 = ${p50}ms | p95 = ${p95}ms | p99 = ${p99}ms`);
}

runLoadSimulation().catch(console.error);
