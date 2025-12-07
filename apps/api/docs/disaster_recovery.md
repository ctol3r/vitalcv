# Disaster Recovery Drills

This repository includes a simple script that demonstrates how to perform a multi-region failover using Kubernetes contexts.

## Running a Failover Drill

1. Ensure you have two Kubernetes contexts configured in your kubeconfig file. These represent the primary and secondary regions.
2. Export environment variables pointing to those contexts and run the script:

```bash
MAIN_REGION=<primary-context> SECONDARY_REGION=<backup-context> ./scripts/dr/failover.sh
```

The script checks the availability of the primary region. If it is unreachable, it switches the active context to the secondary region. If the primary region is healthy, the script performs a drill by failing over to the secondary region and then restoring the primary.

