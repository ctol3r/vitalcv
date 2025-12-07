/**
 * B242B-ACC-019: Accessibility Training Module
 *
 * Provides training content and interactive quizzes for developers and content creators.
 * Teaches inclusive design principles, WCAG guidelines, language considerations.
 * Tracks completion.
 */

export interface TrainingContent {
  /** Content identifier */
  id: string;
  /** Content title */
  title: string;
  /** Content description */
  description: string;
  /** Content type */
  type: 'article' | 'video' | 'interactive' | 'quiz';
  /** Content body (HTML or markdown) */
  content: string;
  /** Duration in minutes */
  duration: number;
  /** Learning objectives */
  objectives: string[];
  /** Tags for categorization */
  tags: string[];
  /** Prerequisites */
  prerequisites?: string[];
}

export interface QuizQuestion {
  /** Question identifier */
  id: string;
  /** Question text */
  question: string;
  /** Question type */
  type: 'multiple-choice' | 'true-false' | 'multiple-select';
  /** Answer options */
  options: Array<{
    id: string;
    text: string;
    correct: boolean;
    explanation?: string;
  }>;
  /** Points for correct answer */
  points: number;
}

export interface Quiz {
  /** Quiz identifier */
  id: string;
  /** Quiz title */
  title: string;
  /** Quiz description */
  description: string;
  /** Associated training content ID */
  contentId: string;
  /** Questions */
  questions: QuizQuestion[];
  /** Passing score (percentage) */
  passingScore: number;
  /** Time limit in minutes (optional) */
  timeLimit?: number;
}

export interface TrainingProgress {
  /** User identifier */
  userId: string;
  /** Content ID */
  contentId: string;
  /** Completion status */
  completed: boolean;
  /** Completion date */
  completedAt?: Date;
  /** Progress percentage (0-100) */
  progress: number;
  /** Quiz attempts */
  quizAttempts: Array<{
    quizId: string;
    score: number;
    passed: boolean;
    completedAt: Date;
    answers: Record<string, string | string[]>;
  }>;
}

/**
 * Training content library
 */
export const TRAINING_CONTENT: Record<string, TrainingContent> = {
  'wcag-overview': {
    id: 'wcag-overview',
    title: 'WCAG Guidelines Overview',
    description: 'Introduction to Web Content Accessibility Guidelines (WCAG)',
    type: 'article',
    content: `
# WCAG Guidelines Overview

The Web Content Accessibility Guidelines (WCAG) provide a set of recommendations for making web content more accessible.

## Key Principles

1. **Perceivable** - Information must be presentable in ways users can perceive
2. **Operable** - Interface components must be operable
3. **Understandable** - Information and UI operation must be understandable
4. **Robust** - Content must be robust enough for various assistive technologies

## Conformance Levels

- **Level A**: Minimum requirements
- **Level AA**: Recommended for most sites (meets legal requirements in many jurisdictions)
- **Level AAA**: Highest level of accessibility

## Common Requirements

- Color contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Keyboard navigation
- Alt text for images
- Proper heading structure
- Form labels
    `,
    duration: 15,
    objectives: [
      'Understand WCAG principles',
      'Learn about conformance levels',
      'Identify common accessibility requirements',
    ],
    tags: ['wcag', 'guidelines', 'basics'],
  },
  'inclusive-language': {
    id: 'inclusive-language',
    title: 'Inclusive Language Guidelines',
    description: 'Best practices for using inclusive language in content',
    type: 'article',
    content: `
# Inclusive Language Guidelines

Inclusive language ensures that all users feel welcome and respected.

## Key Principles

1. Use gender-neutral terms
2. Avoid idioms and cultural references
3. Use person-first language
4. Consider cultural context in translations

## Examples

- Use "everyone" instead of "guys"
- Use "they" instead of "he/she"
- Use "workforce" instead of "manpower"
- Use "blocklist" instead of "blacklist"
    `,
    duration: 10,
    objectives: [
      'Learn inclusive language principles',
      'Identify non-inclusive terms',
      'Apply inclusive language guidelines',
    ],
    tags: ['language', 'inclusivity', 'content'],
  },
  'keyboard-navigation': {
    id: 'keyboard-navigation',
    title: 'Keyboard Navigation',
    description: 'Implementing keyboard-accessible interfaces',
    type: 'interactive',
    content: `
# Keyboard Navigation

All interactive elements must be accessible via keyboard.

## Requirements

- All interactive elements must be focusable
- Focus order must be logical
- Focus indicators must be visible
- Skip links for main content
- Arrow key navigation in lists/grids

## Implementation

- Use proper tabIndex values
- Implement focus management
- Test with keyboard only
    `,
    duration: 20,
    objectives: [
      'Understand keyboard navigation requirements',
      'Implement focus management',
      'Test keyboard accessibility',
    ],
    tags: ['keyboard', 'navigation', 'implementation'],
  },
};

