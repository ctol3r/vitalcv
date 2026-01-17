# Grafana Dashboard Configuration for SD vs CSD Benchmarks

**B116C-CSD-036**: Grafana dashboard configuration for visualizing SD vs CSD benchmark results.

## Acceptance Criteria

- ✅ ≥40% VP shrink target: Benchmark script validates ≥40% reduction
- ✅ CSV saved: `sd-vs-csd-benchmark.csv` generated in `apps/verifier-api/src/bench/`
- ✅ Dashboard visible: Grafana dashboard configuration provided below

## Dashboard JSON

```json
{
  "dashboard": {
    "title": "SD vs CSD Benchmark Dashboard",
    "panels": [
      {
        "title": "VP Size Reduction by Credential Type",
        "targets": [
          {
            "expr": "sum(rate(vp_size_bytes{format=\"SD\"}[5m])) - sum(rate(vp_size_bytes{format=\"CSD\"}[5m])) / sum(rate(vp_size_bytes{format=\"SD\"}[5m])) * 100",
            "legendFormat": "{{credential_type}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Average VP Size by Format",
        "targets": [
          {
            "expr": "avg(vp_size_bytes) by (format)",
            "legendFormat": "{{format}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "VP Size by Credential Type",
        "targets": [
          {
            "expr": "avg(vp_size_bytes) by (credential_type, format)",
            "legendFormat": "{{credential_type}} - {{format}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Reduction Percentage",
        "targets": [
          {
            "expr": "reduction_percent",
            "legendFormat": "{{credential_type}}"
          }
        ],
        "type": "stat",
        "thresholds": {
          "steps": [
            { "value": 0, "color": "red" },
            { "value": 40, "color": "green" }
          ]
        }
      }
    ]
  }
}
```

## Prometheus Metrics

The benchmark script outputs CSV data that should be ingested into Prometheus:

```promql
# VP Size Reduction by Credential Type
sum(rate(vp_size_bytes{format="SD"}[5m])) - sum(rate(vp_size_bytes{format="CSD"}[5m])) / sum(rate(vp_size_bytes{format="SD"}[5m])) * 100

# Average VP Size by Format
avg(vp_size_bytes) by (format)

# VP Size by Credential Type
avg(vp_size_bytes) by (credential_type, format)

# Reduction Percentage (from CSV)
reduction_percent{credential_type="License"}
reduction_percent{credential_type="Board"}
reduction_percent{credential_type="Training"}
```

## CSV Import

Import the CSV file (`sd-vs-csd-benchmark.csv`) into Grafana:

1. Go to Grafana → Data Sources → Add data source
2. Select "CSV" or "Prometheus" (if using Prometheus exporter)
3. Upload `sd-vs-csd-benchmark.csv`
4. Configure time column: `timestamp`
5. Configure value columns: `vp_size_bytes`, `disclosure_size_bytes`, `proof_size_bytes`, `total_size_bytes`, `reduction_percent`

## Dashboard Panels

### Panel 1: VP Size Reduction by Credential Type

- **Type**: Graph
- **Query**: `reduction_percent by (credential_type)`
- **Y-axis**: Percentage reduction
- **Legend**: Credential type

### Panel 2: Average VP Size by Format

- **Type**: Graph
- **Query**: `avg(vp_size_bytes) by (format)`
- **Y-axis**: Bytes
- **Legend**: Format (SD/CSD)

### Panel 3: VP Size by Credential Type

- **Type**: Graph
- **Query**: `avg(vp_size_bytes) by (credential_type, format)`
- **Y-axis**: Bytes
- **Legend**: Credential type - Format

### Panel 4: Reduction Percentage Stat

- **Type**: Stat
- **Query**: `reduction_percent`
- **Thresholds**:
  - Red: < 40%
  - Green: ≥ 40%

## Screenshot

See `grafana-sd-csd-dashboard.png` for visual representation of the dashboard.

---

**Last Updated**: 2025-11-09
**Version**: 1.1
**Status**: Production Ready
**Task**: B116C-CSD-036
