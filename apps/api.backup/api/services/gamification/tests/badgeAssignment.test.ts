/**
 * BadgeAssignmentTests suite
 * B247B-GAM-019: Test awarding badges under different criteria scenarios (point thresholds, streaks, actions); ensures duplicate badges are not awarded; verifies progress tracking and notifications
 */

import { PrismaClient } from '@prisma/client';
import { BadgeModel, BadgeCreateInput } from '../models/Badge';
import { AchievementProgressModel } from '../models/AchievementProgress';
import { BadgeAssignmentService, UserActivity } from '../services/badgeAssignmentService';
import { BadgeDefinitionLoader } from '../services/badgeDefinitionLoader';
import { BadgeCriteriaEvaluator } from '../services/badgeCriteriaEvaluator';
import { EventEmitter } from 'events';

describe('BadgeAssignmentService', () => {
  let prisma: PrismaClient;
  let badgeModel: BadgeModel;
  let progressModel: AchievementProgressModel;
  let assignmentService: BadgeAssignmentService;
  let eventBus: EventEmitter;
  let testUserId: string;
  let badgeIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    badgeModel = new BadgeModel(prisma);
    progressModel = new AchievementProgressModel(prisma);
    eventBus = new EventEmitter();
    assignmentService = new BadgeAssignmentService(prisma, eventBus);

    // Create a test user (or use existing)
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No test user found. Please create a user first.');
    }
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test badges
    for (const badgeId of badgeIds) {
      try {
        await badgeModel.delete(badgeId);
      } catch (error) {
        // Ignore errors
      }
    }
    await prisma.$disconnect();
  });

  describe('Point Threshold Badges', () => {
    it('should award badge when point threshold is met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Point Badge',
        slug: 'test-point-badge',
        description: 'Awarded at 100 points',
        criteria: {
          type: 'point_threshold',
          value: 100,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with sufficient points
      const activity: UserActivity = {
        points: 100,
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).toContain(badge.id);

      // Verify badge was assigned
      const userBadges = await assignmentService.getUserBadges(testUserId);
      const found = userBadges.find((b) => b.badge.id === badge.id);
      expect(found).toBeDefined();
    });

    it('should not award badge when point threshold is not met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test High Point Badge',
        slug: 'test-high-point-badge',
        description: 'Awarded at 1000 points',
        criteria: {
          type: 'point_threshold',
          value: 1000,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with insufficient points
      const activity: UserActivity = {
        points: 500,
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).not.toContain(badge.id);
    });
  });

  describe('Action Count Badges', () => {
    it('should award badge when action count threshold is met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Action Badge',
        slug: 'test-action-badge',
        description: 'Awarded after 10 actions',
        criteria: {
          type: 'action_count',
          action: 'login',
          value: 10,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with sufficient actions
      const activity: UserActivity = {
        actionCounts: {
          login: 10,
        },
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).toContain(badge.id);
    });

    it('should track progress for action count badges', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Action Progress Badge',
        slug: 'test-action-progress-badge',
        description: 'Awarded after 5 actions',
        criteria: {
          type: 'action_count',
          action: 'view_profile',
          value: 5,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // First check with partial progress
      const activity1: UserActivity = {
        actionCounts: {
          view_profile: 3,
        },
      };

      await assignmentService.checkUserBadges(testUserId, activity1);
      const progress1 = await assignmentService.getBadgeProgress(testUserId, badge.id);
      expect(progress1).toBeDefined();
      expect(progress1!.completed).toBe(false);
      expect(progress1!.progressPercentage).toBeLessThan(100);

      // Complete the badge
      const activity2: UserActivity = {
        actionCounts: {
          view_profile: 2,
        },
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity2);
      expect(awarded).toContain(badge.id);
    });
  });

  describe('Streak Badges', () => {
    it('should award badge when streak threshold is met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Streak Badge',
        slug: 'test-streak-badge',
        description: 'Awarded after 7 day streak',
        criteria: {
          type: 'streak',
          days: 7,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with sufficient streak
      const activity: UserActivity = {
        streaks: {
          default: 7,
        },
        lastActionDates: {
          default: new Date().toISOString(),
        },
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).toContain(badge.id);
    });
  });

  describe('Composite Badges', () => {
    it('should award badge when all AND conditions are met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Composite AND Badge',
        slug: 'test-composite-and-badge',
        description: 'Awarded when both conditions are met',
        criteria: {
          type: 'composite',
          operator: 'AND',
          conditions: [
            {
              type: 'point_threshold',
              value: 100,
            },
            {
              type: 'action_count',
              action: 'login',
              value: 5,
            },
          ],
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with both conditions met
      const activity: UserActivity = {
        points: 100,
        actionCounts: {
          login: 5,
        },
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).toContain(badge.id);
    });

    it('should award badge when any OR condition is met', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Composite OR Badge',
        slug: 'test-composite-or-badge',
        description: 'Awarded when either condition is met',
        criteria: {
          type: 'composite',
          operator: 'OR',
          conditions: [
            {
              type: 'point_threshold',
              value: 1000,
            },
            {
              type: 'action_count',
              action: 'login',
              value: 10,
            },
          ],
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge with only one condition met
      const activity: UserActivity = {
        actionCounts: {
          login: 10,
        },
      };

      const awarded = await assignmentService.checkUserBadges(testUserId, activity);
      expect(awarded).toContain(badge.id);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should not award the same badge twice', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Duplicate Badge',
        slug: 'test-duplicate-badge',
        description: 'Should only be awarded once',
        criteria: {
          type: 'point_threshold',
          value: 50,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Award badge first time
      const activity1: UserActivity = {
        points: 50,
      };

      const awarded1 = await assignmentService.checkUserBadges(testUserId, activity1);
      expect(awarded1).toContain(badge.id);

      // Try to award again
      const activity2: UserActivity = {
        points: 100,
      };

      const awarded2 = await assignmentService.checkUserBadges(testUserId, activity2);
      expect(awarded2).not.toContain(badge.id);
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress correctly', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Progress Tracking Badge',
        slug: 'test-progress-tracking-badge',
        description: 'Awarded at 200 points',
        criteria: {
          type: 'point_threshold',
          value: 200,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      // Add partial progress
      const activity: UserActivity = {
        points: 100,
      };

      await assignmentService.checkUserBadges(testUserId, activity);

      const progress = await assignmentService.getBadgeProgress(testUserId, badge.id);
      expect(progress).toBeDefined();
      expect(progress!.completed).toBe(false);
      expect(progress!.progressPercentage).toBe(50);
    });
  });

  describe('Event Emission', () => {
    it('should emit badgeAwarded event when badge is awarded', async () => {
      const badgeData: BadgeCreateInput = {
        name: 'Test Event Badge',
        slug: 'test-event-badge',
        description: 'Tests event emission',
        criteria: {
          type: 'point_threshold',
          value: 50,
        },
        level: 1,
      };

      const badge = await badgeModel.create(badgeData);
      badgeIds.push(badge.id);

      const eventPromise = new Promise((resolve) => {
        eventBus.once('badgeAwarded', (event) => {
          resolve(event);
        });
      });

      const activity: UserActivity = {
        points: 50,
      };

      await assignmentService.checkUserBadges(testUserId, activity);

      const event = await eventPromise;
      expect(event).toBeDefined();
      expect((event as any).type).toBe('badgeAwarded');
      expect((event as any).userId).toBe(testUserId);
      expect((event as any).badgeId).toBe(badge.id);
    });
  });
});