/**
 * Quiz library
 */
export const QUIZZES: Record<string, Quiz> = {
  'wcag-quiz': {
    id: 'wcag-quiz',
    title: 'WCAG Knowledge Quiz',
    description: 'Test your understanding of WCAG guidelines',
    contentId: 'wcag-overview',
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        question: 'What is the minimum contrast ratio for normal text (WCAG AA)?',
        type: 'multiple-choice',
        points: 10,
        options: [
          { id: 'a', text: '3:1', correct: false },
          { id: 'b', text: '4.5:1', correct: true, explanation: 'WCAG AA requires 4.5:1 for normal text' },
          { id: 'c', text: '7:1', correct: false },
          { id: 'd', text: '2:1', correct: false },
        ],
      },
      {
        id: 'q2',
        question: 'WCAG has three conformance levels: A, AA, and AAA.',
        type: 'true-false',
        points: 10,
        options: [
          { id: 'true', text: 'True', correct: true, explanation: 'WCAG has three levels: A (minimum), AA (recommended), and AAA (highest)' },
          { id: 'false', text: 'False', correct: false },
        ],
      },
      {
        id: 'q3',
        question: 'Which of the following are WCAG principles? (Select all that apply)',
        type: 'multiple-select',
        points: 15,
        options: [
          { id: 'a', text: 'Perceivable', correct: true },
          { id: 'b', text: 'Operable', correct: true },
          { id: 'c', text: 'Understandable', correct: true },
          { id: 'd', text: 'Robust', correct: true },
          { id: 'e', text: 'Beautiful', correct: false },
        ],
      },
    ],
  },
  'language-quiz': {
    id: 'language-quiz',
    title: 'Inclusive Language Quiz',
    description: 'Test your knowledge of inclusive language',
    contentId: 'inclusive-language',
    passingScore: 80,
    questions: [
      {
        id: 'q1',
        question: 'Which term is more inclusive?',
        type: 'multiple-choice',
        points: 10,
        options: [
          { id: 'a', text: 'guys', correct: false },
          { id: 'b', text: 'everyone', correct: true, explanation: '"Everyone" is gender-neutral' },
          { id: 'c', text: 'ladies and gentlemen', correct: false },
        ],
      },
    ],
  },
};

/**
 * Training progress store (in production, this would be a database)
 */
const progressStore = new Map<string, TrainingProgress>();

/**
 * Accessibility Training Module
 */
export class AccessibilityTrainingModule {
  /**
   * Get all training content
   */
  getAllContent(): TrainingContent[] {
    return Object.values(TRAINING_CONTENT);
  }

  /**
   * Get content by ID
   */
  getContent(id: string): TrainingContent | undefined {
    return TRAINING_CONTENT[id];
  }

  /**
   * Get quiz by ID
   */
  getQuiz(id: string): Quiz | undefined {
    return QUIZZES[id];
  }

