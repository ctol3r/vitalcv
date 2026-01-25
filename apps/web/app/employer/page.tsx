import { RoleRouteLayout } from '@/components/RoleRouteLayout';
import { ROLE_TOKENS } from '@/components/roleTokens';

export default function EmployerPage() {
  return <RoleRouteLayout token={ROLE_TOKENS.employer} />;
}
