'use client';

import { useMemo, useState } from 'react';
import PermissionPanel from '@/components/plugins/PermissionPanel';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MarketplacePlugin {
	name: string;
	version: string;
	author: string;
	capabilities: string[];
	permissions: string[];
	enabled: boolean;
	installed: boolean;
}

export default function PluginMarketplacePage() {
	const [plugins, setPlugins] = useState<MarketplacePlugin[]>(() => [
		{
			name: 'vitalcv-safety-analyzer',
			version: '0.1.0',
			author: 'VitalCV',
			capabilities: ['readTimeline', 'runAnalysis'],
			permissions: ['timeline:read'],
			enabled: true,
			installed: true,
		},
		{
			name: 'org-privilege-forecaster',
			version: '0.2.3',
			author: 'Third-Party Labs',
			capabilities: ['provideForecasts'],
			permissions: [],
			enabled: false,
			installed: false,
		},
	]);

	const installed = useMemo(() => plugins.filter((p) => p.installed), [plugins]);
	const available = useMemo(() => plugins.filter((p) => !p.installed), [plugins]);

	function toggleEnabled(name: string, next: boolean) {
		setPlugins((prev) =>
			prev.map((p) => (p.name === name ? { ...p, enabled: next, installed: true } : p)),
		);
	}

	function changePermission(name: string, perm: string, next: boolean) {
		setPlugins((prev) =>
			prev.map((p) => {
				if (p.name !== name) return p;
				const set = new Set(p.permissions);
				if (next) set.add(perm);
				else set.delete(perm);
				return { ...p, permissions: Array.from(set) };
			}),
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold">Plugin Marketplace</h1>
					<p className="text-sm text-muted-foreground">
						Install and manage plugins. Review permissions and capabilities.
					</p>
				</div>
				<Button variant="secondary">Refresh</Button>
			</div>

			<div className="space-y-4">
				<h2 className="text-lg font-medium">Installed</h2>
				{installed.length === 0 && (
					<Card className="p-4 text-sm text-muted-foreground">
						No plugins installed.
					</Card>
				)}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{installed.map((p) => (
						<PermissionPanel
							key={p.name}
							name={p.name}
							version={p.version}
							capabilities={p.capabilities}
							permissions={p.permissions}
							enabled={p.enabled}
							onToggleEnabled={(v) => toggleEnabled(p.name, v)}
							onChangePermission={(perm, v) => changePermission(p.name, perm, v)}
						/>
					))}
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="text-lg font-medium">Available</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{available.map((p) => (
						<Card key={p.name} className="p-4 space-y-3">
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<div className="font-medium">{p.name}</div>
									<div className="text-xs text-muted-foreground">
										v{p.version} • {p.author}
									</div>
								</div>
								<Button onClick={() => toggleEnabled(p.name, true)}>Install</Button>
							</div>
							<div className="flex flex-wrap gap-2">
								{p.capabilities.map((c) => (
									<Badge key={c} variant="secondary">
										{c}
									</Badge>
								))}
							</div>
						</Card>
					))}
				</div>
			</div>
		</div>
	);
}

