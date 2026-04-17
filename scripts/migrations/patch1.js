const fs = require("fs");
const propPath = "apps/api/backend/src/services/revocation/propagationEngine.ts";
let propContent = fs.readFileSync(propPath, "utf8");
propContent = propContent.replace(
  "data: {\n      status: nextStatus,\n      metadata: metadata as Prisma.InputJsonValue,\n    },",
  "data: {\n      status: nextStatus,\n      impactedByRevocation: true,\n      metadata: metadata as Prisma.InputJsonValue,\n    },"
);
fs.writeFileSync(propPath, propContent);

