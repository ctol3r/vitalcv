/**
 * B242B-ACC-018: Accessibility Feedback API
 *
 * Allows users to report accessibility issues or suggest improvements.
 * Fields: issueType (contrast, keyboard, content), description, componentId, userAgent.
 * Stores reports for review.
 */

export type IssueType = 'contrast' | 'keyboard' | 'content' | 'screen-reader' | 'other';

export interface AccessibilityFeedback {
  /** Unique identifier for the feedback */
  id: string;
  /** Type of accessibility issue */
  issueType: IssueType;
  /** Description of the issue */
  description: string;
  /** Component or page identifier where issue occurred */
  componentId?: string;
  /** URL where issue occurred */
  url?: string;
  /** User agent string */
  userAgent: string;
  /** Browser information */
  browser?: {
    name: string;
    version: string;
  };
  /** Operating system */
  os?: string;
  /** Screen reader in use (if any) */
  screenReader?: string;
  /** Assistive technology in use */
  assistiveTech?: string[];
  /** Priority level */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Status of the feedback */
  status: 'pending' | 'reviewing' | 'in-progress' | 'resolved' | 'dismissed';
  /** Timestamp when feedback was submitted */
  submittedAt: Date;
  /** User who submitted (if authenticated) */
  submittedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * In-memory store for feedback (in production, this would be a database)
 */
const feedbackStore = new Map<string, AccessibilityFeedback>();

/**
 * Generate unique ID for feedback
 */
function generateId(): string {
  return `acc-feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse user agent string
 */
function parseUserAgent(userAgent: string): {
  browser: { name: string; version: string };
  os: string;
} {
  // Simplified parser - in production, use a library like ua-parser-js
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';
  let os = 'Unknown';

  // Detect browser
  if (userAgent.includes('Chrome')) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Edge')) {
    browserName = 'Edge';
    const match = userAgent.match(/Edge\/(\d+)/);
    if (match) browserVersion = match[1];
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS')) {
    os = 'iOS';
  }

  return {
    browser: { name: browserName, version: browserVersion },
    os,
  };
}

/**
 * Accessibility Feedback API Service
 */
export class AccessibilityFeedbackAPI {
  /**
   * Submit accessibility feedback
   */
  async submitFeedback(
    feedback: Omit<AccessibilityFeedback, 'id' | 'submittedAt' | 'status'>
  ): Promise<AccessibilityFeedback> {
    const id = generateId();
    const userAgentInfo = parseUserAgent(feedback.userAgent);

    const fullFeedback: AccessibilityFeedback = {
      ...feedback,
      id,
      submittedAt: new Date(),
      status: 'pending',
      browser: userAgentInfo.browser,
      os: userAgentInfo.os,
    };

    feedbackStore.set(id, fullFeedback);
    return fullFeedback;
  }

  /**
   * Get feedback by ID
   */
  async getFeedback(id: string): Promise<AccessibilityFeedback | null> {
    return feedbackStore.get(id) || null;
  }

  /**
   * Get all feedback (with optional filters)
   */
  async getAllFeedback(filters?: {
    issueType?: IssueType;
    status?: AccessibilityFeedback['status'];
    componentId?: string;
    priority?: AccessibilityFeedback['priority'];
    submittedBy?: string;
  }): Promise<AccessibilityFeedback[]> {
    let feedback = Array.from(feedbackStore.values());

    if (filters) {
      if (filters.issueType) {
        feedback = feedback.filter((f) => f.issueType === filters.issueType);
      }
      if (filters.status) {
        feedback = feedback.filter((f) => f.status === filters.status);
      }
      if (filters.componentId) {
        feedback = feedback.filter((f) => f.componentId === filters.componentId);
      }
      if (filters.priority) {
        feedback = feedback.filter((f) => f.priority === filters.priority);
      }
      if (filters.submittedBy) {
        feedback = feedback.filter((f) => f.submittedBy === filters.submittedBy);
      }
    }

    // Sort by submission date (newest first)
    return feedback.sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  }

  /**
   * Update feedback status
   */
  async updateStatus(
    id: string,
    status: AccessibilityFeedback['status']
  ): Promise<AccessibilityFeedback | null> {
    const feedback = feedbackStore.get(id);
    if (!feedback) {
      return null;
    }

    const updated = { ...feedback, status };
    feedbackStore.set(id, updated);
    return updated;
  }

  /**
   * Update feedback priority
   */
  async updatePriority(
    id: string,
    priority: AccessibilityFeedback['priority']
  ): Promise<AccessibilityFeedback | null> {
    const feedback = feedbackStore.get(id);
    if (!feedback) {
      return null;
    }

    const updated = { ...feedback, priority };
    feedbackStore.set(id, updated);
    return updated;
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(id: string): Promise<boolean> {
    return feedbackStore.delete(id);
  }

  /**
   * Get feedback statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<IssueType, number>;
    byStatus: Record<AccessibilityFeedback['status'], number>;
    byPriority: Record<string, number>;
    recent: number; // Count from last 7 days
  }> {
    const allFeedback = Array.from(feedbackStore.values());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const byType: Record<IssueType, number> = {
      contrast: 0,
      keyboard: 0,
      content: 0,
      'screen-reader': 0,
      other: 0,
    };

    const byStatus: Record<AccessibilityFeedback['status'], number> = {
      pending: 0,
      reviewing: 0,
      'in-progress': 0,
      resolved: 0,
      dismissed: 0,
    };

    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let recent = 0;

    for (const feedback of allFeedback) {
      byType[feedback.issueType]++;
      byStatus[feedback.status]++;
      if (feedback.priority) {
        byPriority[feedback.priority]++;
      }
      if (feedback.submittedAt >= sevenDaysAgo) {
        recent++;
      }
    }

    return {
      total: allFeedback.length,
      byType,
      byStatus,
      byPriority,
      recent,
    };
  }

  /**
   * Get feedback for a specific component
   */
  async getComponentFeedback(componentId: string): Promise<AccessibilityFeedback[]> {
    return Array.from(feedbackStore.values()).filter(
      (f) => f.componentId === componentId
    );
  }
}

/**
 * Singleton instance
 */
export const accessibilityFeedbackAPI = new AccessibilityFeedbackAPI();

/**
 * REST API handler (for integration with Express/Fastify/etc.)
 */
export function createFeedbackHandler() {
  return {
    /**
     * POST /api/accessibility/feedback
     */
    async submit(req: {
      body: Omit<AccessibilityFeedback, 'id' | 'submittedAt' | 'status' | 'userAgent'> & {
        userAgent?: string;
      };
      headers: { 'user-agent'?: string };
    }) {
      const userAgent = req.body.userAgent || req.headers['user-agent'] || 'Unknown';
      const feedback = await accessibilityFeedbackAPI.submitFeedback({
        ...req.body,
        userAgent,
      });
      return { success: true, feedback };
    },

    /**
     * GET /api/accessibility/feedback
     */
    async list(req: { query: Record<string, string> }) {
      const filters: Parameters<typeof accessibilityFeedbackAPI.getAllFeedback>[0] = {};
      if (req.query.issueType) filters.issueType = req.query.issueType as IssueType;
      if (req.query.status) filters.status = req.query.status as AccessibilityFeedback['status'];
      if (req.query.componentId) filters.componentId = req.query.componentId;
      if (req.query.priority) filters.priority = req.query.priority as AccessibilityFeedback['priority'];
      if (req.query.submittedBy) filters.submittedBy = req.query.submittedBy;

      const feedback = await accessibilityFeedbackAPI.getAllFeedback(filters);
      return { success: true, feedback };
    },

    /**
     * GET /api/accessibility/feedback/:id
     */
    async get(req: { params: { id: string } }) {
      const feedback = await accessibilityFeedbackAPI.getFeedback(req.params.id);
      if (!feedback) {
        return { success: false, error: 'Feedback not found' };
      }
      return { success: true, feedback };
    },

    /**
     * PATCH /api/accessibility/feedback/:id/status
     */
    async updateStatus(req: { params: { id: string }; body: { status: AccessibilityFeedback['status'] } }) {
      const feedback = await accessibilityFeedbackAPI.updateStatus(req.params.id, req.body.status);
      if (!feedback) {
        return { success: false, error: 'Feedback not found' };
      }
      return { success: true, feedback };
    },

    /**
     * GET /api/accessibility/feedback/stats
     */
    async stats() {
      const statistics = await accessibilityFeedbackAPI.getStatistics();
      return { success: true, statistics };
    },
  };
}

/**
 * Default export
 */
export default accessibilityFeedbackAPI;

