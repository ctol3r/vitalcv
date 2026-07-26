-- The Prisma schema already exposes CREDENTIALING_SPECIALIST, but the prior
-- migration chain did not add it to PostgreSQL's MembershipRole enum. Keep a
-- fresh database behaviorally consistent with the canonical membership model.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'CREDENTIALING_SPECIALIST';
