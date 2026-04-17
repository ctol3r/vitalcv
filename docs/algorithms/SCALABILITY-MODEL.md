# VitalCV Scalability & Load Model

## Load Simulation Target
- **100 concurrent NPIs** being processed simultaneously
- **10 Organizations** actively querying and running validations
- **Multiple semantic drift events** firing asynchronously via `liveValidation`

## Bottleneck Identification

Tracing the Omega execution path (`vcvOmega.ts` + `liveValidation.ts`) reveals the following bottlenecks:

1. **Ingestion Latency (Network I/O Bound)**
   - *Current State*: Adapters (NPPES, OIG, PECOS) run synchronously. Hitting 3 APIs sequentially takes ~1.5s - 3s per NPI.
   - *Scale Impact*: 100 concurrent NPIs could trigger 300 sequential API calls, bottlenecking connection pools and failing upstream rate limits.

2. **Receipt Generation (CPU Bound)**
   - *Current State*: `generateReceipt` uses SHA-256 and canonical sorting on potentially large JSON payloads synchronously.
   - *Scale Impact*: Can block the Node.js event loop under heavy concurrent load.

3. **Manifest Build Time (Compute/Memory Bound)**
   - *Current State*: `buildManifest` maps coverage, receipts, and claims into a large JSON tree.
   - *Scale Impact*: Minor impact individually, but 100 concurrent builds will spike heap memory.

4. **Decision Trace Storage (DB I/O Bound)**
   - *Current State*: `storeDecisionTrace()` and `recordDecisionOutcome()` are awaited at the end of the `vcvOmega` execution path.
   - *Scale Impact*: Delays the final API response to the Employer UI by forcing the client to wait for a database `INSERT`.

## Parallelization Plan

To survive real-world scale, the system must enforce strict concurrency rules:

1. **Concurrent Ingestion**
   - Source adapters *must* use `Promise.allSettled()` to fetch NPPES, OIG, and State Board data simultaneously instead of awaiting each sequentially.
   - Example:
     ```typescript
     const [nppes, oig, pecos] = await Promise.allSettled([
       NppesAdapter.fetch(npi),
       OigAdapter.fetch(npi),
       PecosAdapter.fetch(npi)
     ]);
     ```

2. **Async / Non-Blocking Trace Storage**
   - The Decision Trace and Audit Events must be fired asynchronously without `await` blocking the main thread returning the payload to the employer.
   - Example: `storeDecisionTrace(trace).catch(console.error); // fire and forget`

3. **Batched Drift Propagation**
   - If a massive drift event occurs (e.g., a state board updates 500 licenses at once), `propagateDriftResponse()` must push invalidations to a background queue (e.g., Redis/RabbitMQ) rather than executing 500 immediate `Prisma.updateMany` operations that would lock the database.

4. **Receipt Generation Offloading**
   - For payloads over 500KB, cryptographic hashing should be moved to a Worker Thread to avoid blocking the main Node.js event loop.
