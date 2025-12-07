# Gamification Service

Badge and achievement system for user engagement and motivation.

## Overview

The gamification service provides a comprehensive badge system that:
- Tracks user progress towards achievements
- Awards badges when criteria are met
- Sends notifications when badges are earned
- Provides APIs for viewing badges and progress

## Components

### Models

- **Badge**: Defines badge properties (name, slug, description, criteria, iconId, level, isActive)
- **AchievementProgress**: Tracks user progress towards badges
- **BadgeAssignment**: Records awarded badges (prevents duplicates)

### Services

- **BadgeDefinitionLoader**: Loads and caches badge definitions from database
- **BadgeCriteriaEvaluator**: Evaluates user activity against badge criteria
- **BadgeAssignmentService**: Assigns badges and emits events
- **BadgeNotificationsService**: Sends notifications when badges are awarded

### API

- **BadgesAPI**: REST endpoints for listing badges, viewing user badges, and checking progress

## Usage

### Basic Badge Assignment

```typescript
import { BadgeAssignmentService } from './services/gamification';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const assignmentService = new BadgeAssignmentService(prisma);

// Check and assign badges based on user activity
const activity = {
  points: 100,
  actionCounts: {
    login: 5,
  },
  streaks: {
    default: 7,
  },
};

const awarded = await assignmentService.checkUserBadges(userId, activity);
```

### Creating a Badge

```typescript
import { BadgeModel } from './services/gamification';

const badgeModel = new BadgeModel(prisma);

const badge = await badgeModel.create({
  name: 'First Steps',
  slug: 'first-steps',
  description: 'Awarded for your first action',
  criteria: {
    type: 'action_count',
    action: 'login',
    value: 1,
  },
  level: 1,
});
```

### Listening for Badge Awards

```typescript
import { BadgeAssignmentService } from './services/gamification';
import { BadgeNotificationsService } from './services/gamification';

const assignmentService = new BadgeAssignmentService(prisma);
const eventBus = assignmentService.getEventBus();

// Start notification service
const notificationService = new BadgeNotificationsService(prisma, eventBus);
notificationService.start();

// Register notification channels
notificationService.registerChannel('email', emailChannel);
```

## Badge Criteria Types

### Point Threshold

Awarded when user reaches a certain point total:

```typescript
{
  type: 'point_threshold',
  value: 100
}
```

### Action Count

Awarded when user performs an action a certain number of times:

```typescript
{
  type: 'action_count',
  action: 'login',
  value: 10
}
```

### Streak

Awarded when user maintains a streak for a certain number of days:

```typescript
{
  type: 'streak',
  days: 7
}
```

### Composite

Awarded when multiple conditions are met (AND/OR logic):

```typescript
{
  type: 'composite',
  operator: 'AND',
  conditions: [
    { type: 'point_threshold', value: 100 },
    { type: 'action_count', action: 'login', value: 5 }
  ]
}
```

## API Endpoints

### GET /api/gamification/badges

List all available badges.

**Query Parameters:**
- `isActive`: Filter by active status (default: true)
- `level`: Filter by specific level
- `minLevel`: Filter by minimum level
- `maxLevel`: Filter by maximum level
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

### GET /api/gamification/badges/:id

Get a specific badge by ID or slug.

### GET /api/gamification/badges/user/earned

Get user's earned badges (requires authentication).

### GET /api/gamification/badges/user/progress

Get user's progress for all badges (requires authentication).

### GET /api/gamification/badges/user/progress/:badgeId

Get user's progress for a specific badge (requires authentication).

## Database Migration

Run the migration to create the necessary tables:

```sql
-- Run: services/gamification/migrations/addBadgesTables.sql
```

Or use Prisma:

```bash
npx prisma migrate dev --name add_badges_tables
```

## Testing

Run the test suite:

```bash
npm test -- services/gamification/tests/badgeAssignment.test.ts
```

## Design Guidelines

See [badgeDesignGuidelines.md](./docs/badgeDesignGuidelines.md) for comprehensive design guidelines for badge icons and visual elements.

## Related Tasks

- B247B-GAM-011: Badge model
- B247B-GAM-012: BadgeAssignmentService
- B247B-GAM-013: BadgeDefinitionLoader
- B247B-GAM-014: BadgeCriteriaEvaluator
- B247B-GAM-015: AchievementProgress model
- B247B-GAM-016: BadgesAPI
- B247B-GAM-017: BadgeNotificationsService
- B247B-GAM-018: BadgeDesignGuidelines
- B247B-GAM-019: BadgeAssignmentTests
- B247B-GAM-020: BadgeMigration

