/**
 * B247C-GAM-021: Tests for Leaderboard model
 */

import { PrismaClient, LeaderboardPeriod } from '@prisma/client';
import {
  upsertLeaderboardEntry,
  getLeaderboardEntry,
  getTopLeaderboardEntries,
  getUserRank,
  getLeaderboardAroundUser,
} from '../models/Leaderboard';

describe('Leaderboard Model', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.leaderboard.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('upsertLeaderboardEntry', () => {
    it('should create a new leaderboard entry', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      const entry = await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 1,
      });

      expect(entry).toBeDefined();
      expect(entry.userId).toBe(user.id);
      expect(entry.pointsTotal).toBe(100);
      expect(entry.period).toBe(LeaderboardPeriod.ALL_TIME);
      expect(entry.rank).toBe(1);
    });

    it('should update existing entry for same user and period', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 1,
      });

      const updated = await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 200,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 2,
      });

      expect(updated.pointsTotal).toBe(200);
      expect(updated.rank).toBe(2);

      // Verify only one entry exists
      const count = await prisma.leaderboard.count({
        where: { userId: user.id, period: LeaderboardPeriod.ALL_TIME },
      });
      expect(count).toBe(1);
    });

    it('should allow different periods for same user', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      const daily = await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 50,
        period: LeaderboardPeriod.DAILY,
        rank: 1,
      });

      const weekly = await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 150,
        period: LeaderboardPeriod.WEEKLY,
        rank: 1,
      });

      expect(daily.period).toBe(LeaderboardPeriod.DAILY);
      expect(weekly.period).toBe(LeaderboardPeriod.WEEKLY);
      expect(daily.pointsTotal).toBe(50);
      expect(weekly.pointsTotal).toBe(150);
    });
  });

  describe('getLeaderboardEntry', () => {
    it('should return entry for user and period', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 1,
      });

      const entry = await getLeaderboardEntry(prisma, user.id, LeaderboardPeriod.ALL_TIME);

      expect(entry).toBeDefined();
      expect(entry?.userId).toBe(user.id);
      expect(entry?.pointsTotal).toBe(100);
    });

    it('should return null for non-existent entry', async () => {
      const entry = await getLeaderboardEntry(prisma, 'non-existent', LeaderboardPeriod.ALL_TIME);
      expect(entry).toBeNull();
    });
  });

  describe('getTopLeaderboardEntries', () => {
    it('should return top entries ordered by rank', async () => {
      const users = await Promise.all([
        prisma.user.create({ data: { email: 'user1@example.com', name: 'User 1' } }),
        prisma.user.create({ data: { email: 'user2@example.com', name: 'User 2' } }),
        prisma.user.create({ data: { email: 'user3@example.com', name: 'User 3' } }),
      ]);

      await Promise.all([
        upsertLeaderboardEntry(prisma, {
          userId: users[0].id,
          pointsTotal: 300,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 1,
        }),
        upsertLeaderboardEntry(prisma, {
          userId: users[1].id,
          pointsTotal: 200,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 2,
        }),
        upsertLeaderboardEntry(prisma, {
          userId: users[2].id,
          pointsTotal: 100,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 3,
        }),
      ]);

      const entries = await getTopLeaderboardEntries(prisma, LeaderboardPeriod.ALL_TIME, 10);

      expect(entries.length).toBe(3);
      expect(entries[0].rank).toBe(1);
      expect(entries[1].rank).toBe(2);
      expect(entries[2].rank).toBe(3);
    });

    it('should respect limit parameter', async () => {
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.user.create({
            data: { email: `user${i}@example.com`, name: `User ${i}` },
          })
        )
      );

      await Promise.all(
        users.map((user, index) =>
          upsertLeaderboardEntry(prisma, {
            userId: user.id,
            pointsTotal: 1000 - index * 10,
            period: LeaderboardPeriod.ALL_TIME,
            rank: index + 1,
          })
        )
      );

      const entries = await getTopLeaderboardEntries(prisma, LeaderboardPeriod.ALL_TIME, 5);

      expect(entries.length).toBe(5);
    });
  });

  describe('getUserRank', () => {
    it('should return user rank', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 5,
      });

      const rank = await getUserRank(prisma, user.id, LeaderboardPeriod.ALL_TIME);

      expect(rank).toBe(5);
    });

    it('should return null for non-existent user', async () => {
      const rank = await getUserRank(prisma, 'non-existent', LeaderboardPeriod.ALL_TIME);
      expect(rank).toBeNull();
    });
  });

  describe('getLeaderboardAroundUser', () => {
    it('should return entries around user rank', async () => {
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.user.create({
            data: { email: `user${i}@example.com`, name: `User ${i}` },
          })
        )
      );

      await Promise.all(
        users.map((user, index) =>
          upsertLeaderboardEntry(prisma, {
            userId: user.id,
            pointsTotal: 1000 - index * 10,
            period: LeaderboardPeriod.ALL_TIME,
            rank: index + 1,
          })
        )
      );

      const result = await getLeaderboardAroundUser(
        prisma,
        users[5].id,
        LeaderboardPeriod.ALL_TIME,
        2
      );

      expect(result.userRank).toBe(6);
      expect(result.entries.length).toBeGreaterThan(0);
      // Should include entries from rank 4 to 8 (around rank 6)
      const ranks = result.entries.map((e: any) => e.rank);
      expect(Math.min(...ranks)).toBeLessThanOrEqual(4);
      expect(Math.max(...ranks)).toBeGreaterThanOrEqual(8);
    });
  });
});

