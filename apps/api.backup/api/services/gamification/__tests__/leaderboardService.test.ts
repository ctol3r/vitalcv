/**
 * B247C-GAM-022: Tests for LeaderboardService ranking logic
 */

import { PrismaClient, LeaderboardPeriod } from '@prisma/client';
import { LeaderboardService } from '../services/leaderboardService';
import { upsertLeaderboardEntry } from '../models/Leaderboard';

describe('LeaderboardService', () => {
  let prisma: PrismaClient;
  let service: LeaderboardService;

  beforeAll(() => {
    prisma = new PrismaClient();
    service = new LeaderboardService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.leaderboard.deleteMany({});
    await prisma.userGamificationPreferences.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('calculateRankings', () => {
    it('should assign ranks correctly', async () => {
      const pointsData = [
        { userId: 'user1', pointsTotal: 300 },
        { userId: 'user2', pointsTotal: 200 },
        { userId: 'user3', pointsTotal: 100 },
      ];

      const rankings = await service.calculateRankings(LeaderboardPeriod.ALL_TIME, pointsData);

      expect(rankings.length).toBe(3);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].userId).toBe('user1');
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].userId).toBe('user2');
      expect(rankings[2].rank).toBe(3);
      expect(rankings[2].userId).toBe('user3');
    });

    it('should handle ties fairly', async () => {
      const pointsData = [
        { userId: 'user1', pointsTotal: 300 },
        { userId: 'user2', pointsTotal: 200 },
        { userId: 'user3', pointsTotal: 200 }, // Tie with user2
        { userId: 'user4', pointsTotal: 100 },
      ];

      const rankings = await service.calculateRankings(LeaderboardPeriod.ALL_TIME, pointsData);

      expect(rankings.length).toBe(4);
      expect(rankings[0].rank).toBe(1); // user1
      expect(rankings[1].rank).toBe(2); // user2 (tied)
      expect(rankings[2].rank).toBe(2); // user3 (tied, same rank)
      expect(rankings[3].rank).toBe(4); // user4 (skips rank 3)
    });

    it('should handle multiple ties', async () => {
      const pointsData = [
        { userId: 'user1', pointsTotal: 300 },
        { userId: 'user2', pointsTotal: 200 },
        { userId: 'user3', pointsTotal: 200 },
        { userId: 'user4', pointsTotal: 200 },
        { userId: 'user5', pointsTotal: 100 },
      ];

      const rankings = await service.calculateRankings(LeaderboardPeriod.ALL_TIME, pointsData);

      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].rank).toBe(2);
      expect(rankings[3].rank).toBe(2);
      expect(rankings[4].rank).toBe(5); // Skips ranks 3 and 4
    });

    it('should handle empty data', async () => {
      const rankings = await service.calculateRankings(LeaderboardPeriod.ALL_TIME, []);
      expect(rankings.length).toBe(0);
    });
  });

  describe('updateRankings', () => {
    it('should update rankings for a period', async () => {
      const users = await Promise.all([
        prisma.user.create({ data: { email: 'user1@example.com', name: 'User 1' } }),
        prisma.user.create({ data: { email: 'user2@example.com', name: 'User 2' } }),
        prisma.user.create({ data: { email: 'user3@example.com', name: 'User 3' } }),
      ]);

      // Create entries with incorrect ranks
      await Promise.all([
        upsertLeaderboardEntry(prisma, {
          userId: users[0].id,
          pointsTotal: 300,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 99, // Wrong rank
        }),
        upsertLeaderboardEntry(prisma, {
          userId: users[1].id,
          pointsTotal: 200,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 99, // Wrong rank
        }),
        upsertLeaderboardEntry(prisma, {
          userId: users[2].id,
          pointsTotal: 100,
          period: LeaderboardPeriod.ALL_TIME,
          rank: 99, // Wrong rank
        }),
      ]);

      await service.updateRankings(LeaderboardPeriod.ALL_TIME);

      const entries = await prisma.leaderboard.findMany({
        where: { period: LeaderboardPeriod.ALL_TIME },
        orderBy: { rank: 'asc' },
      });

      expect(entries.length).toBe(3);
      expect(entries[0].rank).toBe(1);
      expect(entries[1].rank).toBe(2);
      expect(entries[2].rank).toBe(3);
    });
  });

  describe('getUserRank', () => {
    it('should return user rank if opted in', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await prisma.userGamificationPreferences.create({
        data: {
          userId: user.id,
          leaderboardOptIn: true,
        },
      });

      await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 5,
      });

      const result = await service.getUserRank(user.id, LeaderboardPeriod.ALL_TIME);

      expect(result).toBeDefined();
      expect(result?.rank).toBe(5);
      expect(result?.isPrivate).toBe(false);
    });

    it('should return null rank if opted out', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      await prisma.userGamificationPreferences.create({
        data: {
          userId: user.id,
          leaderboardOptIn: false,
        },
      });

      await upsertLeaderboardEntry(prisma, {
        userId: user.id,
        pointsTotal: 100,
        period: LeaderboardPeriod.ALL_TIME,
        rank: 5,
      });

      const result = await service.getUserRank(user.id, LeaderboardPeriod.ALL_TIME);

      expect(result).toBeDefined();
      expect(result?.rank).toBeNull();
      expect(result?.isPrivate).toBe(true);
    });

    it('should return null if no entry exists', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      const result = await service.getUserRank(user.id, LeaderboardPeriod.ALL_TIME);
      expect(result).toBeNull();
    });
  });

  describe('getTopLeaderboard', () => {
    it('should return top entries', async () => {
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

      const result = await service.getTopLeaderboard(LeaderboardPeriod.ALL_TIME, 5);

      expect(result.entries.length).toBe(5);
      expect(result.totalEntries).toBe(10);
      expect(result.period).toBe(LeaderboardPeriod.ALL_TIME);
      expect(result.entries[0].rank).toBe(1);
    });
  });
});

