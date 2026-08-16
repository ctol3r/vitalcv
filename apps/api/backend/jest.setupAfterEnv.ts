// Close every PrismaClient a suite constructed once the suite ends.
//
// maxWorkers=1 runs all ~350 suites in ONE worker process, but each suite gets
// a fresh module registry, so every db-touching suite constructs brand-new
// PrismaClient instances (src/graphql/prisma_client.ts plus ~25 other
// module-level `new PrismaClient()` sites, plus per-test-file clients) and
// almost none of them ever $disconnect()s. Open connections therefore
// accumulate for the life of the worker until Postgres's max_connections
// budget (100 on the harness instance scripts/backend-test-db.sh starts) is
// exhausted, and the next suite that needs several concurrent fresh
// connections dies with "FATAL: sorry, too many clients already".
//
// Which suite pays depends on jest's timing cache: @jest/test-sequencer sorts
// suites WITH cached timings to the END of the run, so a prior targeted run of
// a heavy db suite (routine for agents) pushes it behind ~340 accumulating
// suites and the full sweep goes red for reasons unrelated to the code under
// test, while a fresh cache (file-size order, CI) stays green.
//
// The constructor is the one choke point every construction site shares, so
// wrap it here — this file runs before the test file loads — and disconnect
// all tracked instances when the suite ends. The afterAll registered here runs
// AFTER the suite's own afterAll hooks (jest-circus runs afterAll hooks in
// reverse registration order), so suite cleanup that still needs the database
// is unaffected; and a client used again after $disconnect() reconnects
// lazily, so a late straggler query cannot break a suite either.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
const prismaClientModule = require('@prisma/client');

type DisconnectableClient = { $disconnect: () => Promise<void> };

const constructedClients = new Set<DisconnectableClient>();

prismaClientModule.PrismaClient = new Proxy(prismaClientModule.PrismaClient, {
  construct(target: any, args: any[], newTarget: any): object {
    const instance = Reflect.construct(target, args, newTarget) as object;
    constructedClients.add(instance as DisconnectableClient);
    return instance;
  },
});

afterAll(async () => {
  const clients = [...constructedClients];
  constructedClients.clear();
  // allSettled: a client that never connected, or was already disconnected by
  // the suite itself, must not fail the suite on teardown.
  await Promise.allSettled(clients.map((client) => client.$disconnect()));
});
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
