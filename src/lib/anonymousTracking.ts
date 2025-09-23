/**
 * Anonymous user tracking to prevent multiple reviews
 * Uses localStorage and fingerprinting to track anonymous reviews
 */

interface AnonymousReview {
  teacherId: string;
  timestamp: number;
  fingerprint: string;
}

class AnonymousTracker {
  private readonly STORAGE_KEY = 'teacher_rank_anonymous_reviews';
  private readonly FINGERPRINT_KEY = 'teacher_rank_device_fingerprint';
  private readonly REVIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Generate a device fingerprint based on browser characteristics
   */
  private generateFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('TeacherRank', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('TeacherRank', 4, 17);
    }

    const canvasData = canvas.toDataURL();

    // Combine with other browser characteristics
    const fingerprint = [
      canvasData.slice(-50), // Canvas fingerprint
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      navigator.hardwareConcurrency || 0,
      navigator.platform,
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get or create device fingerprint
   */
  private getDeviceFingerprint(): string {
    let fingerprint = localStorage.getItem(this.FINGERPRINT_KEY);

    if (!fingerprint) {
      fingerprint = this.generateFingerprint();
      localStorage.setItem(this.FINGERPRINT_KEY, fingerprint);
    }

    return fingerprint;
  }

  /**
   * Get all anonymous reviews from localStorage
   */
  private getStoredReviews(): AnonymousReview[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const reviews = JSON.parse(stored) as AnonymousReview[];

      // Clean up old reviews (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const validReviews = reviews.filter(r => r.timestamp > thirtyDaysAgo);

      if (validReviews.length !== reviews.length) {
        this.saveReviews(validReviews);
      }

      return validReviews;
    } catch {
      return [];
    }
  }

  /**
   * Save reviews to localStorage
   */
  private saveReviews(reviews: AnonymousReview[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reviews));
    } catch (e) {
      console.warn('Failed to save anonymous review tracking:', e);
    }
  }

  /**
   * Check if user has already reviewed a teacher
   */
  public hasReviewedTeacher(teacherId: string): boolean {
    const fingerprint = this.getDeviceFingerprint();
    const reviews = this.getStoredReviews();

    return reviews.some(r =>
      r.teacherId === teacherId &&
      r.fingerprint === fingerprint
    );
  }

  /**
   * Check if user can review a teacher (considering cooldown)
   */
  public canReviewTeacher(teacherId: string): { allowed: boolean; cooldownRemaining?: number } {
    const fingerprint = this.getDeviceFingerprint();
    const reviews = this.getStoredReviews();

    const existingReview = reviews.find(r =>
      r.teacherId === teacherId &&
      r.fingerprint === fingerprint
    );

    if (!existingReview) {
      return { allowed: true };
    }

    const timeSinceReview = Date.now() - existingReview.timestamp;

    if (timeSinceReview >= this.REVIEW_COOLDOWN_MS) {
      // Cooldown expired, remove old review and allow new one
      const updatedReviews = reviews.filter(r =>
        !(r.teacherId === teacherId && r.fingerprint === fingerprint)
      );
      this.saveReviews(updatedReviews);
      return { allowed: true };
    }

    return {
      allowed: false,
      cooldownRemaining: this.REVIEW_COOLDOWN_MS - timeSinceReview
    };
  }

  /**
   * Record that a user has reviewed a teacher
   */
  public recordReview(teacherId: string): void {
    const fingerprint = this.getDeviceFingerprint();
    const reviews = this.getStoredReviews();

    // Remove any existing review for this teacher by this device
    const filteredReviews = reviews.filter(r =>
      !(r.teacherId === teacherId && r.fingerprint === fingerprint)
    );

    // Add new review
    filteredReviews.push({
      teacherId,
      timestamp: Date.now(),
      fingerprint
    });

    this.saveReviews(filteredReviews);
  }

  /**
   * Get all teachers reviewed by this device
   */
  public getReviewedTeachers(): string[] {
    const fingerprint = this.getDeviceFingerprint();
    const reviews = this.getStoredReviews();

    return reviews
      .filter(r => r.fingerprint === fingerprint)
      .map(r => r.teacherId);
  }

  /**
   * Clear all anonymous review tracking for this device
   */
  public clearTracking(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.FINGERPRINT_KEY);
  }

  /**
   * Get device fingerprint (public method for server-side tracking)
   */
  public getFingerprint(): string {
    return this.getDeviceFingerprint();
  }
}

// Export singleton instance
export const anonymousTracker = new AnonymousTracker();

// Helper hook for React components
export function useAnonymousTracking(teacherId: string) {
  const hasReviewed = anonymousTracker.hasReviewedTeacher(teacherId);
  const canReview = anonymousTracker.canReviewTeacher(teacherId);

  const formatCooldown = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return {
    hasReviewed,
    canReview: canReview.allowed,
    cooldownRemaining: canReview.cooldownRemaining,
    cooldownMessage: canReview.cooldownRemaining
      ? `You can review this teacher again in ${formatCooldown(canReview.cooldownRemaining)}`
      : undefined,
    recordReview: () => anonymousTracker.recordReview(teacherId),
  };
}