  /**
   * Get quizzes for a content ID
   */
  getQuizzesForContent(contentId: string): Quiz[] {
    return Object.values(QUIZZES).filter((quiz) => quiz.contentId === contentId);
  }

  /**
   * Get user progress
   */
  getProgress(userId: string, contentId: string): TrainingProgress | null {
    const key = `${userId}:${contentId}`;
    return progressStore.get(key) || null;
  }

  /**
   * Update progress
   */
  updateProgress(
    userId: string,
    contentId: string,
    progress: number,
    completed: boolean = false
  ): TrainingProgress {
    const key = `${userId}:${contentId}`;
    const existing = progressStore.get(key);

    const updated: TrainingProgress = {
      userId,
      contentId,
      progress: Math.min(100, Math.max(0, progress)),
      completed,
      completedAt: completed ? new Date() : existing?.completedAt,
      quizAttempts: existing?.quizAttempts || [],
    };

    progressStore.set(key, updated);
    return updated;
  }

  /**
   * Submit quiz attempt
   */
  submitQuizAttempt(
    userId: string,
    quizId: string,
    answers: Record<string, string | string[]>
  ): {
    score: number;
    passed: boolean;
    feedback: Array<{
      questionId: string;
      correct: boolean;
      explanation?: string;
    }>;
  } {
    const quiz = QUIZZES[quizId];
    if (!quiz) {
      throw new Error(`Quiz not found: ${quizId}`);
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    const feedback: Array<{
      questionId: string;
      correct: boolean;
      explanation?: string;
    }> = [];

    for (const question of quiz.questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      let correct = false;

      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        const correctOption = question.options.find((opt) => opt.correct);
        correct = userAnswer === correctOption?.id;
      } else if (question.type === 'multiple-select') {
        const correctOptions = question.options.filter((opt) => opt.correct).map((opt) => opt.id);
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
        correct =
          userAnswers.length === correctOptions.length &&
          userAnswers.every((ans) => correctOptions.includes(ans));
      }

      if (correct) {
        earnedPoints += question.points;
      }

      const correctOption = question.options.find((opt) => opt.correct);
      feedback.push({
        questionId: question.id,
        correct,
        explanation: correctOption?.explanation,
      });
    }

    const score = (earnedPoints / totalPoints) * 100;
    const passed = score >= quiz.passingScore;

    // Update progress
    const contentId = quiz.contentId;
    const progress = this.getProgress(userId, contentId) || {
      userId,
      contentId,
      completed: false,
      progress: 0,
      quizAttempts: [],
    };

    progress.quizAttempts.push({
      quizId,
      score,
      passed,
      completedAt: new Date(),
      answers,
    });

    const key = `${userId}:${contentId}`;
    progressStore.set(key, progress);

    return { score, passed, feedback };
  }

  /**
   * Get user's training statistics
   */
  getStatistics(userId: string): {
    totalContent: number;
    completed: number;
    inProgress: number;
    averageScore: number;
    certificates: number;
  } {
    const allProgress = Array.from(progressStore.values()).filter(
      (p) => p.userId === userId
    );

    const completed = allProgress.filter((p) => p.completed).length;
    const inProgress = allProgress.filter((p) => !p.completed && p.progress > 0).length;

    let totalScore = 0;
    let quizCount = 0;
    for (const progress of allProgress) {
      for (const attempt of progress.quizAttempts) {
        totalScore += attempt.score;
        quizCount++;
      }
    }

    const averageScore = quizCount > 0 ? totalScore / quizCount : 0;
    const certificates = allProgress.filter(
      (p) => p.completed && p.quizAttempts.some((a) => a.passed)
    ).length;

    return {
      totalContent: Object.keys(TRAINING_CONTENT).length,
      completed,
      inProgress,
      averageScore: Math.round(averageScore),
      certificates,
    };
  }
}

/**
 * Singleton instance
 */
export const accessibilityTrainingModule = new AccessibilityTrainingModule();

/**
 * Default export
 */
export default accessibilityTrainingModule;

