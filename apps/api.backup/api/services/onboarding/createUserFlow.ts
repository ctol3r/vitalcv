import { User, UserRole } from '@prisma/client';
import { createUser, CreateUserInput } from '../users/models/User';
import {
  upsertClinicianProfile,
  UpsertClinicianProfileInput,
} from '../users/models/ClinicianProfile';
import {
  upsertOrgProfile,
  UpsertOrgProfileInput,
} from '../org/models/OrgProfile';
import { linkDidToUser } from '../identity/models/DidUserLink';
import {
  OrgMembershipRole,
  upsertOrgMembership,
} from '../org/models/OrgMembership';

export interface CreateUserFlowInput {
  user: CreateUserInput;
  clinicianProfile?: Omit<UpsertClinicianProfileInput, 'userId'>;
  orgProfile?: UpsertOrgProfileInput & { makeAdmin?: boolean };
  did?: string;
}

export interface CreateUserFlowResult {
  user: User;
  clinicianProfile?: Awaited<ReturnType<typeof upsertClinicianProfile>>;
  orgProfile?: Awaited<ReturnType<typeof upsertOrgProfile>>;
}

export async function createUserFlow(
  input: CreateUserFlowInput
): Promise<CreateUserFlowResult> {
  const user = await createUser(input.user);
  let clinicianProfile;
  let orgProfile;

  if (input.clinicianProfile) {
    clinicianProfile = await upsertClinicianProfile({
      ...input.clinicianProfile,
      userId: user.id,
    });
  }

  if (input.orgProfile) {
    const { makeAdmin, ...orgProfileInput } = input.orgProfile;

    orgProfile = await upsertOrgProfile(orgProfileInput);

    const makeAdminFlag =
      makeAdmin ?? input.user.role === UserRole.ORG_ADMIN;
    await upsertOrgMembership(
      user.id,
      orgProfileInput.orgId,
      makeAdminFlag ? OrgMembershipRole.ADMIN : OrgMembershipRole.VIEWER
    );
  }

  if (input.did) {
    await linkDidToUser({ userId: user.id, did: input.did });
  }

  return {
    user,
    clinicianProfile,
    orgProfile,
  };
}

