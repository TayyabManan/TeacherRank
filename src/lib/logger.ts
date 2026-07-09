/**
 * Error logging utility for production-ready error handling
 * Replaces console.error with a more robust logging system
 */

import { captureException } from './sentry';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory
  private logLevel: LogLevel = LogLevel.INFO;
  
  constructor() {
    // Set log level based on environment
    if (import.meta.env.DEV) {
      this.logLevel = LogLevel.DEBUG;
    } else {
      this.logLevel = LogLevel.WARN;
    }
  }
  
  /**
   * Log a debug message (only in development)
   */
  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  /**
   * Log an info message
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  /**
   * Log a warning
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  /**
   * Log an error
   */
  public error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, context, errorObj);
  }
  
  /**
   * Log a critical error (always logged)
   */
  public critical(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.CRITICAL, message, context, errorObj);
  }
  
  /**
   * Main logging function
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    // Skip if below current log level (except critical)
    if (level < this.logLevel && level !== LogLevel.CRITICAL) {
      return;
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
    };
    
    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Output to console in development
    if (import.meta.env.DEV) {
      this.consoleOutput(entry);
    }

    // Production errors go to Sentry (captureException no-ops outside PROD).
    // The old localStorage error store was write-only — nothing ever read it.
    if (level >= LogLevel.ERROR) {
      captureException(
        entry.error ?? new Error(entry.message),
        {
          message: entry.message,
          level: LogLevel[level],
          ...this.sanitizeContext(entry.context),
        }
      );
    }
  }
  
  /**
   * Console output for development
   */
  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${LogLevel[entry.level]}] ${entry.timestamp.toISOString()}`;
    const style = this.getConsoleStyle(entry.level);
    
    console.log(`%c${prefix}%c ${entry.message}`, style, 'color: inherit');
    
    if (entry.context) {
      console.log('Context:', entry.context);
    }
    
    if (entry.error) {
      console.log('Error:', entry.error);
      if (entry.error.stack) {
        console.log('Stack:', entry.error.stack);
      }
    }
  }
  
  /**
   * Get console style based on log level
   */
  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'color: gray';
      case LogLevel.INFO:
        return 'color: blue';
      case LogLevel.WARN:
        return 'color: orange';
      case LogLevel.ERROR:
        return 'color: red';
      case LogLevel.CRITICAL:
        return 'color: red; font-weight: bold';
      default:
        return '';
    }
  }
  
  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;
    
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get current user ID if available
   */
  private getCurrentUserId(): string | undefined {
    // This would be implemented based on your auth system
    // For now, return undefined
    return undefined;
  }
  
  /**
   * Get or create session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('logger_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('logger_session_id', sessionId);
    }
    return sessionId;
  }
  
  /**
   * Get recent logs (for debugging)
   */
  public getRecentLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }
  
  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Export logs for debugging
   */
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
export const logger = new Logger();

// Convenience exports
export const { debug, info, warn, error, critical } = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  critical: logger.critical.bind(logger),
};

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', event.reason, {
      promise: event.promise,
    });
  });
  
  window.addEventListener('error', (event) => {
    logger.error('Global Error', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}