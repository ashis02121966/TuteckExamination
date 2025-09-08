// Global error handler utility
export class ErrorHandler {
  static logError(error: any, context?: string) {
    if (import.meta.env.DEV) {
      console.error(`[${context || 'Error'}]:`, error);
    }
    
    // In production, you might want to send errors to a logging service
    if (import.meta.env.PROD) {
      // Send to error tracking service like Sentry
      // this.sendToErrorService(error, context);
    }
  }

  static logWarning(message: string, context?: string) {
    if (import.meta.env.DEV) {
      console.warn(`[${context || 'Warning'}]:`, message);
    }
  }

  static logInfo(message: string, context?: string) {
    if (import.meta.env.DEV) {
      console.info(`[${context || 'Info'}]:`, message);
    }
  }

  static handleApiError(error: any, operation: string) {
    this.logError(error, `API ${operation}`);
    
    // Return user-friendly error message
    if (error?.message) {
      return error.message;
    }
    
    if (error?.status === 404) {
      return 'Resource not found';
    }
    
    if (error?.status === 403) {
      return 'Access denied';
    }
    
    if (error?.status === 401) {
      return 'Authentication required';
    }
    
    if (error?.status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  static suppressConsoleWarnings() {
    // Suppress specific console warnings that are not actionable
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const message = args.join(' ');
      
      // Suppress tracking prevention warnings
      if (message.includes('Tracking Prevention blocked access to storage')) {
        return;
      }
      
      // Suppress CORS warnings for external analytics
      if (message.includes('Access to fetch at') && 
          (message.includes('appsignal-endpoint.net') || 
           message.includes('googleads.g.doubleclick.net') ||
           message.includes('connect.facebook.net') ||
           message.includes('static.ads-twitter.com') ||
           message.includes('track.hubspot.com'))) {
        return;
      }
      
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      const message = args.join(' ');
      
      // Suppress network errors for external tracking scripts
      if (message.includes('Failed to load resource') && 
          (message.includes('net::ERR_SSL_PROTOCOL_ERROR') ||
           message.includes('net::ERR_FAILED'))) {
        return;
      }
      
      originalError.apply(console, args);
    };
  }
}

// Initialize error suppression in production
if (import.meta.env.PROD) {
  ErrorHandler.suppressConsoleWarnings();
}