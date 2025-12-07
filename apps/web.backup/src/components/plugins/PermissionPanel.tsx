'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export interface PermissionPanelProps {
	name: string;
	version: string;
	capabilities: string[];
	permissions: string[];
	enabled: boolean;
	onToggleEnabled?: (next: boolean) => void;
	onChangePermission?: (perm: string, next: boolean) => void;
}

export default function PermissionPanel(props: PermissionPanelProps) {
	const { name, version, capabilities, permissions, enabled } = props;
	const capSet = useMemo(() => new Set(capabilities), [capabilities]);
	const permSet = useMemo(() => new Set(permissions), [permissions]);

	return (
		<Card className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<div className="text-lg font-medium">{name}</div>
					<div className="text-xs text-muted-foreground">v{version}</div>
				</div>
				<div className="flex items-center gap-2">
					<Label htmlFor={`${name}-enabled`}>Enabled</Label>
					<Switch
						id={`${name}-enabled`}
						checked={enabled}
						onCheckedChange={(v) => props.onToggleEnabled?.(!!v)}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<div className="text-sm font-medium">Capabilities</div>
				<div className="flex flex-wrap gap-2">
					{Array.from(capSet).map((c) => (
						<Badge key={c} variant="secondary">
							{c}
						</Badge>
					))}
					{capSet.size === 0 && (
						<span className="text-xs text-muted-foreground">None</span>
					)}
				</div>
			</div>
			<div className="space-y-2">
				<div className="text-sm font-medium">Permissions</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					{['timeline:read', 'events:write', 'credentials:read'].map((perm) => {
						const checked = permSet.has(perm);
						return (
							<div className="flex items-center justify-between" key={perm}>
								<Label htmlFor={`${name}-${perm}`}>{perm}</Label>
								<Switch
									id={`${name}-${perm}`}
									checked={checked}
									onCheckedChange={(v) =>
										props.onChangePermission?.(perm, !!v)
									}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}


