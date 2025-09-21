/**
 * Haptic Feedback Service
 * Provides tactile feedback for mobile interactions
 */

// Haptic patterns for different interactions
const HAPTIC_PATTERNS = {
  // Light feedback - button taps, navigation selections
  light: [10],
  
  // Medium feedback - form submissions, modal actions, toggles
  medium: [20],
  
  // Strong feedback - errors, important alerts, confirmations
  strong: [50],
  
  // Success pattern - successful actions
  success: [20, 50, 20],
  
  // Error pattern - validation errors, failed actions
  error: [50, 100, 50, 100, 50],
  
  // Notification pattern - new message, update available
  notification: [10, 50, 10],
  
  // Double tap - selection confirmation
  doubleTap: [20, 50, 20],
  
  // Long press - context menu activation
  longPress: [30],
  
  // Swipe - navigation gesture completion
  swipe: [15],
  
  // Pull refresh - refresh action triggered
  pullRefresh: [25, 50, 25],
};

export type HapticType = keyof typeof HAPTIC_PATTERNS;

class HapticService {
  private enabled: boolean = true;
  private navigator: Navigator;

  constructor() {
    this.navigator = typeof window !== 'undefined' ? window.navigator : {} as Navigator;
    
    // Check if haptics are supported
    if (!('vibrate' in this.navigator)) {
      console.warn('Haptic feedback not supported on this device');
    }
    
    // Load user preference
    this.loadPreference();
  }

  /**
   * Load haptic preference from localStorage
   */
  private loadPreference(): void {
    try {
      const saved = localStorage.getItem('haptic-enabled');
      this.enabled = saved !== null ? JSON.parse(saved) : true;
    } catch (error) {
      console.warn('Failed to load haptic preference:', error);
      this.enabled = true;
    }
  }

  /**
   * Save haptic preference to localStorage
   */
  private savePreference(): void {
    try {
      localStorage.setItem('haptic-enabled', JSON.stringify(this.enabled));
    } catch (error) {
      console.warn('Failed to save haptic preference:', error);
    }
  }

  /**
   * Check if haptic feedback is available
   */
  public isSupported(): boolean {
    return 'vibrate' in this.navigator;
  }

  /**
   * Check if haptic feedback is enabled
   */
  public isEnabled(): boolean {
    return this.enabled && this.isSupported();
  }

  /**
   * Enable or disable haptic feedback
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.savePreference();
  }

  /**
   * Trigger haptic feedback
   */
  public vibrate(pattern: HapticType | number | number[]): boolean {
    if (!this.isEnabled()) return false;

    let vibrationPattern: number | number[];

    // Handle different input types
    if (typeof pattern === 'string') {
      // Use predefined pattern
      vibrationPattern = HAPTIC_PATTERNS[pattern];
    } else {
      // Use custom pattern
      vibrationPattern = pattern;
    }

    try {
      // Try standard vibrate method
      if ('vibrate' in this.navigator) {
        return (this.navigator as any).vibrate(vibrationPattern);
      }
      
      // Try webkit prefix
      if ('webkitVibrate' in this.navigator) {
        return (this.navigator as any).webkitVibrate(vibrationPattern);
      }
      
      // Try mozilla prefix
      if ('mozVibrate' in this.navigator) {
        return (this.navigator as any).mozVibrate(vibrationPattern);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
      return false;
    }

    return false;
  }

  /**
   * Convenience methods for common feedback types
   */
  public light(): boolean {
    return this.vibrate('light');
  }

  public medium(): boolean {
    return this.vibrate('medium');
  }

  public strong(): boolean {
    return this.vibrate('strong');
  }

  public success(): boolean {
    return this.vibrate('success');
  }

  public error(): boolean {
    return this.vibrate('error');
  }

  public notification(): boolean {
    return this.vibrate('notification');
  }

  public doubleTap(): boolean {
    return this.vibrate('doubleTap');
  }

  public longPress(): boolean {
    return this.vibrate('longPress');
  }

  public swipe(): boolean {
    return this.vibrate('swipe');
  }

  public pullRefresh(): boolean {
    return this.vibrate('pullRefresh');
  }
}

// Export singleton instance
export const haptic = new HapticService();

// React hook for haptic feedback
export const useHaptic = () => {
  return haptic;
};

export default haptic;