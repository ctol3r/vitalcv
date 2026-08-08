-- Launch blocker #14(a): the Bitstring Status List revocation registry.
--
-- `services/ledger/statusListManager.ts` has referenced `StatusListState`
-- since Wave 40, but the model existed in neither schema.prisma nor any
-- migration. `prisma.statusListState` was therefore `undefined` and every DB
-- path in the manager threw at runtime — getStatusListCredential(),
-- setRevoked(), assignStatusIndex(), isRevoked(). The `// @ts-nocheck` at the
-- top of that module is why the compiler never reported it, and the tenant
-- guard's 401 on /api/credentials/status-list masked it from outside.
--
-- Purely additive: one new table, no changes to existing objects.

-- CreateTable
CREATE TABLE "status_list_state" (
    "id" TEXT NOT NULL,
    "encoded" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "size_bits" INTEGER NOT NULL,
    "next_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_list_state_pkey" PRIMARY KEY ("id")
);
