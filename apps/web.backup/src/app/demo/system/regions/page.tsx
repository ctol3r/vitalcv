'use client';

import React from 'react';

type RegionStatus = {
	region: string;
	load: number;
	p99LatencyMs: number;
	failoverActive: boolean;
	queueReplicationHealthy: boolean;
};

async function fetchRegionStatuses(): Promise<RegionStatus[]> {
	try {
		const res = await fetch('/api/demo/modules/health', { cache: 'no-store' });
		if (!res.ok) throw new Error('health fetch failed');
		const data = await res.json();
		// Fallback mapping to expected keys
		return (data.regions ?? []).map((r: any) => ({
			region: r.name ?? r.region,
			load: r.load ?? 0,
			p99LatencyMs: r.p99LatencyMs ?? r.p99 ?? 0,
			failoverActive: Boolean(r.failoverActive ?? r.failover),
			queueReplicationHealthy: Boolean(r.queueReplicationHealthy ?? r.queueHealthy),
		}));
	} catch {
		return [];
	}
}

export default function RegionsPage() {
	const [rows, setRows] = React.useState<RegionStatus[]>([]);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		let mounted = true;
		(async () => {
			const data = await fetchRegionStatuses();
			if (mounted) {
				setRows(data);
				setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	return (
		<div style={{ padding: 24 }}>
			<h1>Global Region Status</h1>
			<p aria-live="polite">{loading ? 'Loading…' : `Regions: ${rows.length}`}</p>
			<div role="table" aria-label="Region health" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8 }}>
				<div role="row" style={{ fontWeight: 600 }}>
					<div role="columnheader">Region</div>
					<div role="columnheader">Load</div>
					<div role="columnheader">P99 Latency (ms)</div>
					<div role="columnheader">Failover</div>
					<div role="columnheader">Queue Replication</div>
				</div>
				{rows.map((r) => (
					<div role="row" key={r.region} style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
						<div role="cell">{r.region}</div>
						<div role="cell">{Math.round(r.load * 100)}%</div>
						<div role="cell">{r.p99LatencyMs}</div>
						<div role="cell" aria-label={r.failoverActive ? 'Failover active' : 'Primary'}>
							<span style={{ color: r.failoverActive ? '#b45309' : '#16a34a' }}>
								{r.failoverActive ? 'Active' : 'Primary'}
							</span>
						</div>
						<div role="cell" aria-label={r.queueReplicationHealthy ? 'Replication healthy' : 'Replication degraded'}>
							<span style={{ color: r.queueReplicationHealthy ? '#16a34a' : '#dc2626' }}>
								{r.queueReplicationHealthy ? 'Healthy' : 'Degraded'}
							</span>
						</div>
					</div>
				))}
				{!loading && rows.length === 0 && (
					<div role="row" style={{ paddingTop: 8 }}>
						<div role="cell" style={{ gridColumn: '1 / -1', color: '#6b7280' }}>No region data</div>
					</div>
				)}
			</div>
		</div>
	);
}


