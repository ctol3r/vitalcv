import { FEATURES } from '../../../lib/features';
import MissionOpsV2Client from './MissionOpsV2Client';

export default function MissionOpsV2Page() {
  if (!FEATURES.MISSION_OPS_V2) return <div className="p-8 text-white/40 text-sm">Mission Ops v2 is not enabled.</div>;
  return <MissionOpsV2Client />;
}
