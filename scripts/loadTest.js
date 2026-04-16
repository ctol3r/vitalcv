#!/usr/bin/env node

const autocannon = require('autocannon');
const { monitorEventLoopDelay } = require('node:perf_hooks');

function readIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toMb(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

const config = {
  url: process.env.LOAD_TEST_URL || 'http://localhost:3000/api/manifest/test-npi',
  connections: readIntEnv('LOAD_TEST_CONNECTIONS', 100),
  duration: readIntEnv('LOAD_TEST_DURATION', 60),
  pipelining: readIntEnv('LOAD_TEST_PIPELINING', 1),
  amount: process.env.LOAD_TEST_AMOUNT ? readIntEnv('LOAD_TEST_AMOUNT', 0) : undefined,
  headers: {
    Accept: 'application/json',
  },
};

const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();

let peakHeapUsedBytes = 0;
let peakRssBytes = 0;
let peakCpuPercent = 0;
let peakEventLoopLagMs = 0;
let lastCpuUsage = process.cpuUsage();
let lastSampleAt = process.hrtime.bigint();

const metricsSampler = setInterval(() => {
  const memory = process.memoryUsage();
  peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
  peakRssBytes = Math.max(peakRssBytes, memory.rss);

  const cpuUsage = process.cpuUsage(lastCpuUsage);
  const now = process.hrtime.bigint();
  const elapsedMicros = Number(now - lastSampleAt) / 1000;

  if (elapsedMicros > 0) {
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / elapsedMicros) * 100;
    peakCpuPercent = Math.max(peakCpuPercent, Number(cpuPercent.toFixed(2)));
  }

  lastCpuUsage = process.cpuUsage();
  lastSampleAt = now;
  peakEventLoopLagMs = Math.max(
    peakEventLoopLagMs,
    Number((eventLoop.max / 1e6).toFixed(2)),
  );
}, 1000);

function percentileNs(histogram, percentile) {
  return Number((histogram.percentile(percentile) / 1e6).toFixed(2));
}

function finalize(result) {
  clearInterval(metricsSampler);
  eventLoop.disable();

  const summary = {
    target: config.url,
    connections: config.connections,
    duration_seconds: config.duration,
    requests: {
      average_per_second: Number(result.requests.average.toFixed(2)),
      total: result.requests.total,
    },
    latency_ms: {
      average: Number(result.latency.average.toFixed(2)),
      p50: Number(result.latency.p50.toFixed(2)),
      p95: Number(result.latency.p95.toFixed(2)),
      p99: Number(result.latency.p99.toFixed(2)),
      max: Number(result.latency.max.toFixed(2)),
    },
    throughput_bytes_per_second: {
      average: Number(result.throughput.average.toFixed(2)),
      total: result.throughput.total,
    },
    non_2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
    event_loop_lag_ms: {
      mean: Number((eventLoop.mean / 1e6).toFixed(2)),
      p95: percentileNs(eventLoop, 95),
      p99: percentileNs(eventLoop, 99),
      max: peakEventLoopLagMs,
    },
    memory_mb: {
      peak_heap_used: toMb(peakHeapUsedBytes),
      peak_rss: toMb(peakRssBytes),
    },
    cpu: {
      peak_percent: peakCpuPercent,
    },
    profiling_enabled: true,
  };

  console.log('\nLoad test summary');
  console.log(JSON.stringify(summary, null, 2));
}

console.log('Starting load test with config:');
console.log(JSON.stringify(config, null, 2));

const instance = autocannon(config, (error, result) => {
  if (error) {
    clearInterval(metricsSampler);
    eventLoop.disable();
    console.error('Load test failed:', error.message);
    process.exitCode = 1;
    return;
  }

  finalize(result);
});

autocannon.track(instance, {
  renderProgressBar: true,
  renderLatencyTable: true,
  renderResultsTable: true,
});