describe('BadgeCriteriaEvaluator', () => {
  let evaluator: BadgeCriteriaEvaluator;

  beforeAll(() => {
    evaluator = new BadgeCriteriaEvaluator();
  });

  describe('Point Threshold Evaluation', () => {
    it('should return true when points meet threshold', () => {
      const criteria = {
        type: 'point_threshold' as const,
        value: 100,
      };

      const activity = { points: 100 };
      const progress = { points: 100 };

      const result = evaluator.evaluate(criteria, activity, progress);
      expect(result).toBe(true);
    });

    it('should return false when points are below threshold', () => {
      const criteria = {
        type: 'point_threshold' as const,
        value: 100,
      };

      const activity = { points: 50 };
      const progress = { points: 50 };

      const result = evaluator.evaluate(criteria, activity, progress);
      expect(result).toBe(false);
    });
  });

  describe('Action Count Evaluation', () => {
    it('should return true when action count meets threshold', () => {
      const criteria = {
        type: 'action_count' as const,
        action: 'login',
        value: 10,
      };

      const activity = { actionCounts: { login: 10 } };
      const progress = { actionCount: 10 };

      const result = evaluator.evaluate(criteria, activity, progress);
      expect(result).toBe(true);
    });
  });

  describe('Streak Evaluation', () => {
    it('should return true when streak meets threshold', () => {
      const criteria = {
        type: 'streak' as const,
        days: 7,
      };

      const activity = { streaks: { default: 7 } };
      const progress = { streakDays: 7 };

      const result = evaluator.evaluate(criteria, activity, progress);
      expect(result).toBe(true);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const criteria = {
        type: 'point_threshold' as const,
        value: 200,
      };

      const activity = { points: 100 };
      const progress = { points: 100 };

      const percentage = evaluator.calculateProgress(criteria, activity, progress);
      expect(percentage).toBe(50);
    });
  });
});

describe('BadgeDefinitionLoader', () => {
  let prisma: PrismaClient;
  let loader: BadgeDefinitionLoader;
  let badgeModel: BadgeModel;
  let badgeIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    loader = new BadgeDefinitionLoader(prisma);
    badgeModel = new BadgeModel(prisma);
  });

  afterAll(async () => {
    for (const badgeId of badgeIds) {
      try {
        await badgeModel.delete(badgeId);
      } catch (error) {
        // Ignore errors
      }
    }
    await prisma.$disconnect();
  });

  it('should load and cache badge definitions', async () => {
    const badgeData: BadgeCreateInput = {
      name: 'Test Cache Badge',
      slug: 'test-cache-badge',
      description: 'Tests caching',
      criteria: {
        type: 'point_threshold',
        value: 100,
      },
      level: 1,
    };

    const badge = await badgeModel.create(badgeData);
    badgeIds.push(badge.id);

    // Load all badges
    const badges = await loader.loadAll();
    expect(badges.length).toBeGreaterThan(0);

    // Check cache
    const cached = loader.getFromCache(badge.id);
    expect(cached).toBeDefined();
    expect(cached?.id).toBe(badge.id);
  });

  it('should validate criteria structure', async () => {
    const invalidCriteria = {
      type: 'invalid_type',
    };

    expect(() => {
      loader['validateCriteria'](invalidCriteria as any);
    }).toThrow();
  });
});

